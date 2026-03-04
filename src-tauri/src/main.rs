// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{Datelike, Duration, Local, NaiveDate, TimeZone, Timelike};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State, Window};

// ── Data structures ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Task {
    id: String,
    title: String,
    completed: bool,
    #[serde(rename = "createdAt")]
    created_at: i64,
    #[serde(rename = "updatedAt")]
    updated_at: i64,
    #[serde(rename = "dueAt", skip_serializing_if = "Option::is_none")]
    due_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    priority: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    order: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TaskPatch {
    title: Option<String>,
    completed: Option<bool>,
    order: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct NotificationSettings {
    enabled: bool,
    #[serde(rename = "beforeMinutes")]
    before_minutes: Vec<i32>,
    sound: bool,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            before_minutes: vec![0, 5, 15],
            sound: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct UiPrefs {
    theme: String,
}

impl Default for UiPrefs {
    fn default() -> Self {
        Self { theme: "dark".into() }
    }
}

// ── App state ─────────────────────────────────────────────────────────────

struct AppState {
    data_dir: PathBuf,
    is_pinned: Mutex<bool>,
}

impl AppState {
    fn tasks_path(&self) -> PathBuf { self.data_dir.join("tasks.json") }
    fn prefs_path(&self) -> PathBuf { self.data_dir.join("ui-prefs.json") }
    fn notif_path(&self) -> PathBuf { self.data_dir.join("notification-settings.json") }
}

// ── File I/O ──────────────────────────────────────────────────────────────

fn read_json<T: for<'de> Deserialize<'de> + Default>(path: &PathBuf) -> T {
    if !path.exists() {
        return T::default();
    }
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_json<T: Serialize>(path: &PathBuf, val: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let s = serde_json::to_string_pretty(val).map_err(|e| e.to_string())?;
    fs::write(path, s).map_err(|e| e.to_string())
}

fn read_tasks(state: &AppState) -> Result<Vec<Task>, String> {
    let path = state.tasks_path();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let s = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

fn save_tasks(state: &AppState, tasks: &[Task]) -> Result<(), String> {
    write_json(&state.tasks_path(), &tasks)
}

// ── Smart parsing ─────────────────────────────────────────────────────────

/// Extracts priority from title markers and keywords.
/// Returns (clean_title, priority) where priority 0=none, 1=low, 2=medium, 3=high.
fn parse_priority(title: &str) -> (String, i32) {
    if title.contains("!!!") {
        return (title.replace("!!!", "").trim().to_string(), 3);
    }
    if title.contains("!!") {
        return (title.replace("!!", "").trim().to_string(), 2);
    }
    // Standalone ! (not part of !!)
    let padded = format!(" {} ", title);
    if padded.contains(" ! ") {
        return (title.replace(" ! ", " ").trim().to_string(), 1);
    }
    let lower = title.to_lowercase();
    // p-level notation
    let p_level: i32 = if has_word(&lower, "p1") { 3 }
        else if has_word(&lower, "p2") { 2 }
        else if has_word(&lower, "p3") { 1 }
        else { 0 };
    if p_level > 0 {
        return (title.to_string(), p_level);
    }
    // Keyword priority
    let priority = if lower.contains("urgent") || lower.contains("asap") || lower.contains("critical") { 3 }
        else if lower.contains("medium") || lower.contains("normal") { 2 }
        else if lower.contains("low") || lower.contains("minor") { 1 }
        else { 0 };
    (title.to_string(), priority)
}

fn has_word(text: &str, word: &str) -> bool {
    if let Some(pos) = text.find(word) {
        let before = if pos > 0 { text.as_bytes()[pos - 1] } else { b' ' };
        let after_pos = pos + word.len();
        let after = if after_pos < text.len() { text.as_bytes()[after_pos] } else { b' ' };
        !before.is_ascii_alphanumeric() && !after.is_ascii_alphanumeric()
    } else {
        false
    }
}

/// Parses time strings like "3pm", "3:30pm", "15:00", "9am".
/// Returns (hour, minute).
fn parse_time_str(s: &str) -> (u32, u32) {
    let s = s.trim().to_lowercase();
    if let Some(colon) = s.find(':') {
        let h_str = s[..colon].trim();
        let rest = &s[colon + 1..];
        let (m_str, ampm) = if rest.ends_with("pm") {
            (&rest[..rest.len() - 2], "pm")
        } else if rest.ends_with("am") {
            (&rest[..rest.len() - 2], "am")
        } else {
            (rest.as_str(), "")
        };
        if let (Ok(h), Ok(m)) = (h_str.parse::<u32>(), m_str.trim().parse::<u32>()) {
            let h = if ampm == "pm" && h < 12 { h + 12 } else if ampm == "am" && h == 12 { 0 } else { h };
            return (h.min(23), m.min(59));
        }
    }
    let (num_str, ampm) = if s.ends_with("pm") {
        (&s[..s.len() - 2], "pm")
    } else if s.ends_with("am") {
        (&s[..s.len() - 2], "am")
    } else {
        (s.as_str(), "")
    };
    let h: u32 = num_str.trim().parse().unwrap_or(9);
    let h = if ampm == "pm" && h < 12 { h + 12 } else if ampm == "am" && h == 12 { 0 } else { h };
    (h.min(23), 0)
}

fn date_to_ms(date: NaiveDate, h: u32, m: u32) -> Option<i64> {
    let naive_dt = date.and_hms_opt(h, m, 0)?;
    Local.from_local_datetime(&naive_dt)
        .single()
        .map(|dt| dt.timestamp_millis())
}

/// Parses natural language due dates from the task title.
/// Returns (clean_title, optional_due_timestamp_ms).
fn parse_due(title: &str) -> (String, Option<i64>) {
    let now = Local::now();
    let today = now.date_naive();
    let lower = title.to_lowercase();

    // "tomorrow [time]"
    if lower.starts_with("tomorrow") || lower.contains(" tomorrow") {
        let rest = lower.replacen("tomorrow", "", 1);
        let (h, m) = if rest.trim().is_empty() { (9, 0) } else { parse_time_str(rest.trim()) };
        let tomorrow = today + Duration::days(1);
        let ts = date_to_ms(tomorrow, h, m);
        let clean = title.replacen("tomorrow", "", 1).trim().to_string();
        return (clean, ts);
    }

    // "today [time]"
    if lower.starts_with("today") || lower.contains(" today") {
        let rest = lower.replacen("today", "", 1);
        let (h, m) = if rest.trim().is_empty() {
            (now.hour(), now.minute())
        } else {
            parse_time_str(rest.trim())
        };
        let ts = date_to_ms(today, h, m);
        let clean = title.replacen("today", "", 1).trim().to_string();
        return (clean, ts);
    }

    // "next/this weekday"
    let weekdays = [
        ("monday", 0u32), ("tuesday", 1), ("wednesday", 2), ("thursday", 3),
        ("friday", 4),    ("saturday", 5), ("sunday", 6),
    ];
    for (name, target_dow) in &weekdays {
        let next_key = format!("next {}", name);
        let this_key = format!("this {}", name);
        let is_next = lower.contains(&next_key);
        let is_this = lower.contains(&this_key);
        if is_next || is_this {
            let today_dow = today.weekday().num_days_from_monday() as i64;
            let mut diff = (*target_dow as i64) - today_dow;
            if diff <= 0 || is_next { diff += 7; }
            let target = today + Duration::days(diff);
            let ts = date_to_ms(target, 9, 0);
            let remove = if is_next { &next_key } else { &this_key };
            let clean = lower.replacen(remove.as_str(), "", 1).trim().to_string();
            return (clean, ts);
        }
    }

    // "in N days/hours"
    if let Some(in_pos) = lower.find("in ") {
        let rest = &lower[in_pos + 3..];
        let parts: Vec<&str> = rest.splitn(3, ' ').collect();
        if parts.len() >= 2 {
            if let Ok(n) = parts[0].parse::<i64>() {
                let unit = parts[1];
                let ts_opt = if unit.starts_with("hour") {
                    Some((now + Duration::hours(n)).timestamp_millis())
                } else if unit.starts_with("day") {
                    Some((now + Duration::days(n)).timestamp_millis())
                } else {
                    None
                };
                if let Some(ts) = ts_opt {
                    let remove = format!("in {} {}", n, unit);
                    let clean = lower.replacen(&remove, "", 1).trim().to_string();
                    return (clean, Some(ts));
                }
            }
        }
    }

    // ISO date: YYYY-MM-DD [HH:MM]
    let bytes = lower.as_bytes();
    let mut i = 0;
    while i + 10 <= bytes.len() {
        if bytes[i..i + 4].iter().all(|b| b.is_ascii_digit())
            && bytes[i + 4] == b'-'
            && bytes[i + 5..i + 7].iter().all(|b| b.is_ascii_digit())
            && bytes[i + 7] == b'-'
            && bytes[i + 8..i + 10].iter().all(|b| b.is_ascii_digit())
        {
            if let Ok(d) = NaiveDate::parse_from_str(&lower[i..i + 10], "%Y-%m-%d") {
                let time_rest = lower[i + 10..].trim_start();
                let (h, m) = if time_rest.is_empty() { (9, 0) } else { parse_time_str(time_rest) };
                let ts = date_to_ms(d, h, m);
                let before = title[..i].trim_end();
                let after = title[i + 10..].trim_start();
                let clean = format!("{} {}", before, after).trim().to_string();
                return (clean, ts);
            }
        }
        i += 1;
    }

    (title.to_string(), None)
}

fn now_ms() -> i64 {
    Local::now().timestamp_millis()
}

// ── Tauri commands ────────────────────────────────────────────────────────

#[tauri::command]
async fn load_tasks(state: State<'_, AppState>) -> Result<Vec<Task>, String> {
    read_tasks(&state)
}

#[tauri::command]
async fn create_task(title: String, state: State<'_, AppState>) -> Result<Task, String> {
    let mut tasks = read_tasks(&state)?;
    let ts = now_ms();
    let (after_due, due_at) = parse_due(title.trim());
    let (clean_title, priority) = parse_priority(&after_due);
    let task = Task {
        id: format!("t{}", ts),
        title: if clean_title.is_empty() { title.trim().to_string() } else { clean_title },
        completed: false,
        created_at: ts,
        updated_at: ts,
        due_at,
        priority: if priority > 0 { Some(priority) } else { None },
        order: Some(tasks.len() as i32),
    };
    tasks.push(task.clone());
    save_tasks(&state, &tasks)?;
    Ok(task)
}

#[tauri::command]
async fn update_task(id: String, patch: TaskPatch, state: State<'_, AppState>) -> Result<Task, String> {
    let mut tasks = read_tasks(&state)?;
    let task = tasks.iter_mut()
        .find(|t| t.id == id)
        .ok_or_else(|| format!("task not found: {}", id))?;
    if let Some(t) = patch.title { task.title = t; }
    if let Some(c) = patch.completed { task.completed = c; }
    if let Some(o) = patch.order { task.order = Some(o); }
    task.updated_at = now_ms();
    let result = task.clone();
    save_tasks(&state, &tasks)?;
    Ok(result)
}

#[tauri::command]
async fn delete_task(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut tasks = read_tasks(&state)?;
    tasks.retain(|t| t.id != id);
    save_tasks(&state, &tasks)
}

#[tauri::command]
async fn clear_completed(state: State<'_, AppState>) -> Result<(), String> {
    let mut tasks = read_tasks(&state)?;
    tasks.retain(|t| !t.completed);
    save_tasks(&state, &tasks)
}

#[tauri::command]
async fn reorder_tasks(ordered_ids: Vec<String>, state: State<'_, AppState>) -> Result<(), String> {
    let mut tasks = read_tasks(&state)?;
    let ts = now_ms();
    for (i, id) in ordered_ids.iter().enumerate() {
        if let Some(task) = tasks.iter_mut().find(|t| t.id == *id) {
            task.order = Some(i as i32);
            task.updated_at = ts;
        }
    }
    save_tasks(&state, &tasks)
}

#[tauri::command]
async fn toggle_pin(window: Window, state: State<'_, AppState>) -> Result<bool, String> {
    let mut pinned = state.is_pinned.lock().unwrap();
    *pinned = !*pinned;
    window.set_always_on_top(*pinned).map_err(|e| e.to_string())?;
    Ok(*pinned)
}

#[tauri::command]
async fn get_pin(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(*state.is_pinned.lock().unwrap())
}

#[tauri::command]
async fn win_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn win_close(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_ui_prefs(state: State<'_, AppState>) -> Result<UiPrefs, String> {
    Ok(read_json::<UiPrefs>(&state.prefs_path()))
}

#[tauri::command]
async fn set_ui_prefs(prefs: UiPrefs, state: State<'_, AppState>) -> Result<(), String> {
    write_json(&state.prefs_path(), &prefs)
}

#[tauri::command]
async fn get_notification_settings(state: State<'_, AppState>) -> Result<NotificationSettings, String> {
    Ok(read_json::<NotificationSettings>(&state.notif_path()))
}

#[tauri::command]
async fn update_notification_settings(
    settings: NotificationSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    write_json(&state.notif_path(), &settings)
}

#[tauri::command]
async fn test_notification(app_handle: tauri::AppHandle) -> Result<(), String> {
    let id = app_handle.config().tauri.bundle.identifier.clone();
    tauri::api::notification::Notification::new(&id)
        .title("UpNext")
        .body("Notifications are working!")
        .show()
        .map_err(|e| e.to_string())
}

// ── Main ──────────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app
                .path_resolver()
                .app_data_dir()
                .expect("could not resolve app data dir");
            fs::create_dir_all(&data_dir).expect("could not create app data dir");
            app.manage(AppState {
                data_dir,
                is_pinned: Mutex::new(false),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_tasks,
            create_task,
            update_task,
            delete_task,
            clear_completed,
            reorder_tasks,
            toggle_pin,
            get_pin,
            win_minimize,
            win_close,
            get_ui_prefs,
            set_ui_prefs,
            get_notification_settings,
            update_notification_settings,
            test_notification,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

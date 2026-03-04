// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State, Window};

// Data structures
#[derive(Debug, Serialize, Deserialize, Clone)]
struct Task {
    id: String,
    title: String,
    completed: bool,
    #[serde(rename = "createdAt")]
    created_at: Option<i64>,
    #[serde(rename = "updatedAt")]
    updated_at: Option<i64>,
    order: Option<i32>,
    #[serde(rename = "dueAt")]
    due_at: Option<i64>,
    priority: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TaskUpdate {
    title: Option<String>,
    completed: Option<bool>,
    order: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct NotificationSettings {
    enabled: bool,
    #[serde(rename = "beforeMinutes")]
    before_minutes: Vec<i32>,
    sound: bool,
    #[serde(rename = "showInTray")]
    show_in_tray: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct UIPrefs {
    theme: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WindowBounds {
    x: Option<i32>,
    y: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
}

// App state
struct AppState {
    app_data_dir: PathBuf,
    is_pinned: Mutex<bool>,
}

impl AppState {
    fn tasks_file(&self) -> PathBuf {
        self.app_data_dir.join("tasks.json")
    }

    fn bounds_file(&self) -> PathBuf {
        self.app_data_dir.join("window-bounds.json")
    }

    fn ui_prefs_file(&self) -> PathBuf {
        self.app_data_dir.join("ui-prefs.json")
    }

    fn notification_settings_file(&self) -> PathBuf {
        self.app_data_dir.join("notification-settings.json")
    }
}

// Helper functions for file operations
fn read_tasks(state: &AppState) -> Result<Vec<Task>, String> {
    let path = state.tasks_file();
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read tasks file: {}", e))?;
    
    let tasks: Vec<Task> = serde_json::from_str(&content)
        .unwrap_or_else(|_| Vec::new());
    
    Ok(tasks)
}

fn write_tasks(state: &AppState, tasks: &[Task]) -> Result<(), String> {
    let path = state.tasks_file();
    
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(tasks)
        .map_err(|e| format!("Failed to serialize tasks: {}", e))?;
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write tasks file: {}", e))?;
    
    Ok(())
}

fn read_window_bounds(state: &AppState) -> Option<WindowBounds> {
    let path = state.bounds_file();
    if !path.exists() {
        return None;
    }
    
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

fn write_window_bounds(state: &AppState, bounds: &WindowBounds) -> Result<(), String> {
    let path = state.bounds_file();
    
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    let content = serde_json::to_string(bounds)
        .map_err(|e| format!("Failed to serialize bounds: {}", e))?;
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write bounds file: {}", e))?;
    
    Ok(())
}

fn read_ui_prefs(state: &AppState) -> UIPrefs {
    let path = state.ui_prefs_file();
    if !path.exists() {
        return UIPrefs { theme: None };
    }
    
    let content = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or(UIPrefs { theme: None })
}

fn write_ui_prefs(state: &AppState, prefs: &UIPrefs) -> Result<(), String> {
    let path = state.ui_prefs_file();
    
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(prefs)
        .map_err(|e| format!("Failed to serialize prefs: {}", e))?;
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write prefs file: {}", e))?;
    
    Ok(())
}

fn read_notification_settings(state: &AppState) -> NotificationSettings {
    let path = state.notification_settings_file();
    if !path.exists() {
        return NotificationSettings {
            enabled: true,
            before_minutes: vec![0, 5, 15],
            sound: true,
            show_in_tray: true,
        };
    }
    
    let content = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or(NotificationSettings {
        enabled: true,
        before_minutes: vec![0, 5, 15],
        sound: true,
        show_in_tray: true,
    })
}

fn write_notification_settings(state: &AppState, settings: &NotificationSettings) -> Result<(), String> {
    let path = state.notification_settings_file();
    
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;
    
    Ok(())
}

// Tauri commands
#[tauri::command]
async fn load_tasks(state: State<'_, AppState>) -> Result<Vec<Task>, String> {
    read_tasks(&state)
}

#[tauri::command]
async fn create_task(title: String, state: State<'_, AppState>) -> Result<Task, String> {
    let mut tasks = read_tasks(&state)?;
    
    let new_task = Task {
        id: format!("task_{}", chrono::Utc::now().timestamp_millis()),
        title: title.trim().to_string(),
        completed: false,
        created_at: Some(chrono::Utc::now().timestamp_millis()),
        updated_at: Some(chrono::Utc::now().timestamp_millis()),
        order: Some(tasks.len() as i32),
        due_at: None,
        priority: None,
    };
    
    tasks.push(new_task.clone());
    write_tasks(&state, &tasks)?;
    
    Ok(new_task)
}

#[tauri::command]
async fn update_task(id: String, patch: TaskUpdate, state: State<'_, AppState>) -> Result<Task, String> {
    let mut tasks = read_tasks(&state)?;
    
    let task = tasks.iter_mut()
        .find(|t| t.id == id)
        .ok_or_else(|| format!("Task not found: {}", id))?;
    
    if let Some(title) = patch.title {
        task.title = title;
    }
    if let Some(completed) = patch.completed {
        task.completed = completed;
    }
    if let Some(order) = patch.order {
        task.order = Some(order);
    }
    task.updated_at = Some(chrono::Utc::now().timestamp_millis());
    
    let updated_task = task.clone();
    write_tasks(&state, &tasks)?;
    
    Ok(updated_task)
}

#[tauri::command]
async fn delete_task(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut tasks = read_tasks(&state)?;
    tasks.retain(|t| t.id != id);
    write_tasks(&state, &tasks)?;
    Ok(())
}

#[tauri::command]
async fn clear_completed(state: State<'_, AppState>) -> Result<(), String> {
    let mut tasks = read_tasks(&state)?;
    tasks.retain(|t| !t.completed);
    write_tasks(&state, &tasks)?;
    Ok(())
}

// Window management commands
#[tauri::command]
async fn toggle_pin(window: Window, state: State<'_, AppState>) -> Result<bool, String> {
    let mut is_pinned = state.is_pinned.lock().unwrap();
    *is_pinned = !*is_pinned;
    window.set_always_on_top(*is_pinned)
        .map_err(|e| format!("Failed to set pin state: {}", e))?;
    Ok(*is_pinned)
}

#[tauri::command]
async fn get_pin(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(*state.is_pinned.lock().unwrap())
}

#[tauri::command]
async fn win_close(window: Window) -> Result<(), String> {
    window.close()
        .map_err(|e| format!("Failed to close window: {}", e))
}

#[tauri::command]
async fn win_minimize(window: Window) -> Result<(), String> {
    window.minimize()
        .map_err(|e| format!("Failed to minimize window: {}", e))
}

// Notification settings commands
#[tauri::command]
async fn get_notification_settings(state: State<'_, AppState>) -> Result<NotificationSettings, String> {
    Ok(read_notification_settings(&state))
}

#[tauri::command]
async fn update_notification_settings(settings: NotificationSettings, state: State<'_, AppState>) -> Result<(), String> {
    write_notification_settings(&state, &settings)
}

#[tauri::command]
async fn test_notification(app_handle: tauri::AppHandle) -> Result<(), String> {
    let identifier = app_handle.config().tauri.bundle.identifier.clone();
    tauri::api::notification::Notification::new(&identifier)
        .title("UpNext")
        .body("Test notification - notifications are working!")
        .show()
        .map_err(|e| format!("Failed to show notification: {}", e))?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Get app data directory
            let app_data_dir = app.path_resolver()
                .app_data_dir()
                .expect("Failed to get app data directory");
            
            // Create app data directory if it doesn't exist
            fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");
            
            // Initialize app state
            app.manage(AppState { app_data_dir, is_pinned: Mutex::new(false) });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_tasks,
            create_task,
            update_task,
            delete_task,
            clear_completed,
            toggle_pin,
            get_pin,
            win_close,
            win_minimize,
            get_notification_settings,
            update_notification_settings,
            test_notification
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

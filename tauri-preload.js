// Tauri API bridge — exposes window.api to renderer.js via Tauri's invoke system.
// Every method here must have a matching #[tauri::command] in src-tauri/src/main.rs.
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';

window.api = {
  // ── Tasks ────────────────────────────────────────────────────────────
  loadTasks:       ()           => invoke('load_tasks'),
  createTask:      (title)      => invoke('create_task',  { title }),
  updateTask:      (id, patch)  => invoke('update_task',  { id, patch }),
  deleteTask:      (id)         => invoke('delete_task',  { id }),
  clearCompleted:  ()           => invoke('clear_completed'),
  reorderTasks:    (orderedIds) => invoke('reorder_tasks', { orderedIds }),

  // ── Window ───────────────────────────────────────────────────────────
  togglePin: async () => {
    const pinned = await invoke('toggle_pin');
    return { pinned };
  },
  getPin: async () => {
    const pinned = await invoke('get_pin');
    return { pinned };
  },
  winMinimize: () => invoke('win_minimize'),
  winClose:    () => invoke('win_close'),

  // ── Preferences (theme) ──────────────────────────────────────────────
  getUiPrefs:  ()      => invoke('get_ui_prefs'),
  setUiPrefs:  (prefs) => invoke('set_ui_prefs', { prefs }),

  // ── Notifications ────────────────────────────────────────────────────
  getNotificationSettings:    ()         => invoke('get_notification_settings'),
  updateNotificationSettings: (settings) => invoke('update_notification_settings', { settings }),
  testNotification:           ()         => invoke('test_notification'),
};

// Expose appWindow for drag region
window.appWindow = appWindow;

// Tauri API bridge - replaces Electron preload
// This file provides the same API as the Electron preload but uses Tauri's invoke system
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';

// Create the same window.api interface that the renderer expects
window.api = {
  // Task operations
  loadTasks: () => invoke('load_tasks'),
  createTask: (title) => invoke('create_task', { title }),
  updateTask: (id, patch) => invoke('update_task', { id, patch }),
  deleteTask: (id) => invoke('delete_task', { id }),
  clearCompleted: () => invoke('clear_completed'),
  
  // Window operations
  togglePin: async () => {
    const pinned = await invoke('toggle_pin');
    return { pinned };
  },
  getPin: async () => {
    const pinned = await invoke('get_pin');
    return { pinned };
  },
  winClose: () => invoke('win_close'),
  winMin: () => invoke('win_minimize'),
  
  // Notification settings (stub for now - Firebase auth will be handled in renderer)
  getNotificationSettings: () => invoke('get_notification_settings'),
  updateNotificationSettings: (settings) => invoke('update_notification_settings', { settings }),
  testNotification: () => invoke('test_notification'),
  
  // Firebase authentication stubs (these will be handled in renderer with Firebase SDK)
  signInWithGoogle: () => {
    console.log('Firebase auth should be handled in renderer with Firebase SDK');
    return Promise.resolve({ error: 'Not implemented in Tauri - use Firebase SDK in renderer' });
  },
  signOut: () => {
    console.log('Firebase auth should be handled in renderer with Firebase SDK');
    return Promise.resolve({ ok: true });
  },
  getCurrentUser: () => {
    console.log('Firebase auth should be handled in renderer with Firebase SDK');
    return Promise.resolve({ user: null, hasStoredAuth: false, showSignInButton: true });
  },
  checkStoredAuth: () => {
    console.log('Firebase auth should be handled in renderer with Firebase SDK');
    return Promise.resolve({ hasStoredAuth: false });
  },
  
  // Update stubs (not implemented in this version)
  checkForUpdates: () => Promise.resolve({ available: false }),
  downloadAndInstall: () => Promise.resolve({ ok: false }),
};

// Create the same window.electronAPI interface for event listeners
window.electronAPI = {
  onAuthStateChanged: (callback) => {
    // Auth state changes will be handled in renderer with Firebase SDK
    console.log('Auth state listener registered (handled in renderer)');
  },
  onUpdateAvailable: (callback) => {
    console.log('Update listener registered (not implemented)');
  },
  onUpdateProgress: (callback) => {
    console.log('Update progress listener registered (not implemented)');
  },
  onUpdateDownloaded: (callback) => {
    console.log('Update downloaded listener registered (not implemented)');
  },
};

console.log('Tauri API bridge loaded');

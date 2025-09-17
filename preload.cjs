// CommonJS preload to avoid ESM require issues in Electron
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadTasks: () => ipcRenderer.invoke('tasks:load'),
  createTask: (title) => ipcRenderer.invoke('tasks:create', title),
  updateTask: (id, patch) => ipcRenderer.invoke('tasks:update', { id, patch }),
  deleteTask: (id) => ipcRenderer.invoke('tasks:delete', id),
  clearCompleted: () => ipcRenderer.invoke('tasks:clearCompleted'),
  togglePin: () => ipcRenderer.invoke('window:togglePin'),
  getPin: () => ipcRenderer.invoke('window:getPin'),
  winClose: () => ipcRenderer.invoke('window:close'),
  winMin: () => ipcRenderer.invoke('window:minimize'),
  // Authentication methods
  signInWithGoogle: () => ipcRenderer.invoke('auth:signInWithGoogle'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
  getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  checkStoredAuth: () => ipcRenderer.invoke('auth:checkStoredAuth'),
  // Notification methods
  getNotificationSettings: () => ipcRenderer.invoke('notifications:getSettings'),
  updateNotificationSettings: (settings) => ipcRenderer.invoke('notifications:updateSettings', settings),
  testNotification: () => ipcRenderer.invoke('notifications:testAlert'),
  // Update methods
  checkForUpdates: () => ipcRenderer.invoke('update:checkForUpdates'),
  downloadAndInstall: () => ipcRenderer.invoke('update:downloadAndInstall')
});

// Expose auth state change listener and update events
contextBridge.exposeInMainWorld('electronAPI', {
  onAuthStateChanged: (callback) => {
    ipcRenderer.on('auth-state-changed', (_event, user) => callback(user));
  },
  // Update event listeners
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (_event, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  }
});



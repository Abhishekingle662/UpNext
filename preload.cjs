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
  checkStoredAuth: () => ipcRenderer.invoke('auth:checkStoredAuth')
});

// Expose auth state change listener
contextBridge.exposeInMainWorld('electronAPI', {
  onAuthStateChanged: (callback) => {
    ipcRenderer.on('auth-state-changed', (_event, user) => callback(user));
  }
});



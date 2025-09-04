import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('api', {
loadTasks: () => ipcRenderer.invoke('tasks:load'),
createTask: (title) => ipcRenderer.invoke('tasks:create', title),
updateTask: (id, patch) => ipcRenderer.invoke('tasks:update', { id, patch }),
deleteTask: (id) => ipcRenderer.invoke('tasks:delete', id),
clearCompleted: () => ipcRenderer.invoke('tasks:clearCompleted'),
togglePin: () => ipcRenderer.invoke('window:togglePin'),
winClose: () => ipcRenderer.invoke('window:close'),
winMin: () => ipcRenderer.invoke('window:minimize')
});
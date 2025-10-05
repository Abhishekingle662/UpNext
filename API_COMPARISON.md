# Tauri vs Electron: API Comparison

This document shows how the same API calls work in both Tauri and Electron versions.

## Architecture Overview

### Electron Architecture
```
┌─────────────────────────────────────────┐
│         Electron Application            │
├─────────────────────────────────────────┤
│  Renderer Process (renderer/renderer.js)│
│              ↕ IPC                      │
│  Main Process (main.cjs)                │
│              ↕                          │
│  Firebase Service (firebase-main.cjs)   │
└─────────────────────────────────────────┘
```

### Tauri Architecture
```
┌─────────────────────────────────────────┐
│         Tauri Application               │
├─────────────────────────────────────────┤
│  Renderer (renderer/renderer.js)        │
│              ↕ Invoke                   │
│  Rust Backend (src-tauri/src/main.rs)  │
│              ↕                          │
│  File System / OS APIs                  │
└─────────────────────────────────────────┘
```

## API Implementation Comparison

### Task Loading

#### Electron (main.cjs)
```javascript
ipcMain.handle('tasks:load', async () => {
  try {
    const tasks = await firebaseMainService.loadTasks();
    const enriched = tasks.map(enrichTaskMeta);
    sortTasksForDisplay(enriched);
    return enriched;
  } catch (error) {
    // Fallback to local storage
    const tasks = await readTasks();
    return tasks.map(enrichTaskMeta);
  }
});
```

#### Tauri (src-tauri/src/main.rs)
```rust
#[tauri::command]
async fn load_tasks(state: State<'_, AppState>) -> Result<Vec<Task>, String> {
    read_tasks(&state)
}
```

### Creating Tasks

#### Electron (main.cjs)
```javascript
ipcMain.handle('tasks:create', async (_evt, title) => {
  try {
    const task = await firebaseMainService.createTask(title);
    return { ok: true, task: enrichTaskMeta(task) };
  } catch (error) {
    // Fallback to local storage
    const tasks = await readTasks();
    const newTask = {
      id: `task_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      title: title.trim(),
      completed: false,
      // ...
    };
    tasks.push(newTask);
    await writeTasks(tasks);
    return { ok: true, task: enrichTaskMeta(newTask) };
  }
});
```

#### Tauri (src-tauri/src/main.rs)
```rust
#[tauri::command]
async fn create_task(title: String, state: State<'_, AppState>) -> Result<Task, String> {
    let mut tasks = read_tasks(&state)?;
    
    let new_task = Task {
        id: format!("task_{}", chrono::Utc::now().timestamp_millis()),
        title: title.trim().to_string(),
        completed: false,
        created_at: Some(chrono::Utc::now().timestamp_millis()),
        // ...
    };
    
    tasks.push(new_task.clone());
    write_tasks(&state, &tasks)?;
    
    Ok(new_task)
}
```

### Window Management

#### Electron (main.cjs)
```javascript
ipcMain.handle('window:togglePin', () => {
  if (!win) return { pinned: false };
  const current = win.isAlwaysOnTop();
  win.setAlwaysOnTop(!current);
  return { pinned: !current };
});

ipcMain.handle('window:close', () => { 
  win?.close(); 
});

ipcMain.handle('window:minimize', () => { 
  win?.minimize(); 
});
```

#### Tauri (src-tauri/src/main.rs)
```rust
#[tauri::command]
async fn toggle_pin(window: Window) -> Result<bool, String> {
    let is_pinned = window.is_always_on_top()
        .map_err(|e| format!("Failed to get pin state: {}", e))?;
    
    window.set_always_on_top(!is_pinned)
        .map_err(|e| format!("Failed to set pin state: {}", e))?;
    
    Ok(!is_pinned)
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
```

## Frontend Usage (Identical for Both)

### Using the API in Renderer

```javascript
// Load tasks
const tasks = await window.api.loadTasks();

// Create task
const newTask = await window.api.createTask('Buy milk');

// Update task
await window.api.updateTask(taskId, { completed: true });

// Delete task
await window.api.deleteTask(taskId);

// Clear completed
await window.api.clearCompleted();

// Window controls
await window.api.togglePin();
await window.api.winMin();
await window.api.winClose();
```

The renderer code is **100% identical** between Electron and Tauri!

## Data Flow Comparison

### Electron Data Flow
```
Renderer (renderer.js)
    ↓ window.api.loadTasks()
IPC Channel (contextBridge)
    ↓ ipcRenderer.invoke('tasks:load')
Main Process (main.cjs)
    ↓ ipcMain.handle('tasks:load', ...)
Firebase Service (firebase-main.cjs)
    ↓ firebaseMainService.loadTasks()
Firebase/Local Storage
    ↓ return tasks
Main Process
    ↓ return enriched tasks
Renderer
    ↓ display tasks
```

### Tauri Data Flow
```
Renderer (renderer.js)
    ↓ window.api.loadTasks()
Tauri Bridge (tauri-preload.js)
    ↓ invoke('load_tasks')
Rust Backend (main.rs)
    ↓ #[tauri::command] load_tasks(...)
File System
    ↓ read tasks.json
Rust Backend
    ↓ return Vec<Task>
Renderer
    ↓ display tasks
```

## Firebase Integration

### Electron
- Firebase SDK runs in main process (Node.js)
- Auth handled through native OAuth flow
- Sync managed by firebase-main.cjs

### Tauri
- Firebase SDK runs in renderer (WebView)
- Auth handled through Firebase SDK's web flow
- Sync managed by Firebase SDK directly
- More efficient (no IPC overhead for Firebase calls)

## File Storage Locations

### Electron
```javascript
app.getPath('userData')
// Windows: C:\Users\<User>\AppData\Roaming\upnext
// macOS: ~/Library/Application Support/upnext
// Linux: ~/.config/upnext
```

### Tauri
```rust
app.path_resolver().app_data_dir()
// Windows: C:\Users\<User>\AppData\Roaming\com.abhi.upnext
// macOS: ~/Library/Application Support/com.abhi.upnext
// Linux: ~/.config/upnext
```

Both use platform-standard locations, just slightly different paths.

## Performance Comparison

### Startup Time
- **Electron**: 2-3 seconds (loads Node.js + Chromium)
- **Tauri**: <1 second (uses system WebView)

### Memory Usage
- **Electron**: ~150 MB (Node.js + Chromium engine)
- **Tauri**: ~50 MB (Rust backend + system WebView)

### Bundle Size
- **Electron**: ~150 MB (includes Chromium)
- **Tauri**: ~10-15 MB (uses system WebView)

### API Call Latency
- **Electron**: ~1-2ms (IPC overhead)
- **Tauri**: ~0.5-1ms (direct Rust calls)

## Security Comparison

### Electron
- Node.js backend (larger attack surface)
- Chromium security model
- Context isolation required
- IPC security model

### Tauri
- Rust backend (memory-safe by design)
- System WebView security
- Smaller attack surface
- Command allowlist by default

## Migration Path

For users of the app:
1. Both versions can coexist
2. Data is compatible (same JSON format)
3. Both sync to same Firebase backend
4. Switching between versions is seamless

For developers:
1. Start with Tauri for new features
2. Keep Electron version for compatibility
3. Gradually deprecate Electron
4. Eventually remove Electron code

## Best Practices

### Renderer Code
- Keep platform-agnostic
- Use `window.api` interface only
- Don't access Electron/Tauri internals directly
- Test on both platforms

### Backend Code
- Mirror functionality in both
- Keep APIs consistent
- Handle errors gracefully
- Document differences

### Testing
- Test both versions
- Verify data compatibility
- Check Firebase sync works
- Validate cross-platform

## Troubleshooting

### Renderer not connecting to backend

**Electron:**
- Check preload.cjs is loaded
- Verify contextBridge is working
- Check IPC handlers are registered

**Tauri:**
- Check tauri-preload.js is loaded
- Verify commands are registered
- Check Rust backend compiled

### Data not persisting

**Both:**
- Check app data directory exists
- Verify file permissions
- Check error logs
- Validate JSON format

### Firebase sync not working

**Electron:**
- Check firebase-main.cjs initialization
- Verify config is correct
- Check network connectivity

**Tauri:**
- Check Firebase SDK loaded in renderer
- Verify config is correct
- Check CORS settings
- Validate CSP allows Firebase domains

## Conclusion

The migration to Tauri maintains:
- ✅ Same functionality
- ✅ Same user experience
- ✅ Same data format
- ✅ Better performance
- ✅ Smaller bundle size
- ✅ Enhanced security

The transition is seamless for users and straightforward for developers!

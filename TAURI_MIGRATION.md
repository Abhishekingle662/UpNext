# Tauri Migration Guide

## Overview

This repository has been migrated from Electron to Tauri to provide a more lightweight and secure desktop application. The migration maintains compatibility with the existing web application and Firebase sync functionality.

## What Changed

### Architecture
- **Before**: Electron (Node.js + Chromium)
- **After**: Tauri (Rust backend + system WebView)

### Benefits
- 🚀 **Smaller bundle size**: ~10-15MB vs ~150MB with Electron
- ⚡ **Better performance**: Native Rust backend with lower memory footprint
- 🔒 **Enhanced security**: Rust's memory safety and smaller attack surface
- 🌍 **Better system integration**: Uses system WebView instead of bundling Chromium

## Development

### Prerequisites

#### Linux
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libsoup2.4-dev
```

#### macOS
```bash
# Xcode Command Line Tools are required
xcode-select --install
```

#### Windows
- Microsoft Visual Studio C++ Build Tools
- WebView2 (usually pre-installed on Windows 10/11)

### Running the App

```bash
# Install dependencies
npm install

# Run in development mode (Tauri)
npm run tauri:dev

# Build for production (Tauri)
npm run tauri:build

# Old Electron commands still work
npm start  # Electron dev mode
npm run dev  # Electron with auto-reload
```

## Project Structure

```
upnext/
├── src-tauri/              # Tauri Rust backend
│   ├── src/
│   │   └── main.rs         # Main Rust application with IPC handlers
│   ├── Cargo.toml          # Rust dependencies
│   ├── tauri.conf.json     # Tauri configuration
│   └── icons/              # Application icons
├── renderer/               # Desktop UI (shared with Tauri)
│   ├── index.html
│   ├── renderer.js
│   └── styles.css
├── web/                    # Web app (Firebase-powered)
├── tauri-preload.js        # Tauri API bridge (replaces Electron preload)
├── main.cjs                # Legacy Electron main process
├── preload.cjs             # Legacy Electron preload
└── package.json
```

## API Compatibility

The Tauri version maintains the same `window.api` interface as the Electron version for seamless compatibility with the existing renderer code:

### Task Operations
- `window.api.loadTasks()`
- `window.api.createTask(title)`
- `window.api.updateTask(id, patch)`
- `window.api.deleteTask(id)`
- `window.api.clearCompleted()`

### Window Operations
- `window.api.togglePin()`
- `window.api.getPin()`
- `window.api.winClose()`
- `window.api.winMin()`

### Notifications
- `window.api.getNotificationSettings()`
- `window.api.updateNotificationSettings(settings)`
- `window.api.testNotification()`

## Firebase Integration

Firebase authentication and sync work identically in both Electron and Tauri versions. The Firebase SDK runs in the renderer process, so all existing Firebase code continues to work without changes.

## Building for Distribution

### Tauri Build
```bash
npm run tauri:build
```

Outputs will be in `src-tauri/target/release/bundle/`:
- **Windows**: `.msi` and `.exe` installers
- **macOS**: `.dmg` and `.app` bundle
- **Linux**: `.deb`, `.AppImage`, and `.rpm` packages

### Electron Build (Legacy)
```bash
npm run dist
```

## Migration Notes

### What Works
- ✅ All task CRUD operations
- ✅ Window management (pin, minimize, close)
- ✅ Notification settings
- ✅ Firebase authentication and sync
- ✅ Theme switching
- ✅ Drag and drop reordering
- ✅ Due dates and priorities
- ✅ Cross-platform builds

### Known Differences
- Auto-updates: Not yet implemented in Tauri version (planned)
- Native OAuth: Tauri handles Firebase auth in renderer (using Firebase SDK directly)
- Window bounds: Saved locally per platform in app data directory

### Data Storage

Both versions use the same data format and storage locations:
- **Local tasks**: `app-data-dir/tasks.json`
- **Window bounds**: `app-data-dir/window-bounds.json`
- **UI preferences**: `app-data-dir/ui-prefs.json`
- **Notification settings**: `app-data-dir/notification-settings.json`

App data directory locations:
- **Windows**: `%APPDATA%\upnext`
- **macOS**: `~/Library/Application Support/com.abhi.upnext`
- **Linux**: `~/.config/upnext`

## Troubleshooting

### Linux Build Issues

If you encounter webkit-related errors:
```bash
# For Ubuntu 24.04+ (webkit2gtk-4.1)
sudo apt-get install libwebkit2gtk-4.1-dev

# For older Ubuntu versions (webkit2gtk-4.0)
sudo apt-get install libwebkit2gtk-4.0-dev
```

### Windows Build Issues

Ensure WebView2 is installed:
- Download from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### macOS Build Issues

Ensure Xcode Command Line Tools are installed:
```bash
xcode-select --install
```

## Contributing

When contributing to the Tauri version:

1. Test both Electron and Tauri versions to ensure compatibility
2. Update both `main.rs` (Tauri) and `main.cjs` (Electron) for backend changes
3. Keep the renderer code platform-agnostic
4. Test on all three platforms (Windows, macOS, Linux) when possible

## Future Plans

- [ ] Implement auto-updates for Tauri version
- [ ] Migrate completely to Tauri and remove Electron dependencies
- [ ] Add system tray support
- [ ] Implement keyboard shortcuts management
- [ ] Add native notifications with actions
- [ ] Create GitHub Actions workflow for multi-platform builds

## License

MIT License - see LICENSE file for details

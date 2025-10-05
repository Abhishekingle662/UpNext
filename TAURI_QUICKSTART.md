# 🚀 Quick Start Guide for Tauri

## Running the Tauri Version

The UpNext application has been migrated to Tauri for better performance and smaller bundle sizes.

### Option 1: Run with Tauri (Recommended)

```bash
# Install dependencies (first time only)
npm install

# Run in development mode
npm run tauri:dev
```

### Option 2: Run with Electron (Legacy)

```bash
# Install dependencies (first time only)
npm install

# Run in development mode
npm run dev
# or
npm start
```

## Building for Distribution

### Tauri Build

```bash
# Build for your current platform
npm run tauri:build
```

The built application will be in `src-tauri/target/release/bundle/`:
- **Windows**: `UpNext_0.2.0_x64_en-US.msi`
- **macOS**: `UpNext.app` and `UpNext.dmg`
- **Linux**: `upnext_0.2.0_amd64.deb`, `upnext_0.2.0_amd64.AppImage`

### Electron Build (Legacy)

```bash
npm run dist
```

## System Requirements

### For Development

#### Windows
- Node.js 16+
- Rust (install from https://rustup.rs)
- Microsoft Visual Studio C++ Build Tools
- WebView2 (usually pre-installed on Windows 10/11)

#### macOS
- Node.js 16+
- Rust (install from https://rustup.rs)
- Xcode Command Line Tools:
  ```bash
  xcode-select --install
  ```

#### Linux (Ubuntu/Debian)
- Node.js 16+
- Rust (install from https://rustup.rs)
- System dependencies:
  ```bash
  sudo apt-get update
  sudo apt-get install -y \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libsoup2.4-dev \
    build-essential \
    curl \
    wget \
    file
  ```

## First Time Setup

1. **Install Rust** (if not already installed):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Clone and setup**:
   ```bash
   git clone https://github.com/Abhishekingle662/UpNext.git
   cd UpNext
   npm install
   ```

3. **Configure Firebase** (for sync features):
   - Copy `firebase-config.template.js` to `firebase-config.js`
   - Add your Firebase credentials
   - See `FIREBASE_SETUP.md` for detailed instructions

4. **Run the app**:
   ```bash
   npm run tauri:dev
   ```

## Key Differences: Tauri vs Electron

| Feature | Tauri | Electron |
|---------|-------|----------|
| Bundle Size | ~10-15 MB | ~150 MB |
| Memory Usage | Lower (uses system WebView) | Higher (bundles Chromium) |
| Backend | Rust | Node.js |
| Startup Time | Faster | Slower |
| Auto-updates | Not yet implemented | ✅ Working |
| Cross-platform | ✅ Windows, macOS, Linux | ✅ Windows, macOS, Linux |

## Troubleshooting

### "Tauri command not found"

Make sure you've run `npm install` to install the Tauri CLI.

### Build fails on Linux

Make sure all system dependencies are installed:
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libsoup2.4-dev
```

### Build fails on Windows

1. Install Visual Studio Build Tools
2. Install WebView2: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### Build fails on macOS

Install Xcode Command Line Tools:
```bash
xcode-select --install
```

## Development Tips

### Hot Reload

The Tauri dev mode supports hot reload for HTML/CSS/JS changes. Rust changes require a restart.

### Debugging

- **Browser DevTools**: Press F12 or Ctrl+Shift+I in the Tauri window
- **Rust logs**: Check terminal output for backend logs
- **Network**: Firebase and API calls visible in DevTools

### Testing Both Versions

You can run both Electron and Tauri versions side by side:

```bash
# Terminal 1: Electron
npm start

# Terminal 2: Tauri
npm run tauri:dev
```

## Next Steps

- Read `TAURI_MIGRATION.md` for detailed migration information
- See `FIREBASE_SETUP.md` for Firebase configuration
- Check `SETUP_INSTRUCTIONS.md` for additional setup details

## Getting Help

- Create an issue: https://github.com/Abhishekingle662/UpNext/issues
- Check existing documentation in the `docs/` folder
- Review Tauri documentation: https://tauri.app/

---

**Note**: The Tauri version is fully functional and recommended for new installations. The Electron version is maintained for compatibility but may be deprecated in future releases.

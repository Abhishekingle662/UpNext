# CLAUDE.md — UpNext Codebase Guide

> This file is intended for AI assistants (Claude, Copilot, etc.) to understand the codebase structure, conventions, and workflows before making changes.

---

## Project Overview

**UpNext** is a cross-platform task management application (v0.2.0) that runs as:
- A **desktop app** — implemented in both **Electron** (legacy) and **Tauri** (modern/preferred)
- A **web app / PWA** — Firebase-hosted at https://upnext-97a2a.web.app

**Author:** Abhishek Ingle
**License:** MIT
**Tech:** Vanilla JavaScript (no framework), Rust (Tauri backend), Firebase (cloud sync)

---

## Repository Layout

```
UpNext/
├── main.cjs                   # Electron main process (entry point)
├── firebase-main.cjs          # Firebase integration for desktop
├── preload.cjs                # Electron IPC bridge (context bridge)
├── tauri-preload.js           # Tauri API compatibility layer (mirrors preload.cjs API)
├── serve-web.js               # Simple HTTP server for local web testing
├── setup.js                   # Initial setup script
├── increment-version.cjs      # Version bumping (patch/minor/major)
├── create-zip-dist.cjs        # Creates ZIP archives from build outputs
│
├── renderer/                  # Shared desktop UI (used by both Electron & Tauri)
│   ├── index.html             # HTML structure
│   ├── renderer.js            # UI logic (~800 lines)
│   └── styles.css             # Desktop styles + CSS variables for theming
│
├── web/                       # Web app / PWA
│   ├── index.html             # HTML with PWA meta tags + import map
│   ├── web-app.js             # Main web app class (~800 lines)
│   ├── web-styles.css         # Web-specific styles
│   ├── sw.js                  # Service worker (cache-first strategy)
│   ├── manifest.json          # PWA manifest
│   └── firebase-config.js     # Firebase SDK config (NOT in git — see .gitignore)
│
├── src-tauri/                 # Tauri Rust backend
│   ├── src/main.rs            # Rust entry point with all IPC command handlers
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # Tauri app configuration
│
├── assets/                    # App icons (.ico, .png, .icns)
├── .github/workflows/
│   └── tauri-build.yml        # CI/CD: builds for Win/macOS/Linux on push/tag
│
└── *.md                       # Documentation files (see below)
```

---

## Technology Stack

| Layer | Electron path | Tauri path | Web path |
|-------|--------------|------------|----------|
| UI | `renderer/renderer.js` | `renderer/renderer.js` (same) | `web/web-app.js` |
| Backend | `main.cjs` (Node.js) | `src-tauri/src/main.rs` (Rust) | Firebase SDK |
| IPC bridge | `preload.cjs` | `tauri-preload.js` | N/A |
| Storage | `tasks.json` in `userData/` | `tasks.json` in `$APPDATA/` | Firestore + IndexedDB |
| Auth | `firebase-main.cjs` | `firebase-main.cjs` | Firebase Auth (browser) |
| Sync | Firebase Firestore | Firebase Firestore | Firebase Firestore |

**Key versions:**
- Node: 18+
- Electron: v31.3.0
- Tauri: v1.8.1 (Rust edition 2021, rust-version 1.60)
- Firebase SDK: v10.7.1 (modular)

---

## Development Commands

```bash
# Install dependencies
npm install

# --- Development ---
npm run dev            # Electron with hot reload (electronmon)
npm run tauri:dev      # Tauri with hot reload (preferred)
npm run serve-web      # Web app at http://localhost:3000

# --- Building ---
npm run dist           # Build Electron installers → dist/
npm run tauri:build    # Build Tauri installers → src-tauri/target/release/bundle/
npm run pack           # Test Electron build without creating installer

# --- Releases ---
npm run release:patch  # Bump patch, commit, tag, push, publish (0.2.0 → 0.2.1)
npm run release:minor  # Bump minor (0.2.0 → 0.3.0)
npm run release:major  # Bump major (0.2.0 → 1.0.0)
```

**No automated test suite exists.** Testing is manual; see `TESTING_GUIDE.md`.

---

## Key Conventions

### File Extensions
- `.cjs` — CommonJS modules (Electron main process, Node scripts). **Never use `import` here.**
- `.js` — ES Modules (`"type": "module"` in package.json). **Use `import`/`export`.**
- `.rs` — Rust (Tauri backend only)

### JavaScript Style
- **No framework** — vanilla ES6+ DOM APIs throughout
- **No bundler** — scripts are loaded directly; browser compatibility matters
- DOM helper: `const $ = (sel, root=document) => root.querySelector(sel);`
- Async/await with `try/catch` for all IPC calls
- IPC results return `{ok: true/false, ...data}` shape — always check `res.ok`

### Naming
- JavaScript: `camelCase` for variables and functions
- Rust: `snake_case` for functions and fields
- Prefix functions with verbs: `getTask`, `loadTasks`, `togglePin`, `savePrefs`
- DOM data attributes: `data-role="title"`, `data-role="edit"`, `data-id="<taskId>"`
- Template IDs: `#itemTpl`, `#settingsModal`

### Task Data Shape

```typescript
// Shared across Electron, Tauri, and Web
interface Task {
  id: string;          // UUID or Firestore doc ID
  title: string;
  completed: boolean;
  createdAt: number;   // Unix timestamp (ms)
  updatedAt: number;
  dueAt?: number;      // Parsed from natural language in title
  priority?: number;   // 0 (none), 1 (low), 2 (medium), 3 (high)
  order?: number;      // For drag-and-drop reordering
}
```

### Smart Parsing (built into main.cjs and main.rs)

**Priority** is stripped from the task title and stored separately:
```
"!!!" or "p1" or "urgent"/"high"/"critical"  → priority 3
"!!"  or "p2" or "medium"/"normal"            → priority 2
"!"   or "p3" or "low"/"minor"                → priority 1
```

**Due dates** are parsed from natural language at task creation:
```
"tomorrow 3pm"    → next day at 15:00
"next monday"     → following Monday
"in 2 days"       → 48 hours from now
"2024-12-25 14:30" → explicit datetime
```

---

## Desktop API Surface (window.api)

Both `preload.cjs` (Electron) and `tauri-preload.js` expose **identical APIs** so `renderer.js` works unchanged on both platforms.

```javascript
// Task CRUD
await window.api.loadTasks()                    // → Task[]
await window.api.createTask(title)              // → {ok, task}
await window.api.updateTask(id, patch)          // → {ok, task}
await window.api.deleteTask(id)                 // → {ok}
await window.api.clearCompleted()               // → void

// Window management
await window.api.togglePin()                    // toggle always-on-top
await window.api.getPin()                       // → boolean
await window.api.winMin()                       // minimize
await window.api.winClose()                     // close

// Auth
await window.api.signInWithGoogle()             // → {ok, user}
await window.api.signOut()                      // → void
await window.api.getCurrentUser()               // → User | null
await window.api.checkStoredAuth()              // → {ok, user}

// Notifications
await window.api.getNotificationSettings()      // → Settings
await window.api.updateNotificationSettings(s)  // → void
await window.api.testNotification()             // → void

// Updates (Electron only)
await window.api.checkForUpdates()
await window.api.downloadAndInstall()
window.electronAPI.onUpdateAvailable(cb)
window.electronAPI.onUpdateProgress(cb)
window.electronAPI.onUpdateDownloaded(cb)
window.electronAPI.onAuthStateChanged(cb)
```

---

## Firebase / Firestore

**Config file:** `web/firebase-config.js` — **excluded from git**. Copy from `firebase-config.template.js` and fill in your project values.

**Firestore data model:**
```
/users/{userId}/tasks/{taskId}  ← all user task documents
```

**Security rules:** Each user can only read/write their own `/users/{uid}/**`.

**Authentication:**
- Web: `signInWithPopup()` (Google OAuth)
- Desktop: Browser-launched OAuth with local HTTP callback server (port varies)
- Anonymous auth is allowed only on localhost during development

---

## Theming

Styles use CSS variables — do not hardcode colors:
```css
--bg-primary, --bg-secondary, --bg-card
--text-primary, --text-secondary, --text-muted
--accent-color, --accent-hover
--border-color, --shadow
```

Theme (`dark` / `light`) is toggled via `document.body.setAttribute('data-theme', theme)` and persisted in `ui-prefs.json` (desktop) or `localStorage` (web).

---

## Tauri-specific Notes

- Tauri backend is in `src-tauri/src/main.rs`. All IPC handlers are registered in `main()` via `.invoke_handler(tauri::generate_handler![...])`.
- App state is managed with `tauri::State<Mutex<AppState>>`.
- File I/O uses Tauri's `$APPDATA` resolved path, not Node.js `app.getPath()`.
- Window size: 420×700 (min 380×500), `decorations: false` (custom title bar).
- Allowed APIs are allowlisted in `tauri.conf.json` → `tauri.allowlist`.

---

## CI/CD (GitHub Actions)

File: `.github/workflows/tauri-build.yml`

**Triggers:** push to `main`, any `v*` tag, PRs to `main`, manual dispatch.

**Matrix:** `windows-latest`, `macos-latest` (universal), `ubuntu-latest`.

**Secrets required:**
- `GH_TOKEN` — GitHub Personal Access Token with `repo` scope (for releases)
- `GITHUB_TOKEN` — provided automatically by Actions (for creating release assets)

Release artifacts:
- Windows: `.msi`
- macOS: `.dmg` + `.app`
- Linux: `.deb` + `.AppImage`

---

## Important Files Quick Reference

| File | Purpose |
|------|---------|
| `main.cjs` | Electron main process — window, IPC, local storage |
| `firebase-main.cjs` | Firebase auth + Firestore for desktop |
| `preload.cjs` | Electron context bridge (API exposed to renderer) |
| `tauri-preload.js` | Tauri compatibility shim (same API as preload.cjs) |
| `renderer/renderer.js` | All desktop UI logic — DOM, events, drag-drop |
| `renderer/styles.css` | Desktop styles + CSS variable theme system |
| `web/web-app.js` | Web app class — Firebase, auth, real-time sync |
| `web/sw.js` | Service worker — cache-first, offline support |
| `src-tauri/src/main.rs` | Tauri Rust backend — all IPC command handlers |
| `src-tauri/tauri.conf.json` | Tauri configuration — permissions, window, bundle |
| `increment-version.cjs` | Version bump utility (used by release scripts) |
| `.github/workflows/tauri-build.yml` | CI/CD pipeline |
| `TESTING_GUIDE.md` | Manual testing checklist (no automated tests) |
| `SETUP_INSTRUCTIONS.md` | Firebase + GitHub release setup |
| `TAURI_MIGRATION.md` | Electron → Tauri migration notes |

---

## What NOT to Do

- **Do not add a JS framework** (React, Vue, etc.) — intentionally vanilla
- **Do not add a bundler** (webpack, Vite) — scripts load directly
- **Do not commit `firebase-config.js`** — it contains secrets and is gitignored
- **Do not push release tags manually** — use `npm run release:*` scripts
- **Do not mix CJS and ESM** in the same file — follow the `.cjs`/`.js` extension convention
- **Do not hardcode colors** — use CSS variables for all theme-sensitive values
- **Do not duplicate API surface** — both preload files must stay in sync when adding new IPC calls

---

## Adding New Features — Checklist

When adding a new desktop feature:

1. **Tauri backend** (`src-tauri/src/main.rs`): Add a `#[tauri::command]` function and register it in `generate_handler![]`
2. **Electron backend** (`main.cjs`): Add a matching `ipcMain.handle('channel', ...)` handler
3. **Tauri preload** (`tauri-preload.js`): Expose via `window.api.newMethod = () => invoke('new_method')`
4. **Electron preload** (`preload.cjs`): Expose via `window.api.newMethod = () => ipcRenderer.invoke('channel')`
5. **Renderer** (`renderer/renderer.js`): Call `window.api.newMethod()` — works on both platforms
6. **Web** (`web/web-app.js`): Implement equivalent using Firebase SDK if applicable
7. Update `TESTING_GUIDE.md` with manual test steps

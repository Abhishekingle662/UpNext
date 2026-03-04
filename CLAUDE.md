# CLAUDE.md — UpNext Codebase Guide

> This file is intended for AI assistants (Claude, Copilot, etc.) to understand the codebase structure, conventions, and workflows before making changes.

---

## Project Overview

**UpNext** is a cross-platform task management application (v0.2.0) that runs as:
- A **desktop app** — implemented in **Tauri** (Rust + WebView, preferred and only desktop target)
- A **web app / PWA** — Firebase-hosted at https://upnext-97a2a.web.app

**Author:** Abhishek Ingle
**License:** MIT
**Tech:** Vanilla JavaScript (no framework), Rust (Tauri backend), Firebase (cloud sync)

> **Note:** The legacy Electron implementation has been removed. Tauri is the sole desktop framework.

---

## Repository Layout

```
UpNext/
├── tauri-preload.js           # Tauri API bridge (exposes window.api to renderer)
├── serve-web.js               # Simple HTTP server for local web testing
├── setup.js                   # Initial setup script (copies firebase-config template)
├── increment-version.cjs      # Version bumping — updates package.json, tauri.conf.json, Cargo.toml
│
├── renderer/                  # Desktop UI (loaded by Tauri WebView)
│   ├── index.html             # HTML structure — loads tauri-preload.js + renderer.js
│   ├── renderer.js            # UI logic (~500 lines)
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
└── *.md                       # Documentation files
```

---

## Technology Stack

| Layer | Desktop (Tauri) | Web |
|-------|----------------|-----|
| UI | `renderer/renderer.js` | `web/web-app.js` |
| Backend | `src-tauri/src/main.rs` (Rust) | Firebase SDK |
| API bridge | `tauri-preload.js` | N/A |
| Storage | `tasks.json` in `$APPDATA/` | Firestore + IndexedDB |
| Auth | Firebase SDK (via browser OAuth) | Firebase Auth (browser) |
| Sync | Firebase Firestore | Firebase Firestore |

**Key versions:**
- Node: 18+
- Tauri: v1.8.1 (Rust edition 2021, rust-version 1.60)
- Firebase SDK: v10.7.1 (modular)

---

## Development Commands

```bash
# Install dependencies
npm install

# --- Development ---
npm run tauri:dev      # Tauri desktop app with hot reload
npm run serve-web      # Web app at http://localhost:3000

# --- Building ---
npm run tauri:build    # Build Tauri installers → src-tauri/target/release/bundle/

# --- Releases ---
npm run release:patch  # Bump patch version, commit, and push (0.2.0 → 0.2.1)
npm run release:minor  # Bump minor version (0.2.0 → 0.3.0)
npm run release:major  # Bump major version (0.2.0 → 1.0.0)

# --- Utilities ---
npm run setup          # Copy firebase-config template for web app
```

**No automated test suite exists.** Testing is manual; see `TESTING_GUIDE.md`.

---

## Key Conventions

### File Extensions
- `.cjs` — CommonJS modules (Node utility scripts like `increment-version.cjs`). **Never use `import` here.**
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
// Shared across Tauri and Web
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

### Smart Parsing (built into main.rs)

**Priority** is stripped from the task title and stored separately:
```
"!!!" or "p1" or "urgent"/"high"/"critical"  → priority 3
"!!"  or "p2" or "medium"/"normal"            → priority 2
"!"   or "p3" or "low"/"minor"                → priority 1
```

**Due dates** are parsed from natural language at task creation:
```
"tomorrow 3pm"     → next day at 15:00
"next monday"      → following Monday
"in 2 days"        → 48 hours from now
"2024-12-25 14:30" → explicit datetime
```

---

## Desktop API Surface (window.api)

`tauri-preload.js` exposes `window.api` to `renderer.js` via Tauri's `invoke()` system.

```javascript
// Task CRUD
await window.api.loadTasks()                    // → Task[]
await window.api.createTask(title)              // → {ok, task}
await window.api.updateTask(id, patch)          // → {ok, task}
await window.api.deleteTask(id)                 // → {ok}
await window.api.clearCompleted()               // → void

// Window management
await window.api.togglePin()                    // → {pinned: boolean}
await window.api.getPin()                       // → {pinned: boolean}
await window.api.winMin()                       // minimize
await window.api.winClose()                     // close

// Auth (stubs — Firebase auth is handled in renderer via Firebase SDK)
await window.api.signInWithGoogle()             // → {error: 'use Firebase SDK'}
await window.api.signOut()                      // → {ok: true}
await window.api.getCurrentUser()               // → {user: null, showSignInButton: true}
await window.api.checkStoredAuth()              // → {hasStoredAuth: false}

// Notifications
await window.api.getNotificationSettings()      // → Settings
await window.api.updateNotificationSettings(s)  // → void
await window.api.testNotification()             // → void
```

> **Auth note:** The Tauri desktop app currently uses stub auth methods. Full Firebase auth for the desktop is implemented in the **web app** (`web/web-app.js`). The renderer handles auth UI for graceful degradation.

---

## Firebase / Firestore

**Config file:** `web/firebase-config.js` — **excluded from git**. Copy from `web/firebase-config.template.js` and fill in your project values.

**Firestore data model:**
```
/users/{userId}/tasks/{taskId}  ← all user task documents
```

**Security rules:** Each user can only read/write their own `/users/{uid}/**`.

**Authentication:**
- Web: `signInWithPopup()` (Google OAuth)
- Desktop: Directs user to the web app for sign-in

---

## Theming

Styles use CSS variables — do not hardcode colors:
```css
--bg-primary, --bg-secondary, --bg-card
--text-primary, --text-secondary, --text-muted
--accent-color, --accent-hover
--border-color, --shadow
```

Theme (`dark` / `light`) is toggled via `document.documentElement.classList.toggle('light', ...)` and persisted in `localStorage`.

---

## Tauri Backend Notes

- All IPC handlers live in `src-tauri/src/main.rs`, registered via `.invoke_handler(tauri::generate_handler![...])`.
- App state is managed with `tauri::State<Mutex<AppState>>`.
- File I/O resolves paths under `$APPDATA` — not Node.js paths.
- Window: 420×700 (min 380×500), `decorations: false` (custom title bar).
- API permissions are allowlisted in `tauri.conf.json` → `tauri.allowlist`.

### Adding a new IPC command

1. **Rust** (`src-tauri/src/main.rs`): Add `#[tauri::command] fn my_command(...)` and register in `generate_handler![]`
2. **Preload** (`tauri-preload.js`): Expose via `window.api.myCommand = () => invoke('my_command')`
3. **Renderer** (`renderer/renderer.js`): Call `await window.api.myCommand()`
4. **Web** (`web/web-app.js`): Implement equivalent using Firebase SDK if applicable
5. Update `TESTING_GUIDE.md` with manual test steps

---

## Version Management

Versions must stay in sync across three files — always use the release scripts, never edit manually:

| File | Field |
|------|-------|
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `package.version` |
| `src-tauri/Cargo.toml` | `version` |

`increment-version.cjs` updates all three atomically.

---

## CI/CD (GitHub Actions)

File: `.github/workflows/tauri-build.yml`

**Triggers:** push to `main`, any `v*` tag, PRs to `main`, manual dispatch.

**Matrix:** `windows-latest`, `macos-latest` (universal), `ubuntu-latest`.

**Secrets required:**
- `GH_TOKEN` — GitHub Personal Access Token with `repo` scope (for releases)
- `GITHUB_TOKEN` — provided automatically by Actions

Release artifacts:
- Windows: `.msi`
- macOS: `.dmg` + `.app`
- Linux: `.deb` + `.AppImage`

---

## Important Files Quick Reference

| File | Purpose |
|------|---------|
| `tauri-preload.js` | Tauri API bridge (exposes `window.api` to renderer) |
| `renderer/renderer.js` | All desktop UI logic — DOM, events, drag-drop |
| `renderer/styles.css` | Desktop styles + CSS variable theme system |
| `renderer/index.html` | HTML shell — loads preload + renderer |
| `web/web-app.js` | Web app class — Firebase, auth, real-time sync |
| `web/sw.js` | Service worker — cache-first, offline support |
| `src-tauri/src/main.rs` | Tauri Rust backend — all IPC command handlers |
| `src-tauri/tauri.conf.json` | Tauri configuration — permissions, window, bundle |
| `increment-version.cjs` | Version bump utility (updates all 3 version files) |
| `.github/workflows/tauri-build.yml` | CI/CD pipeline |
| `TESTING_GUIDE.md` | Manual testing checklist |
| `SETUP_INSTRUCTIONS.md` | Firebase + GitHub release setup |

---

## What NOT to Do

- **Do not add a JS framework** (React, Vue, etc.) — intentionally vanilla
- **Do not add a bundler** (webpack, Vite) — scripts load directly
- **Do not commit `web/firebase-config.js`** — it contains secrets and is gitignored
- **Do not re-introduce Electron** — Tauri is the sole desktop target
- **Do not push release tags manually** — use `npm run release:*` scripts
- **Do not mix CJS and ESM** in the same file — follow the `.cjs`/`.js` extension convention
- **Do not hardcode colors** — use CSS variables for all theme-sensitive values
- **Do not bump versions manually** — `increment-version.cjs` keeps all three config files in sync

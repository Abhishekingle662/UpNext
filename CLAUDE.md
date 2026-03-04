# CLAUDE.md — UpNext Codebase Guide

> This file is for AI assistants. Read it before making any changes.

---

## Project Overview

**UpNext** is a minimalist, always-on-top task manager (v0.1.0):
- **Desktop:** Tauri v1 (Rust backend + WebView, Windows/macOS/Linux)
- **Web / PWA:** Firebase-hosted at https://upnext-97a2a.web.app

**Author:** Abhishek Ingle | **License:** MIT | **Stack:** Vanilla JS, Rust, Firebase

---

## Repository Layout

```
UpNext/
├── tauri-preload.js           # Tauri IPC bridge → window.api
├── serve-web.js               # Local HTTP server for web dev (port 3000)
├── setup.js                   # One-time setup: copies firebase-config template
├── increment-version.cjs      # Version bumper (package.json + tauri.conf.json + Cargo.toml)
│
├── renderer/                  # Tauri desktop UI (loaded by WebView)
│   ├── index.html             # HTML shell — loads tauri-preload.js + renderer.js
│   ├── renderer.js            # All UI logic: tasks, drag-drop, theme, settings
│   └── styles.css             # CSS variables + component styles
│
├── web/                       # Web app / PWA (Firebase-hosted)
│   ├── index.html             # HTML with PWA meta + Firebase import map
│   ├── web-app.js             # Firebase auth + Firestore sync + full UI
│   ├── web-styles.css         # Web-specific styles (mirrors desktop design)
│   ├── sw.js                  # Service worker — cache-first offline support
│   ├── manifest.json          # PWA manifest
│   └── firebase-config.js     # NOT in git — copy from firebase-config.template.js
│
├── src-tauri/
│   ├── src/main.rs            # Rust: all IPC handlers, smart parsing, file I/O
│   ├── Cargo.toml             # Rust deps: tauri 1.8, serde, chrono
│   ├── tauri.conf.json        # Window config, allowlist, bundle settings
│   └── build.rs               # Required by tauri-build
│
├── assets/                    # App icons (ico, png, icns)
└── .github/workflows/
    └── tauri-build.yml        # CI/CD: Win/macOS/Linux builds on push/tag
```

---

## Technology Stack

| Layer | Desktop | Web |
|-------|---------|-----|
| UI logic | `renderer/renderer.js` | `web/web-app.js` |
| Backend | `src-tauri/src/main.rs` (Rust) | Firebase SDK (JS) |
| IPC bridge | `tauri-preload.js` → `window.api` | N/A |
| Storage | `tasks.json` in `$APPDATA/` | Firestore + IndexedDB |
| Auth | Stub (directs to web app) | Google OAuth via Firebase |
| Sync | Firebase Firestore | Firebase Firestore |

**Key versions:** Node 18+, Tauri 1.8.1, Firebase SDK 10.7.1

---

## Development Commands

```bash
npm install            # Install dependencies

npm run tauri:dev      # Desktop app with hot reload
npm run serve-web      # Web app at http://localhost:3000
npm run tauri:build    # Build installers → src-tauri/target/release/bundle/

npm run setup          # Copy web/firebase-config template (run once)

npm run release:patch  # Bump version, commit, push (0.1.0 → 0.1.1)
npm run release:minor  # 0.1.0 → 0.2.0
npm run release:major  # 0.1.0 → 1.0.0
```

No automated tests — see manual testing checklist in `TESTING_GUIDE.md` (if present).

---

## Key Conventions

### File extensions
- `.cjs` — CommonJS (Node scripts like `increment-version.cjs`). Use `require()`.
- `.js`  — ES Modules (`"type": "module"` in package.json). Use `import/export`.
- `.rs`  — Rust (Tauri backend only).

### JavaScript style
- **No framework.** Vanilla ES6+ throughout.
- **No bundler.** Scripts load directly from disk.
- DOM helper: `const $ = (sel) => document.querySelector(sel)`
- `async/await` with `try/catch` for all IPC calls.

### Naming
- JS: `camelCase` for functions and variables.
- Rust: `snake_case` for functions and fields.
- Prefix functions with verbs: `loadTasks`, `createTask`, `togglePin`, `applyTheme`.
- DOM data attributes: `data-role="title"`, `data-role="check"`, `data-id="<taskId>"`.

---

## Task Data Shape

```typescript
interface Task {
  id:        string;   // "t<timestamp>" (desktop) or Firestore doc ID (web)
  title:     string;
  completed: boolean;
  createdAt: number;   // Unix ms
  updatedAt: number;   // Unix ms
  dueAt?:    number;   // Unix ms — parsed from natural language
  priority?: number;   // 1=low, 2=medium, 3=high — parsed from markers
  order?:    number;   // drag-drop sort index
}
```

---

## Smart Parsing

Both `src-tauri/src/main.rs` (Rust) and `web/web-app.js` (JS) implement the same logic:

**Priority** — stripped from the title:
```
!!!        → priority 3 (high)
!!         → priority 2 (medium)
!          → priority 1 (low)
p1/p2/p3   → maps to 3/2/1
urgent/asap/critical → 3  |  medium/normal → 2  |  low/minor → 1
```

**Due date** — stripped from the title:
```
tomorrow [time]    → next day at 09:00 (or specified time)
today [time]       → today at current/specified time
next monday        → next Monday at 09:00
this friday        → this Friday at 09:00
in 2 days          → 48 hours from now
in 3 hours         → 3 hours from now
2025-12-25         → Dec 25 at 09:00
2025-12-25 14:30   → Dec 25 at 14:30
```

---

## Desktop API Surface (`window.api`)

Defined in `tauri-preload.js`, backed by `#[tauri::command]` functions in `main.rs`:

```javascript
// Tasks
window.api.loadTasks()                    // → Task[]
window.api.createTask(title)              // → Task  (runs smart parsing)
window.api.updateTask(id, patch)          // → Task
window.api.deleteTask(id)                 // → void
window.api.clearCompleted()               // → void
window.api.reorderTasks(orderedIds)       // → void  (batch order update)

// Window
window.api.togglePin()                    // → { pinned: boolean }
window.api.getPin()                       // → { pinned: boolean }
window.api.winMinimize()                  // → void
window.api.winClose()                     // → void

// Preferences
window.api.getUiPrefs()                   // → { theme: 'dark' | 'light' }
window.api.setUiPrefs(prefs)              // → void

// Notifications
window.api.getNotificationSettings()      // → NotificationSettings
window.api.updateNotificationSettings(s)  // → void
window.api.testNotification()             // → void
```

---

## Adding a New IPC Command

1. **Rust** (`src-tauri/src/main.rs`): add `#[tauri::command] async fn my_cmd(...)` and register it in `tauri::generate_handler![..., my_cmd]`
2. **Preload** (`tauri-preload.js`): add `window.api.myCmd = (...) => invoke('my_cmd', { ... })`
3. **Renderer** (`renderer/renderer.js`): call `await window.api.myCmd(...)`
4. **Web** (`web/web-app.js`): add equivalent Firebase SDK logic if applicable

---

## Version Management

Three files must stay in sync — **always use the release scripts**:

| File | Field |
|------|-------|
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `package.version` |
| `src-tauri/Cargo.toml` | `version` |

`increment-version.cjs` updates all three atomically.

---

## Firebase / Firestore

**Config:** `web/firebase-config.js` — **gitignored**. Copy from `firebase-config.template.js`.

**Data model:**
```
/users/{uid}/tasks/{taskId}   ← all task documents
```

**Auth:** Google OAuth via `signInWithPopup()`. Each user can only access their own data.

---

## Theming

CSS variables only — never hardcode colors:
```css
--bg, --bg-2, --bg-3, --border
--text, --text-2
--accent, --accent-dim, --danger
--badge-high, --badge-med, --badge-low, --badge-due, --badge-overdue
```

Toggle: set `data-theme="dark"|"light"` on `<html>`. Persisted in `ui-prefs.json` (desktop) or `localStorage` (web).

---

## What NOT to Do

- **No JS framework** (React, Vue, Svelte) — intentionally vanilla
- **No bundler** (webpack, Vite) — scripts load directly from disk
- **No committing `firebase-config.js`** — contains secrets
- **No re-introducing Electron** — Tauri is the only desktop target
- **No manual version bumps** — use `increment-version.cjs`
- **No hardcoded colors** — use CSS variables
- **No mismatching IPC** — every `invoke('cmd')` in preload needs a `#[tauri::command] fn cmd` in Rust

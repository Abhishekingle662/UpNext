# UpNext

An always‑on‑top, minimalist to‑do app that keeps tasks visible so you capture and finish work faster.

## Features
- Always‑on‑top toggle (pin) for true focus
- Quick add, complete, edit (double‑click), and delete tasks
- Clear completed in one click
- Light/Dark theme with persistence
- Resizable, movable frameless window

## Run locally
```powershell
npm install
npm start
```

## Build (Windows)
```powershell
# one‑time
npm install

# build installer
npm run dist
```
The installer (.exe) will be in the `dist` folder.

## Project structure
- `main.js` — Electron main process (window + IPC)
- `preload.cjs` — secure bridge exposing `window.api`
- `renderer/` — UI (HTML/CSS/JS)

## Notes
- Tasks are stored per‑user in the app data directory (`tasks.json`).
- `.gitignore` excludes `node_modules` and binaries from Git.

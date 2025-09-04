import { app, BrowserWindow, ipcMain, nativeTheme, dialog } from 'electron';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';


let win;
const isDev = !app.isPackaged;
const tasksFile = () => path.join(app.getPath('userData'), 'tasks.json');
const boundsFile = () => path.join(app.getPath('userData'), 'window-bounds.json');
const uiPrefsPath = () => path.join(app.getPath('userData'), 'ui-prefs.json');


async function ensureTasksFile() {
try { await fs.access(tasksFile()); }
catch { await fs.writeFile(tasksFile(), '[]', 'utf-8'); }
}


async function readTasks() {
await ensureTasksFile();
const raw = await fs.readFile(tasksFile(), 'utf-8');
try { return JSON.parse(raw); } catch { return []; }
}


async function writeTasks(tasks) {
await fs.writeFile(tasksFile(), JSON.stringify(tasks, null, 2), 'utf-8');
}


// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readBounds() {
	try {
		const raw = await fs.readFile(boundsFile(), 'utf-8');
		const b = JSON.parse(raw);
		if (!b || typeof b !== 'object') return null;
		return b;
	} catch { return null; }
}

async function writeBounds(bounds) {
	try { await fs.writeFile(boundsFile(), JSON.stringify(bounds), 'utf-8'); } catch {}
}

async function readUIPrefs() {
	try {
		const raw = await fs.readFile(uiPrefsPath(), 'utf-8');
		return JSON.parse(raw) || {};
	} catch { return {}; }
}

async function writeUIPrefs(prefs) {
	try { await fs.writeFile(uiPrefsPath(), JSON.stringify(prefs, null, 2), 'utf-8'); } catch {}
}

async function createWindow() {
	const saved = await readBounds();
	win = new BrowserWindow({
		width: saved?.width || 360,
		height: saved?.height || 520,
		x: saved?.x,
		y: saved?.y,
		minWidth: 300,
		minHeight: 380,
		resizable: true,
		maximizable: true,
		...(process.platform === 'win32' ? { thickFrame: true } : {}),
		center: saved ? false : true,
		show: true,
		frame: false, // clean floating look
		transparent: false,
		alwaysOnTop: false, // default unpinned; toggle via button
		icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
		vibrancy: process.platform === 'darwin' ? 'window' : undefined,
		visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
			webPreferences: {
				preload: path.join(__dirname, 'preload.cjs'),
			nodeIntegration: false,
			contextIsolation: true,
				sandbox: false,
			spellcheck: false
		}
	});

		if (isDev) win.webContents.openDevTools({ mode: 'detach' });

	win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

		win.on('close', () => {
			try {
				const b = win.getBounds();
				writeBounds(b);
			} catch {}
		});
}

// App lifecycle
app.whenReady().then(async () => {
	// Prefer system theme on first run
	try {
		const prefs = await readUIPrefs();
		if (!prefs.theme) {
			const isLight = nativeTheme.shouldUseDarkColors === false;
			prefs.theme = isLight ? 'light' : 'dark';
			await writeUIPrefs(prefs);
		}
	} catch {}

	await createWindow();

	// One-time welcome note after install/first run
	try {
		const prefs = await readUIPrefs();
		if (!prefs.welcomeShown) {
			prefs.welcomeShown = true;
			await writeUIPrefs(prefs);
			await dialog.showMessageBox(win, {
				type: 'info',
				title: 'Welcome to UpNext',
				message: 'Quick start',
				detail: [
					'• Add a task and press Enter',
					'• Double‑click to rename; click the checkbox to complete',
					'• 📌 pins the window on top; Clear Completed removes done items',
						'• Drag the top bar to move; resize from edges; 🌗 toggles theme',
						'• Voice mode is coming soon!!'

            
				].join('\n'),
				buttons: ['Got it']
			});
		}
	} catch {}

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});


// IPC — tasks CRUD
ipcMain.handle('tasks:load', async () => {
const tasks = await readTasks();
// sort: incomplete first, then recent
tasks.sort((a, b) => Number(a.completed) - Number(b.completed) || (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
return tasks;
});


ipcMain.handle('tasks:create', async (_evt, title) => {
const t = title?.trim();
if (!t) return { ok: false, error: 'empty' };
const tasks = await readTasks();
const task = { id: crypto.randomUUID(), title: t, completed: false, createdAt: Date.now() };
tasks.unshift(task);
await writeTasks(tasks);
return { ok: true, task };
});


ipcMain.handle('tasks:update', async (_evt, { id, patch }) => {
const tasks = await readTasks();
const i = tasks.findIndex(t => t.id === id);
if (i === -1) return { ok: false, error: 'not_found' };
const prev = tasks[i];
const next = { ...prev, ...patch, updatedAt: Date.now() };
if (patch?.completed === true && !prev.completed) next.completedAt = Date.now();
if (patch?.completed === false) delete next.completedAt;
tasks[i] = next;
await writeTasks(tasks);
return { ok: true, task: next };
});


ipcMain.handle('tasks:delete', async (_evt, id) => {
	const tasks = await readTasks();
	const next = tasks.filter(t => t.id !== id);
	await writeTasks(next);
	return { ok: true };
});

// Clear completed tasks
ipcMain.handle('tasks:clearCompleted', async () => {
	const tasks = await readTasks();
	const next = tasks.filter(t => !t.completed);
	const removed = tasks.length - next.length;
	await writeTasks(next);
	return { ok: true, removed };
});

// Window controls
ipcMain.handle('window:togglePin', () => {
	if (!win) return { pinned: false };
	const pinned = !win.isAlwaysOnTop();
	// Use a level to ensure it stays above normal windows
	win.setAlwaysOnTop(pinned, 'screen-saver');
	return { pinned };
});

ipcMain.handle('window:close', () => { win?.close(); });
ipcMain.handle('window:minimize', () => { win?.minimize(); });

// Query current pin state
ipcMain.handle('window:getPin', () => ({ pinned: !!win?.isAlwaysOnTop() }));
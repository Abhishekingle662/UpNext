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

// Reduce noisy Chromium logs and avoid cache write failures
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-dev-shm-usage');


// --- Metadata parsing: due time and priority ---
function parsePriorityFromTitle(title) {
	if (!title) return 0;
	const t = String(title);
	// Exclamation-based: !!! > !! > !
	if (/!!!/.test(t)) return 3;
	if (/!!/.test(t)) return 2;
	if (/(^|\s)!($|\s)/.test(` ${t} `)) return 1;
	// Words: urgent/high/medium/low
	if (/\b(urgent|asap|critical|high)\b/i.test(t)) return 3;
	if (/\b(medium|normal)\b/i.test(t)) return 2;
	if (/\b(low|minor)\b/i.test(t)) return 1;
	// P-levels: p1/p2/p3 (p1 highest)
	const p = t.match(/\bp([123])\b/i);
	if (p) {
		const n = Number(p[1]);
		return n === 1 ? 3 : n === 2 ? 2 : 1;
	}
	return 0;
}

function parseDueFromTitle(title, nowTs = Date.now()) {
	if (!title) return null;
	const t = String(title);
	const now = new Date(nowTs);
	let year = now.getFullYear();
	let month = now.getMonth();
	let date = now.getDate();
	let hours = 9; // default hour if only day is specified
	let minutes = 0;
	let matched = false;

	function buildTs(y, m, d, h, min) {
		const dt = new Date(y, m, d, h, min, 0, 0);
		return Number.isNaN(dt.getTime()) ? null : dt.getTime();
	}

	// ISO-like date: YYYY-MM-DD [HH[:MM]] [am|pm]
	let m = t.match(/\b(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i);
	if (m) {
		year = Number(m[1]);
		month = Number(m[2]) - 1;
		date = Number(m[3]);
		if (m[4]) {
			hours = Number(m[4]);
			minutes = m[5] ? Number(m[5]) : 0;
			if (m[6]) {
				const ampm = m[6].toLowerCase();
				if (ampm === 'pm' && hours < 12) hours += 12;
				if (ampm === 'am' && hours === 12) hours = 0;
			}
		} else {
			hours = 9; minutes = 0;
		}
		const ts = buildTs(year, month, date, hours, minutes);
		return ts;
	}

	// Explicit time today: e.g., 3pm, 3:30pm, 15:00
	m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
	if (m) {
		hours = Number(m[1]); minutes = m[2] ? Number(m[2]) : 0;
		const ampm = m[3].toLowerCase();
		if (ampm === 'pm' && hours < 12) hours += 12;
		if (ampm === 'am' && hours === 12) hours = 0;
		let ts = buildTs(year, month, date, hours, minutes);
		if (ts && ts < nowTs) {
			// roll to next day if time already passed
			const dt = new Date(ts);
			dt.setDate(dt.getDate() + 1);
			ts = dt.getTime();
		}
		return ts;
	}

	// 24h time like 14:30 today
	m = t.match(/\b(\d{1,2}):(\d{2})\b/);
	if (m) {
		hours = Number(m[1]); minutes = Number(m[2]);
		let ts = buildTs(year, month, date, hours, minutes);
		if (ts && ts < nowTs) {
			const dt = new Date(ts);
			dt.setDate(dt.getDate() + 1);
			ts = dt.getTime();
		}
		return ts;
	}

	// Relative days: "in 3 days", "3 days later/from now"
	m = t.match(/\b(?:in\s+)?(\d{1,3})\s+days?\b(?:\s*(?:later|from\s+now))?/i);
	if (m) {
		const add = Number(m[1]);
		const dt = new Date(year, month, date, hours, minutes, 0, 0);
		dt.setDate(dt.getDate() + add);
		return dt.getTime();
	}

	// Full weekday names: monday..sunday (next occurrence); support optional "next <weekday>"
	let w = t.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
	if (!w) w = t.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
	if (w) {
		const weekdayFullMap = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
		const target = weekdayFullMap[w[1].toLowerCase()];
		const cur = now.getDay();
		let delta = (target - cur + 7) % 7;
		const explicitNext = /^next\s+/i.test(w[0]);
		if (explicitNext) {
			if (delta === 0) delta = 7; // force next week
		} else {
			if (delta === 0 && buildTs(year, month, date, hours, minutes) < nowTs) delta = 7;
		}
		const dt = new Date(year, month, date, hours, minutes, 0, 0);
		dt.setDate(dt.getDate() + delta);
		return dt.getTime();
	}

	// Abbrev weekday names: mon..sun (next occurrence)
	if (/\btoday\b/i.test(t)) {
		return buildTs(year, month, date, hours, minutes);
	}
	if (/\btomorrow\b/i.test(t)) {
		const dt = new Date(year, month, date, hours, minutes, 0, 0);
		dt.setDate(dt.getDate() + 1);
		return dt.getTime();
	}

	// Abbrev weekday names: mon..sun (next occurrence)
	const weekdayMap = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
	m = t.match(/\b(sun|mon|tue|wed|thu|fri|sat)\b/i);
	if (m) {
		const target = weekdayMap[m[1].toLowerCase()];
		const cur = now.getDay();
		let delta = (target - cur + 7) % 7;
		if (delta === 0 && buildTs(year, month, date, hours, minutes) < nowTs) delta = 7;
		const dt = new Date(year, month, date, hours, minutes, 0, 0);
		dt.setDate(dt.getDate() + delta);
		return dt.getTime();
	}

	return null;
}

function enrichTaskMeta(task) {
	const dueAt = parseDueFromTitle(task.title);
	const priority = parsePriorityFromTitle(task.title);
	return { ...task, dueAt: dueAt ?? null, priority: priority ?? 0 };
}

function sortTasksForDisplay(tasks) {
	return tasks.sort((a, b) => {
		// Completed tasks go to bottom
		const byCompleted = Number(a.completed) - Number(b.completed);
		if (byCompleted) return byCompleted;
		
		// For incomplete tasks, use manual order (lower order = higher priority)
		const aOrder = Number(a.order ?? 999999);
		const bOrder = Number(b.order ?? 999999);
		if (aOrder !== bOrder) return aOrder - bOrder;
		
		// Fallback to creation time for tasks without order
		return (a.createdAt || 0) - (b.createdAt || 0);
	});
}

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
const raw = await readTasks();
// Enrich with derived meta for UI and sort with due/priority
const enriched = raw.map(enrichTaskMeta);
sortTasksForDisplay(enriched);
return enriched;
});


ipcMain.handle('tasks:create', async (_evt, title) => {
const t = title?.trim();
if (!t) return { ok: false, error: 'empty' };
const tasks = await readTasks();
const meta = { dueAt: parseDueFromTitle(t), priority: parsePriorityFromTitle(t) };
// New tasks get order 0 (highest priority), shift others down
const task = { id: crypto.randomUUID(), title: t, completed: false, createdAt: Date.now(), order: 0, ...meta };
// Increment order of existing incomplete tasks
tasks.forEach(t => { if (!t.completed) t.order = (t.order || 0) + 1; });
tasks.unshift(task);
await writeTasks(tasks);
return { ok: true, task };
});


ipcMain.handle('tasks:update', async (_evt, { id, patch }) => {
const tasks = await readTasks();
const i = tasks.findIndex(t => t.id === id);
if (i === -1) return { ok: false, error: 'not_found' };
const prev = tasks[i];
let next = { ...prev, ...patch, updatedAt: Date.now() };
// If title changed, recompute meta; allow explicit meta override via patch
if (Object.prototype.hasOwnProperty.call(patch || {}, 'title')) {
	const meta = { dueAt: parseDueFromTitle(next.title), priority: parsePriorityFromTitle(next.title) };
	next = { ...next, ...meta };
}
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
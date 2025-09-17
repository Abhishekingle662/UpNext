const { app, BrowserWindow, ipcMain, nativeTheme, dialog, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs').promises;
const crypto = require('node:crypto');
const { firebaseMainService } = require('./firebase-main.cjs');


let win;
let alertTimer;
let notificationSettings = {
	enabled: true,
	beforeMinutes: [0, 5, 15], // Alert at due time, 5 min before, 15 min before
	sound: true,
	showInTray: true
};
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
// __dirname is available in CommonJS
// const __dirname = path.dirname(__filename); // Not needed in CommonJS

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

// --- Alert System ---
async function readNotificationSettings() {
	try {
		const settingsPath = path.join(app.getPath('userData'), 'notification-settings.json');
		const raw = await fs.readFile(settingsPath, 'utf-8');
		return { ...notificationSettings, ...JSON.parse(raw) };
	} catch {
		return notificationSettings;
	}
}

async function writeNotificationSettings(settings) {
	try {
		const settingsPath = path.join(app.getPath('userData'), 'notification-settings.json');
		await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
		notificationSettings = { ...notificationSettings, ...settings };
	} catch (error) {
		console.error('Failed to save notification settings:', error);
	}
}

function showTaskAlert(task, minutesBefore = 0) {
	if (!notificationSettings.enabled) return;
	
	const title = minutesBefore > 0 
		? `Task Due in ${minutesBefore} minutes`
		: 'Task is Due Now!';
	
	const body = task.title.length > 60 
		? task.title.substring(0, 60) + '...'
		: task.title;
	
	const priorityEmoji = task.priority === 3 ? '🔴' : task.priority === 2 ? '🟡' : task.priority === 1 ? '🔵' : '';
	
	const notification = new Notification({
		title: `${priorityEmoji} ${title}`.trim(),
		body: body,
		icon: path.join(__dirname, 'assets', 'icon.ico'),
		urgency: task.priority >= 2 ? 'critical' : 'normal',
		timeoutType: task.priority >= 2 ? 'never' : 'default',
		actions: minutesBefore === 0 ? [
			{ type: 'button', text: 'Mark Complete' },
			{ type: 'button', text: 'Snooze 10min' }
		] : [
			{ type: 'button', text: 'Show App' }
		]
	});
	
	notification.on('click', () => {
		if (win) {
			win.show();
			win.focus();
		}
	});
	
	notification.on('action', (event, index) => {
		if (minutesBefore === 0) {
			if (index === 0) {
				// Mark complete
				handleMarkTaskComplete(task.id);
			} else if (index === 1) {
				// Snooze 10 minutes
				handleSnoozeTask(task.id, 10);
			}
		} else {
			// Show app
			if (win) {
				win.show();
				win.focus();
			}
		}
	});
	
	notification.show();
}

async function handleMarkTaskComplete(taskId) {
	try {
		// Update via existing IPC handler logic
		const tasks = await readTasks();
		const taskIndex = tasks.findIndex(t => t.id === taskId);
		if (taskIndex !== -1) {
			tasks[taskIndex].completed = true;
			tasks[taskIndex].completedAt = Date.now();
			await writeTasks(tasks);
			
			// Also try Firebase if available
			try {
				await firebaseMainService.updateTask(taskId, { completed: true, completedAt: Date.now() });
			} catch (error) {
				console.log('Firebase update failed (notification), continuing with local:', error.message);
			}
			
			// Notify renderer
			if (win) {
				win.webContents.send('tasks:updated');
			}
		}
	} catch (error) {
		console.error('Failed to complete task from notification:', error);
	}
}

async function handleSnoozeTask(taskId, minutes) {
	try {
		const tasks = await readTasks();
		const taskIndex = tasks.findIndex(t => t.id === taskId);
		if (taskIndex !== -1) {
			const task = tasks[taskIndex];
			const newDueTime = (task.dueAt || Date.now()) + (minutes * 60 * 1000);
			
			// Update title to reflect new time
			let newTitle = task.title;
			const now = new Date(newDueTime);
			const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			
			// Remove existing time patterns and add new one
			newTitle = newTitle.replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '').trim();
			newTitle += ` ${timeStr.toLowerCase()}`;
			
			tasks[taskIndex].title = newTitle;
			tasks[taskIndex].dueAt = newDueTime;
			tasks[taskIndex].updatedAt = Date.now();
			
			await writeTasks(tasks);
			
			// Also try Firebase if available
			try {
				await firebaseMainService.updateTask(taskId, { 
					title: newTitle,
					dueAt: newDueTime, 
					updatedAt: Date.now() 
				});
			} catch (error) {
				console.log('Firebase update failed (snooze), continuing with local:', error.message);
			}
			
			// Notify renderer
			if (win) {
				win.webContents.send('tasks:updated');
			}
		}
	} catch (error) {
		console.error('Failed to snooze task:', error);
	}
}

async function checkDueTasks() {
	if (!notificationSettings.enabled) return;
	
	try {
		let tasks = [];
		
		// Try Firebase first, fallback to local
		try {
			tasks = await firebaseMainService.loadTasks();
		} catch (error) {
			console.log('Firebase check failed, using local tasks:', error.message);
			tasks = await readTasks();
		}
		
		const now = Date.now();
		const alertedTasksKey = 'alertedTasks_' + new Date().toDateString();
		const alertedTasksPath = path.join(app.getPath('temp'), alertedTasksKey + '.json');
		
		let alertedTasks = {};
		try {
			const alertedData = await fs.readFile(alertedTasksPath, 'utf-8');
			alertedTasks = JSON.parse(alertedData);
		} catch {
			alertedTasks = {};
		}
		
		for (const task of tasks) {
			if (!task.dueAt || task.completed) continue;
			
			const timeToDue = task.dueAt - now;
			const taskAlertKey = `${task.id}_${task.dueAt}`;
			
			// Check each alert time
			for (const beforeMinutes of notificationSettings.beforeMinutes) {
				const alertTime = beforeMinutes * 60 * 1000; // Convert to milliseconds
				const alertKey = `${taskAlertKey}_${beforeMinutes}`;
				
				// Skip if already alerted for this specific time
				if (alertedTasks[alertKey]) continue;
				
				// Check if it's time to alert
				if (beforeMinutes === 0) {
					// Alert when due (within 1 minute window)
					if (timeToDue <= 60000 && timeToDue >= -60000) {
						showTaskAlert(task, 0);
						alertedTasks[alertKey] = true;
					}
				} else {
					// Alert before due time (within 1 minute window)
					if (timeToDue <= (alertTime + 60000) && timeToDue >= (alertTime - 60000)) {
						showTaskAlert(task, beforeMinutes);
						alertedTasks[alertKey] = true;
					}
				}
			}
		}
		
		// Save updated alerted tasks
		try {
			await fs.writeFile(alertedTasksPath, JSON.stringify(alertedTasks), 'utf-8');
		} catch (error) {
			console.warn('Failed to save alerted tasks:', error);
		}
		
		// Clean up old alerted task files (older than 7 days)
		try {
			const tempDir = app.getPath('temp');
			const files = await fs.readdir(tempDir);
			const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
			
			for (const file of files) {
				if (file.startsWith('alertedTasks_') && file.endsWith('.json')) {
					const filePath = path.join(tempDir, file);
					const stats = await fs.stat(filePath);
					if (stats.mtime.getTime() < sevenDaysAgo) {
						await fs.unlink(filePath);
					}
				}
			}
		} catch (error) {
			console.warn('Failed to cleanup old alerted tasks:', error);
		}
		
	} catch (error) {
		console.error('Error checking due tasks:', error);
	}
}

function startAlertTimer() {
	if (alertTimer) clearInterval(alertTimer);
	
	// Check every minute
	alertTimer = setInterval(checkDueTasks, 60000);
	
	// Also check immediately
	setTimeout(checkDueTasks, 2000); // Wait 2 seconds after startup
}

function stopAlertTimer() {
	if (alertTimer) {
		clearInterval(alertTimer);
		alertTimer = null;
	}
}

// Auto-updater configuration
function setupAutoUpdater() {
	// Configure auto-updater
	autoUpdater.logger = console;
	autoUpdater.logger.transports.file.level = 'info';
	
	// Auto-updater events
	autoUpdater.on('checking-for-update', () => {
		console.log('Checking for update...');
	});

	autoUpdater.on('update-available', (info) => {
		console.log('Update available.');
		if (win) {
			win.webContents.send('update-available', info);
		}
	});

	autoUpdater.on('update-not-available', (info) => {
		console.log('Update not available.');
	});

	autoUpdater.on('error', (err) => {
		console.log('Error in auto-updater: ' + err);
	});

	autoUpdater.on('download-progress', (progressObj) => {
		let log_message = `Download speed: ${progressObj.bytesPerSecond}`;
		log_message = `${log_message} - Downloaded ${progressObj.percent}%`;
		log_message = `${log_message} (${progressObj.transferred}/${progressObj.total})`;
		console.log(log_message);
		
		if (win) {
			win.webContents.send('update-progress', progressObj);
		}
	});

	autoUpdater.on('update-downloaded', (info) => {
		console.log('Update downloaded');
		if (win) {
			win.webContents.send('update-downloaded', info);
		}
	});
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
	// Initialize Firebase
	try {
		const firebaseInitialized = await firebaseMainService.initialize();
		if (!firebaseInitialized) {
			console.warn('Firebase initialization failed, falling back to local storage');
		}
	} catch (error) {
		console.error('Firebase initialization error:', error);
	}

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
	
	// Setup auto-updater
	setupAutoUpdater();
	
	// Check for updates after a delay (only in production)
	if (!isDev) {
		setTimeout(() => {
			autoUpdater.checkForUpdatesAndNotify();
		}, 5000); // Check 5 seconds after startup
	}
	
	// Load notification settings and start alert system
	notificationSettings = await readNotificationSettings();
	startAlertTimer();

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
	try {
		// Try Firebase first
		const tasks = await firebaseMainService.loadTasks();
		// Enrich with derived meta for UI and sort with due/priority
		const enriched = tasks.map(enrichTaskMeta);
		sortTasksForDisplay(enriched);
		return enriched;
	} catch (error) {
		console.error('Firebase load failed, falling back to local storage:', error);
		// Fallback to local storage
		const raw = await readTasks();
		const enriched = raw.map(enrichTaskMeta);
		sortTasksForDisplay(enriched);
		return enriched;
	}
});


ipcMain.handle('tasks:create', async (_evt, title) => {
	const t = title?.trim();
	if (!t) return { ok: false, error: 'empty' };
	
	try {
		const meta = { dueAt: parseDueFromTitle(t), priority: parsePriorityFromTitle(t) };
		const taskData = { 
			title: t, 
			completed: false, 
			createdAt: Date.now(), 
			order: 0, 
			...meta 
		};
		
		// Try Firebase first
		const task = await firebaseMainService.createTask(taskData);
		return { ok: true, task };
	} catch (error) {
		console.error('Firebase create failed, falling back to local storage:', error);
		// Fallback to local storage
		const tasks = await readTasks();
		const meta = { dueAt: parseDueFromTitle(t), priority: parsePriorityFromTitle(t) };
		const task = { id: crypto.randomUUID(), title: t, completed: false, createdAt: Date.now(), order: 0, ...meta };
		tasks.forEach(t => { if (!t.completed) t.order = (t.order || 0) + 1; });
		tasks.unshift(task);
		await writeTasks(tasks);
		return { ok: true, task };
	}
});


ipcMain.handle('tasks:update', async (_evt, { id, patch }) => {
	try {
		// Try Firebase first
		let updateData = { ...patch };
		
		// If title changed, recompute meta
		if (Object.prototype.hasOwnProperty.call(patch || {}, 'title')) {
			const meta = { dueAt: parseDueFromTitle(patch.title), priority: parsePriorityFromTitle(patch.title) };
			updateData = { ...updateData, ...meta };
		}
		
		// Handle completion timestamps
		if (patch?.completed === true) updateData.completedAt = Date.now();
		if (patch?.completed === false) delete updateData.completedAt;
		
		const task = await firebaseMainService.updateTask(id, updateData);
		return { ok: true, task };
	} catch (error) {
		console.error('Firebase update failed, falling back to local storage:', error);
		// Fallback to local storage
		const tasks = await readTasks();
		const i = tasks.findIndex(t => t.id === id);
		if (i === -1) return { ok: false, error: 'not_found' };
		const prev = tasks[i];
		let next = { ...prev, ...patch, updatedAt: Date.now() };
		if (Object.prototype.hasOwnProperty.call(patch || {}, 'title')) {
			const meta = { dueAt: parseDueFromTitle(next.title), priority: parsePriorityFromTitle(next.title) };
			next = { ...next, ...meta };
		}
		if (patch?.completed === true && !prev.completed) next.completedAt = Date.now();
		if (patch?.completed === false) delete next.completedAt;
		tasks[i] = next;
		await writeTasks(tasks);
		return { ok: true, task: next };
	}
});


ipcMain.handle('tasks:delete', async (_evt, id) => {
	try {
		// Try Firebase first
		await firebaseMainService.deleteTask(id);
		return { ok: true };
	} catch (error) {
		console.error('Firebase delete failed, falling back to local storage:', error);
		// Fallback to local storage
		const tasks = await readTasks();
		const next = tasks.filter(t => t.id !== id);
		await writeTasks(next);
		return { ok: true };
	}
});

// Clear completed tasks
ipcMain.handle('tasks:clearCompleted', async () => {
	try {
		// Try Firebase first
		const removed = await firebaseMainService.clearCompleted();
		return { ok: true, removed };
	} catch (error) {
		console.error('Firebase clear completed failed, falling back to local storage:', error);
		// Fallback to local storage
		const tasks = await readTasks();
		const next = tasks.filter(t => !t.completed);
		const removed = tasks.length - next.length;
		await writeTasks(next);
		return { ok: true, removed };
	}
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

// Authentication handlers
ipcMain.handle('auth:signInWithGoogle', async () => {
	try {
		const user = await firebaseMainService.signInWithGoogle();
		return { 
			success: true, 
			user: {
				uid: user.uid,
				email: user.email,
				displayName: user.displayName,
				photoURL: user.photoURL,
				isAnonymous: user.isAnonymous
			}
		};
	} catch (error) {
		console.error('Google sign-in failed in main process:', error);
		return { success: false, error: error.message };
	}
});

ipcMain.handle('auth:signOut', async () => {
	try {
		await firebaseMainService.signOut();
		return { success: true };
	} catch (error) {
		console.error('Sign out failed in main process:', error);
		return { success: false, error: error.message };
	}
});

ipcMain.handle('auth:getCurrentUser', async () => {
	try {
		const user = firebaseMainService.user;
		const isProduction = process.env.NODE_ENV === 'production' || process.env.FORCE_GOOGLE_AUTH === 'true';
		
		if (user) {
			return { 
				user: {
					uid: user.uid,
					email: user.email,
					displayName: user.displayName,
					photoURL: user.photoURL,
					isAnonymous: user.isAnonymous
				},
				showSignInButton: isProduction && user.isAnonymous
			};
		}
		return { 
			user: null, 
			showSignInButton: isProduction 
		};
	} catch (error) {
		console.error('Get current user failed:', error);
		return { 
			user: null, 
			showSignInButton: false // Default to development mode behavior
		};
	}
});

// Force check stored auth and notify renderer
ipcMain.handle('auth:checkStoredAuth', async () => {
	try {
		console.log('Renderer requested stored auth check...');
		const hasStoredAuth = await firebaseMainService.checkStoredAuth();
		if (hasStoredAuth) {
			// Immediately notify renderer of the current user
			firebaseMainService.notifyAuthChange(firebaseMainService.user);
		}
		return { hasStoredAuth };
	} catch (error) {
		console.error('Failed to check stored auth:', error);
		return { hasStoredAuth: false };
	}
});

// Notification settings handlers
ipcMain.handle('notifications:getSettings', async () => {
	return await readNotificationSettings();
});

ipcMain.handle('notifications:updateSettings', async (_evt, settings) => {
	await writeNotificationSettings(settings);
	
	// Restart alert timer with new settings
	if (settings.enabled && !alertTimer) {
		startAlertTimer();
	} else if (!settings.enabled && alertTimer) {
		stopAlertTimer();
	}
	
	return { ok: true };
});

ipcMain.handle('notifications:testAlert', async () => {
	const testTask = {
		id: 'test',
		title: 'Test Notification - This is how alerts will look!',
		priority: 2,
		dueAt: Date.now()
	};
	
	showTaskAlert(testTask, 0);
	return { ok: true };
});

// Auto-updater IPC handlers
ipcMain.handle('update:checkForUpdates', async () => {
	if (isDev) {
		return { message: 'Updates not available in development mode' };
	}
	try {
		const result = await autoUpdater.checkForUpdates();
		return { updateInfo: result?.updateInfo || null };
	} catch (error) {
		console.error('Check for updates error:', error);
		return { error: error.message };
	}
});

ipcMain.handle('update:downloadAndInstall', () => {
	if (isDev) {
		return { message: 'Updates not available in development mode' };
	}
	autoUpdater.quitAndInstall(false, true);
	return { ok: true };
});

// Cleanup on app quit
app.on('before-quit', () => {
	stopAlertTimer();
});
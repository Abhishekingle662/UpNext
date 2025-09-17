const $ = (sel, root=document) => root.querySelector(sel);

// Elements
const formEl = $('#newTaskForm');
const inputEl = $('#taskInput');
const listEl = $('#list');
const emptyEl = $('#empty');
const countEl = $('#count');
const clearBtn = $('#clearCompleted');
const pinBtn = $('#pinBtn');
const settingsBtn = $('#settingsBtn');
const themeBtn = $('#themeBtn');
const minBtn = $('#minBtn');
const closeBtn = $('#closeBtn');
const tpl = document.getElementById('itemTpl');

// Settings modal elements
const settingsModal = $('#settingsModal');
const closeSettings = $('#closeSettings');
const notificationsEnabled = $('#notificationsEnabled');
const alertOnTime = $('#alertOnTime');
const alert5min = $('#alert5min');
const alert15min = $('#alert15min');
const soundEnabled = $('#soundEnabled');
const testNotification = $('#testNotification');

let tasks = [];

function updateCount() {
	const left = tasks.filter(t => !t.completed).length;
	countEl.textContent = left === 0 ? 'All done 🎉' : `${left} to do`;
	emptyEl.hidden = tasks.length !== 0;
}

function makeItem(task) {
	const node = tpl.content.firstElementChild.cloneNode(true);
	const cb = $('input[type="checkbox"]', node);
	const title = $('[data-role="title"]', node);
	const edit = $('[data-role="edit"]', node);
	const del = $('[data-role="delete"]', node);
	const dueEl = $('[data-role="due"]', node);
	const prioEl = $('[data-role="priority"]', node);
	const dragHandle = $('[data-role="drag"]', node);

	cb.checked = !!task.completed;
	title.textContent = task.title;
	title.classList.toggle('completed', task.completed);

	// Meta badges
	function formatDue(ts) {
		if (!ts) return '';
		const d = new Date(ts);
		const now = new Date();
		const sameDay = d.toDateString() === now.toDateString();
		const tomorrow = new Date(now);
		tomorrow.setDate(now.getDate() + 1);
		const isTomorrow = d.toDateString() === tomorrow.toDateString();
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		const time = `${hh}:${mm}`;
		if (sameDay) return `today ${time}`;
		if (isTomorrow) return `tomorrow ${time}`;
		const diffDays = Math.round((d.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / (24*60*60*1000));
		if (diffDays > 0 && diffDays <= 7) {
			return d.toLocaleDateString(undefined, { weekday: 'long' }) + ' ' + time;
		}
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + time;
	}

	if (dueEl) {
		const due = task.dueAt;
		if (due) {
			dueEl.textContent = formatDue(due);
			dueEl.hidden = false;
			dueEl.classList.add('badge', 'due');
			const overdue = Date.now() > due;
			dueEl.classList.toggle('overdue', overdue);
			dueEl.classList.toggle('soon', !overdue);
		} else {
			dueEl.hidden = true;
		}
	}

	if (prioEl) {
		const p = Number(task.priority || 0);
		if (p > 0) {
			prioEl.textContent = p === 3 ? 'P1' : p === 2 ? 'P2' : 'P3';
			prioEl.hidden = false;
			prioEl.className = 'badge priority ' + (p === 3 ? 'p3' : p === 2 ? 'p2' : 'p1');
		} else {
			prioEl.hidden = true;
		}
	}

	cb.addEventListener('change', async () => {
		const res = await window.api.updateTask(task.id, { completed: cb.checked });
		if (res.ok) {
			const i = tasks.findIndex(t => t.id === task.id);
			tasks[i] = res.task;
			render();
		}
	});

	// Enter edit mode on double click
	title.addEventListener('dblclick', () => {
		node.classList.add('editing');
		edit.value = task.title;
		edit.focus();
		edit.selectionStart = edit.value.length;
	});

	// commit edit on Enter / blur; ESC cancels
	edit.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') { node.classList.remove('editing'); }
		if (e.key === 'Enter') { edit.blur(); }
	});
	edit.addEventListener('blur', async () => {
		const newTitle = edit.value.trim();
		node.classList.remove('editing');
		if (!newTitle || newTitle === task.title) return;
		const res = await window.api.updateTask(task.id, { title: newTitle });
		if (res.ok) {
			const i = tasks.findIndex(t => t.id === task.id);
			tasks[i] = res.task;
			render();
		}
	});

	del.addEventListener('click', async () => {
		const res = await window.api.deleteTask(task.id);
		if (res.ok) {
			tasks = tasks.filter(t => t.id !== task.id);
			render();
		}
	});

	// Drag and drop functionality
	node.dataset.taskId = task.id;
	
	node.addEventListener('dragstart', (e) => {
		node.classList.add('dragging');
		e.dataTransfer.setData('text/plain', task.id);
		e.dataTransfer.effectAllowed = 'move';
	});

	node.addEventListener('dragend', () => {
		node.classList.remove('dragging');
		document.querySelectorAll('.item').forEach(item => item.classList.remove('drag-over'));
	});

	node.addEventListener('dragover', (e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		node.classList.add('drag-over');
	});

	node.addEventListener('dragleave', () => {
		node.classList.remove('drag-over');
	});

	node.addEventListener('drop', async (e) => {
		e.preventDefault();
		node.classList.remove('drag-over');
		
		const draggedId = e.dataTransfer.getData('text/plain');
		const targetId = task.id;
		
		if (draggedId !== targetId) {
			await reorderTasks(draggedId, targetId);
		}
	});

	return node;
}

async function reorderTasks(draggedId, targetId) {
	const draggedIndex = tasks.findIndex(t => t.id === draggedId);
	const targetIndex = tasks.findIndex(t => t.id === targetId);
	
	if (draggedIndex === -1 || targetIndex === -1) return;
	
	// Remove dragged task and insert at target position
	const [draggedTask] = tasks.splice(draggedIndex, 1);
	tasks.splice(targetIndex, 0, draggedTask);
	
	// Update order field for all tasks
	for (let i = 0; i < tasks.length; i++) {
		tasks[i].order = i;
		await window.api.updateTask(tasks[i].id, { order: i });
	}
	
	render();
}

function render() {
	listEl.innerHTML = '';
	const frag = document.createDocumentFragment();
	for (const t of tasks) frag.appendChild(makeItem(t));
	listEl.appendChild(frag);
	updateCount();
}

// Form submit
formEl.addEventListener('submit', async (e) => {
	e.preventDefault();
	const val = inputEl.value.trim();
	if (!val) return;
	const res = await window.api.createTask(val);
	if (res.ok) {
		tasks.unshift(res.task);
		inputEl.value = '';
		sortInPlace(tasks);
		render();
	}
});

// Clear completed
clearBtn.addEventListener('click', async () => {
	const res = await window.api.clearCompleted();
	if (res.ok) {
		tasks = tasks.filter(t => !t.completed);
		render();
	}
});

// Window controls
pinBtn.addEventListener('click', async () => {
	const { pinned } = await window.api.togglePin();
	pinBtn.style.opacity = pinned ? 1 : 0.6;
});
minBtn.addEventListener('click', () => window.api.winMin());
closeBtn.addEventListener('click', () => window.api.winClose());

// Theme toggle
function applyTheme(theme) {
	document.documentElement.classList.toggle('light', theme === 'light');
}

const storedTheme = localStorage.getItem('theme') || 'dark';
applyTheme(storedTheme);

themeBtn.addEventListener('click', () => {
	const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
	applyTheme(next);
	localStorage.setItem('theme', next);
});

// Settings modal
let notificationSettings = null;

async function loadNotificationSettings() {
	try {
		notificationSettings = await window.api.getNotificationSettings();
		updateSettingsUI();
	} catch (error) {
		console.error('Failed to load notification settings:', error);
	}
}

function updateSettingsUI() {
	if (!notificationSettings) return;
	
	notificationsEnabled.checked = notificationSettings.enabled;
	soundEnabled.checked = notificationSettings.sound;
	
	const beforeMinutes = notificationSettings.beforeMinutes || [0, 5, 15];
	alertOnTime.checked = beforeMinutes.includes(0);
	alert5min.checked = beforeMinutes.includes(5);
	alert15min.checked = beforeMinutes.includes(15);
}

async function saveNotificationSettings() {
	if (!notificationSettings) return;
	
	const beforeMinutes = [];
	if (alertOnTime.checked) beforeMinutes.push(0);
	if (alert5min.checked) beforeMinutes.push(5);
	if (alert15min.checked) beforeMinutes.push(15);
	
	const newSettings = {
		...notificationSettings,
		enabled: notificationsEnabled.checked,
		sound: soundEnabled.checked,
		beforeMinutes: beforeMinutes
	};
	
	try {
		await window.api.updateNotificationSettings(newSettings);
		notificationSettings = newSettings;
	} catch (error) {
		console.error('Failed to save notification settings:', error);
	}
}

settingsBtn.addEventListener('click', async (e) => {
	e.preventDefault();
	await loadNotificationSettings();
	settingsModal.style.display = 'flex';
	settingsModal.hidden = false;
});

closeSettings.addEventListener('click', (e) => {
	e.preventDefault();
	e.stopPropagation();
	settingsModal.style.display = 'none';
	settingsModal.hidden = true;
});

// Close modal when clicking outside
settingsModal.addEventListener('click', (e) => {
	if (e.target === settingsModal) {
		e.preventDefault();
		settingsModal.style.display = 'none';
		settingsModal.hidden = true;
	}
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && !settingsModal.hidden) {
		e.preventDefault();
		settingsModal.style.display = 'none';
		settingsModal.hidden = true;
	}
});

// Save settings when changed
[notificationsEnabled, alertOnTime, alert5min, alert15min, soundEnabled].forEach(input => {
	input.addEventListener('change', saveNotificationSettings);
});

testNotification.addEventListener('click', async () => {
	try {
		await window.api.testNotification();
	} catch (error) {
		console.error('Failed to test notification:', error);
	}
});

// Authentication elements
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const userInfo = document.getElementById('userInfo');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');

// Authentication event handlers
signInBtn?.addEventListener('click', async () => {
	try {
		const result = await window.api.signInWithGoogle();
		if (result.success) {
			updateUserUI(result.user, false); // Hide sign-in button after successful sign-in
			// Reload tasks after sign-in
			tasks = await window.api.loadTasks();
			sortInPlace(tasks);
			render();
		}
	} catch (error) {
		console.error('Sign in failed:', error);
		
		// Show user-friendly message
		if (error.message && error.message.includes('Google sign-in opened in your web browser')) {
			alert('Google sign-in opened in your web browser!\n\n' +
			      'Please sign in at the web app for your personal tasks.\n' +
			      'The desktop app works great in development mode for quick task management.');
		} else {
			alert('Sign in failed. Please try again or use the web app at https://upnext-97a2a.web.app');
		}
	}
});

signOutBtn?.addEventListener('click', async () => {
	try {
		await window.api.signOut();
		// Get updated UI state after sign-out
		const userState = await window.api.getCurrentUser();
		updateUserUI(null, userState.showSignInButton);
		tasks = [];
		render();
	} catch (error) {
		console.error('Sign out failed:', error);
	}
});

// Update user interface based on authentication state
function updateUserUI(user, showSignInButton = true) {
	if (user && !user.isAnonymous) {
		// Show user info
		userInfo.hidden = false;
		signInBtn.hidden = true;
		
		userName.textContent = user.displayName || user.email;
		if (user.photoURL) {
			userPhoto.src = user.photoURL;
			userPhoto.hidden = false;
		} else {
			userPhoto.hidden = true;
		}
	} else {
		// Show sign in button based on environment (production vs development)
		userInfo.hidden = true;
		signInBtn.hidden = !showSignInButton;
	}
}

// Listen for authentication state changes from main process
window.addEventListener('DOMContentLoaded', () => {
	// Set up IPC listener for auth state changes
	console.log('Setting up auth state change listener...');
	console.log('electronAPI available:', !!window.electronAPI);
	console.log('onAuthStateChanged available:', !!(window.electronAPI && window.electronAPI.onAuthStateChanged));
	
	if (window.electronAPI && window.electronAPI.onAuthStateChanged) {
		console.log('Registering auth state change listener');
		window.electronAPI.onAuthStateChanged((user) => {
			console.log('🎉 Auth state changed in renderer:', user);
			if (user) {
				console.log('✅ User signed in, updating UI and loading tasks');
				updateUserUI(user, false);
				// Reload tasks when user signs in
				loadAndRenderTasks();
			} else {
				console.log('❌ User signed out, clearing tasks');
				updateUserUI(null, true);
				tasks = [];
				render();
			}
		});
		console.log('Auth state change listener registered successfully');
	} else {
		console.error('❌ electronAPI or onAuthStateChanged not available');
	}
});

async function loadAndRenderTasks() {
	try {
		console.log('🔄 Loading tasks from API...');
		tasks = await window.api.loadTasks();
		console.log('✅ Tasks loaded:', tasks.length, 'tasks');
		sortInPlace(tasks);
		render();
		console.log('✅ Tasks rendered successfully');
	} catch (error) {
		console.error('❌ Failed to load tasks:', error);
	}
}

// Init
(async function init() {
	// Check current user state
	try {
		console.log('🚀 Initializing renderer...');
		
		const userState = await window.api.getCurrentUser();
		console.log('📋 Current user state:', userState);
		
		updateUserUI(userState.user, userState.showSignInButton);
		
		if (!userState.user) {
			// No user found, try to check for stored auth
			console.log('❓ No user found, checking for stored authentication...');
			try {
				await window.api.checkStoredAuth();
				console.log('✅ Stored auth check completed');
			} catch (error) {
				console.error('❌ Stored auth check failed:', error);
			}
		}
	} catch (error) {
		console.log('No user state available');
		updateUserUI(null, true); // Default to showing sign-in button on error
	}
	
	await loadAndRenderTasks();
	
	// Reflect current pin state
	try {
		const { pinned } = await window.api.getPin();
		pinBtn.style.opacity = pinned ? 1 : 0.6;
	} catch {}
})();

// Local sort helper - respect manual order, then completion status
function sortInPlace(arr) {
	arr.sort((a, b) => {
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

// Auto-refresh ordering as time passes (e.g., a task becomes overdue)
setInterval(() => {
	const before = JSON.stringify(tasks.map(t => t.id));
	sortInPlace(tasks);
	const after = JSON.stringify(tasks.map(t => t.id));
	if (before !== after) render();
}, 60 * 1000);
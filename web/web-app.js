// UpNext Web App — Firebase-backed PWA
// Mirrors the desktop app feature set using Firestore + Firebase Auth.
import { initializeApp }                           from 'firebase/app';
import { getAuth, GoogleAuthProvider,
         signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc,
         addDoc, updateDoc, deleteDoc, query, onSnapshot,
         orderBy, serverTimestamp, writeBatch, enableIndexedDbPersistence } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';

// ── Firebase init ─────────────────────────────────────────────────────────
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch(() => { /* multiple tabs or unsupported */ });

// ── DOM refs ──────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const taskInput   = $('#taskInput');
const taskList    = $('#taskList');
const emptyState  = $('#emptyState');
const taskCount   = $('#taskCount');
const addForm     = $('#addForm');
const clearBtn    = $('#clearBtn');
const settingsBtn = $('#settingsBtn');
const themeBtn    = $('#themeBtn');
const signInBtn   = $('#signInBtn');
const signOutBtn  = $('#signOutBtn');
const userInfo    = $('#userInfo');
const userPhoto   = $('#userPhoto');
const userName    = $('#userName');
const syncStatus  = $('#syncStatus');

// Settings modal
const settingsModal = $('#settingsModal');
const closeSettings = $('#closeSettings');
const notifsEnabled = $('#notifsEnabled');
const alertOnTime   = $('#alertOnTime');
const alert5min     = $('#alert5min');
const alert15min    = $('#alert15min');
const testNotifBtn  = $('#testNotifBtn');
const installBtn    = $('#installBtn');
const installNote   = $('#installNote');

// Task template
const taskTpl = $('#taskTpl');

// ── State ─────────────────────────────────────────────────────────────────
let currentUser   = null;
let unsubscribeTasks = null;
let tasks         = [];
let dragSrcId     = null;
let deferredInstall = null;

const notifSettings = {
  enabled: true,
  beforeMinutes: [0, 5, 15],
};
let notifTimers = [];

// ── Smart parsing (mirrors Rust backend) ──────────────────────────────────
function parsePriority(title) {
  if (title.includes('!!!')) return { title: title.replace('!!!', '').trim(), priority: 3 };
  if (title.includes('!!'))  return { title: title.replace('!!', '').trim(),  priority: 2 };
  const padded = ` ${title} `;
  if (padded.includes(' ! ')) return { title: title.replace(' ! ', ' ').trim(), priority: 1 };
  const lower = title.toLowerCase();
  if (/\bp1\b/.test(lower)) return { title, priority: 3 };
  if (/\bp2\b/.test(lower)) return { title, priority: 2 };
  if (/\bp3\b/.test(lower)) return { title, priority: 1 };
  if (/\b(urgent|asap|critical)\b/.test(lower)) return { title, priority: 3 };
  if (/\b(medium|normal)\b/.test(lower))        return { title, priority: 2 };
  if (/\b(low|minor)\b/.test(lower))            return { title, priority: 1 };
  return { title, priority: 0 };
}

function parseTimeStr(s) {
  s = s.trim().toLowerCase();
  const colonMatch = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (colonMatch) {
    let h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    const ap = colonMatch[3];
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return { h: Math.min(h, 23), m: Math.min(m, 59) };
  }
  const shortMatch = s.match(/^(\d{1,2})\s*(am|pm)?$/);
  if (shortMatch) {
    let h = parseInt(shortMatch[1], 10);
    const ap = shortMatch[2];
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return { h: Math.min(h, 23), m: 0 };
  }
  return { h: 9, m: 0 };
}

function parseDue(title) {
  const now  = new Date();
  const lower = title.toLowerCase();

  const dayStart = (d, h = 9, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0).getTime();

  // tomorrow
  if (lower.startsWith('tomorrow') || lower.includes(' tomorrow')) {
    const rest = lower.replace('tomorrow', '').trim();
    const { h, m } = rest ? parseTimeStr(rest) : { h: 9, m: 0 };
    const t = new Date(now); t.setDate(t.getDate() + 1);
    return { title: title.replace(/tomorrow/i, '').trim(), dueAt: dayStart(t, h, m) };
  }

  // today
  if (lower.startsWith('today') || lower.includes(' today')) {
    const rest = lower.replace('today', '').trim();
    const { h, m } = rest ? parseTimeStr(rest) : { h: now.getHours(), m: now.getMinutes() };
    return { title: title.replace(/today/i, '').trim(), dueAt: dayStart(now, h, m) };
  }

  // next/this weekday
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  for (const [i, name] of days.entries()) {
    const isNext = lower.includes(`next ${name}`);
    const isThis = lower.includes(`this ${name}`);
    if (isNext || isThis) {
      let diff = i - now.getDay();
      if (diff <= 0 || isNext) diff += 7;
      const t = new Date(now); t.setDate(t.getDate() + diff);
      const remove = isNext ? `next ${name}` : `this ${name}`;
      return { title: title.toLowerCase().replace(remove, '').trim(), dueAt: dayStart(t) };
    }
  }

  // in N days/hours
  const inMatch = lower.match(/in\s+(\d+)\s+(day|days|hour|hours)/);
  if (inMatch) {
    const n = parseInt(inMatch[1], 10);
    const unit = inMatch[2];
    const ms = unit.startsWith('hour')
      ? n * 3600000
      : n * 86400000;
    return { title: title.replace(inMatch[0], '').trim(), dueAt: Date.now() + ms };
  }

  // YYYY-MM-DD [HH:MM]
  const isoMatch = lower.match(/(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}|\d{1,2}(?:am|pm)))?/);
  if (isoMatch) {
    const d = new Date(isoMatch[1]);
    if (!isNaN(d)) {
      const { h, m } = isoMatch[2] ? parseTimeStr(isoMatch[2]) : { h: 9, m: 0 };
      return { title: title.replace(isoMatch[0], '').trim(), dueAt: dayStart(d, h, m) };
    }
  }

  return { title, dueAt: null };
}

// ── Formatting helpers ────────────────────────────────────────────────────
function formatDue(ms) {
  if (!ms) return null;
  const diff = ms - Date.now();
  const abs  = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(abs / 3600000);
  const days  = Math.floor(abs / 86400000);
  const date  = new Date(ms);

  if (diff < 0) {
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
  if (mins  < 60) return `in ${mins}m`;
  if (hours < 24) return `in ${hours}h`;
  if (days  === 0) return 'today';
  if (days  === 1) return 'tomorrow';
  if (days  < 7)  return date.toLocaleDateString(undefined, { weekday: 'short' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function priorityLabel(p) {
  if (p === 3) return '!!! High';
  if (p === 2) return '!!  Med';
  if (p === 1) return '!   Low';
  return '';
}

// ── Notification scheduling ───────────────────────────────────────────────
function clearNotifTimers() {
  notifTimers.forEach(clearTimeout);
  notifTimers = [];
}

function scheduleNotifications(taskList) {
  clearNotifTimers();
  if (!notifSettings.enabled || Notification.permission !== 'granted') return;
  for (const task of taskList) {
    if (task.completed || !task.dueAt) continue;
    for (const mins of notifSettings.beforeMinutes) {
      const fireAt = task.dueAt - mins * 60000;
      const delay  = fireAt - Date.now();
      if (delay < 0 || delay > 86400000) continue;
      const t = setTimeout(() => {
        const body = mins === 0
          ? `"${task.title}" is due now!`
          : `"${task.title}" is due in ${mins} minutes`;
        new Notification('UpNext', { body, icon: './icon-192.png' });
      }, delay);
      notifTimers.push(t);
    }
  }
}

// ── Render ────────────────────────────────────────────────────────────────
function render() {
  taskList.innerHTML = '';
  const sorted = [...tasks].sort((a, b) => {
    const ao = a.order ?? a.createdAt;
    const bo = b.order ?? b.createdAt;
    return ao - bo;
  });
  const active = sorted.filter(t => !t.completed);
  const done   = sorted.filter(t => t.completed);
  const ordered = [...active, ...done];

  for (const task of ordered) {
    const node = taskTpl.content.cloneNode(true);
    const li   = node.querySelector('.task');
    li.dataset.id = task.id;
    if (task.completed) li.classList.add('completed');

    node.querySelector('[data-role="check"]').checked = task.completed;
    node.querySelector('[data-role="title"]').textContent = task.title;

    const dueBadge = node.querySelector('[data-role="due"]');
    if (task.dueAt) {
      const label = formatDue(task.dueAt);
      if (label) {
        dueBadge.textContent = label;
        if (task.dueAt < Date.now()) dueBadge.classList.add('overdue');
        dueBadge.hidden = false;
      }
    }

    const prioBadge = node.querySelector('[data-role="priority"]');
    if (task.priority) {
      prioBadge.textContent = priorityLabel(task.priority);
      prioBadge.classList.add(`p${task.priority}`);
      prioBadge.hidden = false;
    }

    attachTaskEvents(li, task);
    taskList.appendChild(node);
  }

  const activeCount = active.length;
  taskCount.textContent = activeCount === 0
    ? 'All done!'
    : `${activeCount} task${activeCount === 1 ? '' : 's'} left`;
  emptyState.hidden = tasks.length > 0;

  scheduleNotifications(tasks);
}

// ── Task item events ──────────────────────────────────────────────────────
function attachTaskEvents(li, task) {
  li.querySelector('[data-role="check"]').addEventListener('change', async (e) => {
    await updateTask(task.id, { completed: e.target.checked });
  });

  const titleEl  = li.querySelector('[data-role="title"]');
  const editEl   = li.querySelector('[data-role="edit"]');

  titleEl.addEventListener('dblclick', () => {
    titleEl.hidden = true;
    editEl.hidden  = false;
    editEl.value   = task.title;
    editEl.focus();
    editEl.select();
  });

  const commitEdit = () => {
    const val = editEl.value.trim();
    if (val && val !== task.title) updateTask(task.id, { title: val });
    editEl.hidden  = false; // render() will fix visibility
  };
  editEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { render(); }
  });
  editEl.addEventListener('blur', commitEdit);

  li.querySelector('[data-role="delete"]').addEventListener('click', () => deleteTask(task.id));

  // Drag & drop
  li.addEventListener('dragstart', (e) => {
    dragSrcId = task.id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  li.addEventListener('dragend', () => {
    dragSrcId = null;
    document.querySelectorAll('.task').forEach(el => el.classList.remove('dragging', 'drag-over'));
  });
  li.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dragSrcId !== task.id) li.classList.add('drag-over');
  });
  li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
  li.addEventListener('drop', async (e) => {
    e.preventDefault();
    li.classList.remove('drag-over');
    if (!dragSrcId || dragSrcId === task.id) return;

    const items  = [...taskList.querySelectorAll('.task')];
    const srcEl  = taskList.querySelector(`[data-id="${dragSrcId}"]`);
    if (!srcEl) return;

    const tgtIdx = items.indexOf(li);
    const srcIdx = items.indexOf(srcEl);
    if (srcIdx < tgtIdx) li.after(srcEl); else li.before(srcEl);

    const newOrder = [...taskList.querySelectorAll('.task')].map(el => el.dataset.id);
    await reorderTasks(newOrder);
  });
}

// ── Firestore CRUD ────────────────────────────────────────────────────────
function tasksCol() {
  return collection(db, 'users', currentUser.uid, 'tasks');
}

async function createTask(title) {
  if (!currentUser) return;
  const { title: afterDue, dueAt } = parseDue(title.trim());
  const { title: clean, priority } = parsePriority(afterDue);
  await addDoc(tasksCol(), {
    title:     clean || title.trim(),
    completed: false,
    priority:  priority || null,
    dueAt:     dueAt || null,
    order:     tasks.length,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

async function updateTask(id, patch) {
  if (!currentUser) return;
  await updateDoc(doc(db, 'users', currentUser.uid, 'tasks', id), {
    ...patch,
    updatedAt: Date.now(),
  });
}

async function deleteTask(id) {
  if (!currentUser) return;
  await deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', id));
}

async function clearCompleted() {
  if (!currentUser) return;
  const batch = writeBatch(db);
  tasks.filter(t => t.completed).forEach(t => {
    batch.delete(doc(db, 'users', currentUser.uid, 'tasks', t.id));
  });
  await batch.commit();
}

async function reorderTasks(orderedIds) {
  if (!currentUser) return;
  const batch = writeBatch(db);
  orderedIds.forEach((id, i) => {
    batch.update(doc(db, 'users', currentUser.uid, 'tasks', id), { order: i, updatedAt: Date.now() });
  });
  await batch.commit();
}

// ── Real-time listener ────────────────────────────────────────────────────
function subscribeToTasks(uid) {
  if (unsubscribeTasks) unsubscribeTasks();
  const q = query(collection(db, 'users', uid, 'tasks'));
  unsubscribeTasks = onSnapshot(q, (snap) => {
    tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
    syncStatus.textContent = 'Synced';
    syncStatus.hidden = false;
    setTimeout(() => { syncStatus.hidden = true; }, 2000);
  }, () => {
    syncStatus.textContent = 'Offline';
    syncStatus.hidden = false;
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    userPhoto.src     = user.photoURL || '';
    userName.textContent = user.displayName || user.email || '';
    userInfo.hidden   = false;
    signInBtn.hidden  = true;
    subscribeToTasks(user.uid);
  } else {
    userInfo.hidden  = true;
    signInBtn.hidden = false;
    tasks = [];
    render();
    if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
  }
});

signInBtn.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    console.error('Sign-in failed', e);
  }
});

signOutBtn.addEventListener('click', () => signOut(auth));

// ── Add form ──────────────────────────────────────────────────────────────
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = taskInput.value.trim();
  if (!title || !currentUser) return;
  taskInput.value = '';
  await createTask(title);
});

// ── Toolbar ───────────────────────────────────────────────────────────────
clearBtn.addEventListener('click', clearCompleted);

// ── Theme ─────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('upnext-theme', theme);
}

themeBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ── Settings modal ────────────────────────────────────────────────────────
settingsBtn.addEventListener('click', () => {
  notifsEnabled.checked = notifSettings.enabled;
  alertOnTime.checked   = notifSettings.beforeMinutes.includes(0);
  alert5min.checked     = notifSettings.beforeMinutes.includes(5);
  alert15min.checked    = notifSettings.beforeMinutes.includes(15);
  settingsModal.hidden  = false;
});

closeSettings.addEventListener('click', () => { settingsModal.hidden = true; });
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.hidden = true; });

function saveSettings() {
  notifSettings.enabled = notifsEnabled.checked;
  notifSettings.beforeMinutes = [];
  if (alertOnTime.checked) notifSettings.beforeMinutes.push(0);
  if (alert5min.checked)   notifSettings.beforeMinutes.push(5);
  if (alert15min.checked)  notifSettings.beforeMinutes.push(15);
  localStorage.setItem('upnext-notifs', JSON.stringify(notifSettings));
  scheduleNotifications(tasks);
}

[notifsEnabled, alertOnTime, alert5min, alert15min]
  .forEach(el => el.addEventListener('change', saveSettings));

testNotifBtn.addEventListener('click', async () => {
  if (Notification.permission !== 'granted') {
    await Notification.requestPermission();
  }
  if (Notification.permission === 'granted') {
    new Notification('UpNext', { body: 'Notifications are working!', icon: './icon-192.png' });
  }
});

// ── PWA install ───────────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  installBtn.hidden = false;
  installNote.hidden = true;
});

installBtn.addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  if (outcome === 'accepted') {
    deferredInstall = null;
    installBtn.hidden = true;
  }
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !settingsModal.hidden) settingsModal.hidden = true;
});

// ── Service worker ────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ── Init ──────────────────────────────────────────────────────────────────
(function init() {
  const savedTheme = localStorage.getItem('upnext-theme');
  if (savedTheme) applyTheme(savedTheme);

  const savedNotifs = localStorage.getItem('upnext-notifs');
  if (savedNotifs) {
    try { Object.assign(notifSettings, JSON.parse(savedNotifs)); } catch (_) {}
  }

  // Show sign-in button initially (auth state change will hide/show appropriately)
  signInBtn.hidden = false;
  render();
})();

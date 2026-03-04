'use strict';

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
const pinBtn      = $('#pinBtn');
const minBtn      = $('#minBtn');
const closeBtn    = $('#closeBtn');

// Settings modal
const settingsModal  = $('#settingsModal');
const closeSettings  = $('#closeSettings');
const notifsEnabled  = $('#notifsEnabled');
const alertOnTime    = $('#alertOnTime');
const alert5min      = $('#alert5min');
const alert15min     = $('#alert15min');
const soundEnabled   = $('#soundEnabled');
const testNotifBtn   = $('#testNotifBtn');

// Task item template
const taskTpl = $('#taskTpl');

// ── State ─────────────────────────────────────────────────────────────────
let tasks = [];
let dragSrcId = null;

// ── Helpers ───────────────────────────────────────────────────────────────
function sortTasks(list) {
  return [...list].sort((a, b) => {
    const ao = a.order ?? a.createdAt;
    const bo = b.order ?? b.createdAt;
    return ao - bo;
  });
}

function formatDue(ms) {
  if (!ms) return null;
  const now = Date.now();
  const diff = ms - now;
  const date = new Date(ms);
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(abs / 3600000);
  const days = Math.floor(abs / 86400000);

  if (diff < 0) {
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
  if (mins < 60)  return `in ${mins}m`;
  if (hours < 24) return `in ${hours}h`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7)   return `${date.toLocaleDateString(undefined, { weekday: 'short' })}`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function priorityLabel(p) {
  if (p === 3) return '!!! High';
  if (p === 2) return '!!  Med';
  if (p === 1) return '!   Low';
  return '';
}

// ── Render ────────────────────────────────────────────────────────────────
function render() {
  taskList.innerHTML = '';
  const sorted = sortTasks(tasks);
  const active = sorted.filter(t => !t.completed);
  const done   = sorted.filter(t => t.completed);
  const ordered = [...active, ...done];

  for (const task of ordered) {
    const node = taskTpl.content.cloneNode(true);
    const li   = node.querySelector('.task');

    li.dataset.id = task.id;
    if (task.completed) li.classList.add('completed');

    const check = node.querySelector('[data-role="check"]');
    check.checked = task.completed;

    const titleEl = node.querySelector('[data-role="title"]');
    titleEl.textContent = task.title;

    // Due badge
    const dueBadge = node.querySelector('[data-role="due"]');
    if (task.dueAt) {
      const label = formatDue(task.dueAt);
      if (label) {
        dueBadge.textContent = label;
        if (task.dueAt < Date.now()) dueBadge.classList.add('overdue');
        dueBadge.hidden = false;
      }
    }

    // Priority badge
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
}

// ── Task events ───────────────────────────────────────────────────────────
function attachTaskEvents(li, task) {
  // Complete toggle
  li.querySelector('[data-role="check"]').addEventListener('change', async (e) => {
    await window.api.updateTask(task.id, { completed: e.target.checked });
    await reload();
  });

  // Double-click to edit
  const titleEl  = li.querySelector('[data-role="title"]');
  const editInput = li.querySelector('[data-role="edit"]');

  titleEl.addEventListener('dblclick', () => {
    titleEl.hidden   = true;
    editInput.hidden = false;
    editInput.value  = task.title;
    editInput.focus();
    editInput.select();
  });

  const commitEdit = async () => {
    const newTitle = editInput.value.trim();
    if (newTitle && newTitle !== task.title) {
      await window.api.updateTask(task.id, { title: newTitle });
    }
    await reload();
  };

  editInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { reload(); }
  });
  editInput.addEventListener('blur', commitEdit);

  // Delete
  li.querySelector('[data-role="delete"]').addEventListener('click', async () => {
    await window.api.deleteTask(task.id);
    await reload();
  });

  // Drag & drop
  li.addEventListener('dragstart', (e) => {
    dragSrcId = task.id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  li.addEventListener('dragend', () => {
    dragSrcId = null;
    document.querySelectorAll('.task').forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });
  });
  li.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSrcId !== task.id) li.classList.add('drag-over');
  });
  li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
  li.addEventListener('drop', async (e) => {
    e.preventDefault();
    li.classList.remove('drag-over');
    if (!dragSrcId || dragSrcId === task.id) return;

    const items = [...taskList.querySelectorAll('.task')];
    const srcEl = taskList.querySelector(`[data-id="${dragSrcId}"]`);
    if (!srcEl) return;

    const tgtIdx = items.indexOf(li);
    const srcIdx = items.indexOf(srcEl);
    if (srcIdx < tgtIdx) li.after(srcEl); else li.before(srcEl);

    const newOrder = [...taskList.querySelectorAll('.task')].map(el => el.dataset.id);
    await window.api.reorderTasks(newOrder);
    await reload();
  });
}

// ── Data loading ──────────────────────────────────────────────────────────
async function reload() {
  tasks = await window.api.loadTasks();
  render();
}

// ── Form submission ───────────────────────────────────────────────────────
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = taskInput.value.trim();
  if (!title) return;
  taskInput.value = '';
  await window.api.createTask(title);
  await reload();
});

// ── Toolbar buttons ───────────────────────────────────────────────────────
clearBtn.addEventListener('click', async () => {
  await window.api.clearCompleted();
  await reload();
});

// ── Window controls ───────────────────────────────────────────────────────
minBtn.addEventListener('click',   () => window.api.winMinimize());
closeBtn.addEventListener('click', () => window.api.winClose());

// ── Theme toggle ──────────────────────────────────────────────────────────
async function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeBtn.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}

themeBtn.addEventListener('click', async () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  await window.api.setUiPrefs({ theme: next });
});

// ── Pin toggle ────────────────────────────────────────────────────────────
async function applyPin(pinned) {
  pinBtn.classList.toggle('pinned', pinned);
  pinBtn.title = pinned ? 'Unpin window' : 'Always on top';
}

pinBtn.addEventListener('click', async () => {
  const { pinned } = await window.api.togglePin();
  applyPin(pinned);
});

// ── Settings modal ────────────────────────────────────────────────────────
settingsBtn.addEventListener('click', async () => {
  const s = await window.api.getNotificationSettings();
  notifsEnabled.checked = s.enabled;
  alertOnTime.checked   = s.beforeMinutes?.includes(0);
  alert5min.checked     = s.beforeMinutes?.includes(5);
  alert15min.checked    = s.beforeMinutes?.includes(15);
  soundEnabled.checked  = s.sound;
  settingsModal.hidden  = false;
});

closeSettings.addEventListener('click', () => { settingsModal.hidden = true; });
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.hidden = true; });

async function saveSettings() {
  const before = [];
  if (alertOnTime.checked) before.push(0);
  if (alert5min.checked)   before.push(5);
  if (alert15min.checked)  before.push(15);
  await window.api.updateNotificationSettings({
    enabled: notifsEnabled.checked,
    beforeMinutes: before,
    sound: soundEnabled.checked,
  });
}

[notifsEnabled, alertOnTime, alert5min, alert15min, soundEnabled]
  .forEach(el => el.addEventListener('change', saveSettings));

testNotifBtn.addEventListener('click', () => window.api.testNotification());

// ── Keyboard shortcuts ────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !settingsModal.hidden) {
    settingsModal.hidden = true;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    settingsBtn.click();
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────
async function init() {
  // Restore theme preference
  try {
    const prefs = await window.api.getUiPrefs();
    if (prefs?.theme) applyTheme(prefs.theme);
  } catch (_) { /* use default */ }

  // Restore pin state
  try {
    const { pinned } = await window.api.getPin();
    applyPin(pinned);
  } catch (_) { /* ignore */ }

  await reload();
}

// Wait for tauri-preload.js module to finish binding window.api
window.addEventListener('DOMContentLoaded', () => {
  // Give the module script a tick to execute
  setTimeout(init, 0);
});

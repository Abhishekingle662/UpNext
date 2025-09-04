const $ = (sel, root=document) => root.querySelector(sel);

// Elements
const formEl = $('#newTaskForm');
const inputEl = $('#taskInput');
const listEl = $('#list');
const emptyEl = $('#empty');
const countEl = $('#count');
const clearBtn = $('#clearCompleted');
const pinBtn = $('#pinBtn');
const themeBtn = $('#themeBtn');
const minBtn = $('#minBtn');
const closeBtn = $('#closeBtn');
const tpl = document.getElementById('itemTpl');

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

	cb.checked = !!task.completed;
	title.textContent = task.title;
	title.classList.toggle('completed', task.completed);

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

	return node;
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

// Init
(async function init() {
	tasks = await window.api.loadTasks();
	render();
	// Reflect current pin state
	try {
		const { pinned } = await window.api.getPin();
		pinBtn.style.opacity = pinned ? 1 : 0.6;
	} catch {}
})();
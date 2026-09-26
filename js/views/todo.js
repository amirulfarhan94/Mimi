// To-do list: quick add, Today / Upcoming / All, custom lists and repeating tasks.
import { getState, upsert, remove, find, update } from '../store.js';
import { esc, today, addDays, fmtDate, relDays, uid } from '../util.js';
import { openSheet, confirmSheet, toast, formData, icon } from '../ui.js';
import {
  REPEATS, repeatLabel, sortTodos, isOverdue, listById, fmtTime,
  toggleDone, clearCompleted, deleteList,
} from '../todo.js';

let view = 'today'; // today | upcoming | all
let listFilter = ''; // '' = every list
let showDone = false;

const CHEERS = ['Done! Proud of you 💕', 'Yay, one less thing! ✨', 'You did it, Sayang 🌸', 'Great job! 💖'];

// ---------- Row (tab & dashboard) ----------
export function todoRow(t) {
  const l = listById(t.list);
  const bits = [];
  if (l) bits.push(`${l.emoji} ${esc(l.name)}`);
  if (t.due) bits.push(`<span class="${isOverdue(t) ? 'late-text' : ''}">${relDays(t.due)}${t.time ? ` · ${fmtTime(t.time)}` : ''}</span>`);
  if (t.repeat) bits.push(`🔁 ${repeatLabel(t.repeat)}`);
  return `<div class="todo ${t.done ? 'done' : ''} ${isOverdue(t) ? 'overdue' : ''}" data-todo="${t.id}">
    <button class="todo-check" data-check aria-label="${t.done ? 'Mark as not done' : 'Mark as done'}" aria-pressed="${t.done}">${icon('check')}</button>
    <button class="todo-main" data-open>
      <span class="li-title">${t.important ? '<span class="star" aria-label="Important">★</span> ' : ''}${esc(t.title)}</span>
      ${bits.length ? `<span class="li-sub">${bits.join(' · ')}</span>` : ''}
    </button>
  </div>`;
}

export function bindTodoRows(root) {
  root.querySelectorAll('[data-todo]').forEach((row) => {
    const id = row.dataset.todo;
    row.querySelector('[data-open]').addEventListener('click', () => openTodoForm(find('todos', id)));
    row.querySelector('[data-check]').addEventListener('click', () => {
      const wasDone = find('todos', id)?.done;
      row.classList.add(wasDone ? 'unchecking' : 'checking');
      // Let the tick animation play before the list re-renders.
      setTimeout(() => {
        const nextDue = toggleDone(id);
        if (!wasDone) toast(nextDue ? `${CHEERS[0]} Next: ${fmtDate(nextDue)}` : CHEERS[Math.floor(Math.random() * CHEERS.length)]);
      }, wasDone ? 0 : 380);
    });
  });
}

// ---------- Task form ----------
export function openTodoForm(existing, defaults = {}) {
  const lists = getState().todoLists;
  const t = existing || {
    title: '', note: '', due: '', time: '', list: listFilter || lists[0]?.id,
    important: false, repeat: null, ...defaults,
  };
  const r = t.repeat || { every: '', n: 3 };

  openSheet({
    title: existing ? 'Edit to-do' : 'New to-do',
    body: `
      <form class="form" id="todoForm">
        <label class="field"><span>What needs doing?</span>
          <input name="title" required maxlength="120" value="${esc(t.title)}" placeholder="e.g. Pay TNB bill">
        </label>
        <div class="field">
          <span class="label">Due</span>
          <div class="chips">
            <button type="button" class="chip" data-due="${today()}">Today</button>
            <button type="button" class="chip" data-due="${addDays(today(), 1)}">Tomorrow</button>
            <button type="button" class="chip" data-due="${addDays(today(), 7)}">Next week</button>
            <button type="button" class="chip" data-due="">No date</button>
          </div>
          <div class="row gap">
            <input class="grow" name="due" type="date" value="${esc(t.due)}" aria-label="Due date">
            <input name="time" type="time" value="${esc(t.time)}" aria-label="Time (optional)" class="time-input">
          </div>
        </div>
        <label class="field"><span>List</span>
          <select name="list">${lists.map((l) => `<option value="${l.id}" ${l.id === t.list ? 'selected' : ''}>${l.emoji} ${esc(l.name)}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Repeat</span>
          <select name="repeat">
            <option value="">Does not repeat</option>
            ${Object.entries(REPEATS).map(([k, label]) => `<option value="${k}" ${r.every === k ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <label class="field" id="repeatDays" ${r.every === 'days' ? '' : 'hidden'}><span>Repeat every how many days?</span>
          <input name="n" type="number" min="1" max="365" value="${esc(r.n || 3)}">
        </label>
        <label class="check star-toggle"><input type="checkbox" name="important" ${t.important ? 'checked' : ''}><span>★ Mark as important</span></label>
        <label class="field"><span>Note (optional)</span>
          <textarea name="note" rows="3" maxlength="500" placeholder="Anything to remember">${esc(t.note)}</textarea>
        </label>
        <p class="hint" id="repeatHint" ${r.every ? '' : 'hidden'}>When you tick a repeating task, the next one is created automatically.</p>
        <div class="row gap mt">
          ${existing ? `<button type="button" class="btn ghost danger-text" data-del>${icon('trash')} Delete</button>` : ''}
          <button class="btn primary grow" type="submit">${icon('check')} Save</button>
        </div>
      </form>`,
    onMount(root, close) {
      const form = root.querySelector('#todoForm');
      const markChip = () => root.querySelectorAll('[data-due]').forEach((c) =>
        c.classList.toggle('on', c.dataset.due === form.due.value));
      root.querySelectorAll('[data-due]').forEach((c) => c.addEventListener('click', () => {
        form.due.value = c.dataset.due;
        if (!c.dataset.due) form.time.value = '';
        markChip();
      }));
      form.due.addEventListener('input', markChip);
      markChip();
      form.repeat.addEventListener('change', () => {
        root.querySelector('#repeatDays').hidden = form.repeat.value !== 'days';
        root.querySelector('#repeatHint').hidden = !form.repeat.value;
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = formData(form);
        const repeat = d.repeat ? { every: d.repeat, n: Math.max(1, parseInt(d.n, 10) || 1) } : null;
        upsert('todos', {
          ...(existing || { done: false, doneAt: null }),
          title: d.title.trim(),
          note: d.note.trim(),
          // A repeating task needs a date to count from.
          due: d.due || (repeat ? today() : ''),
          time: d.due || repeat ? d.time : '',
          list: d.list,
          important: !!d.important,
          repeat,
        });
        close();
        toast(existing ? 'To-do updated' : 'To-do added 💕');
      });
      root.querySelector('[data-del]')?.addEventListener('click', async () => {
        close();
        if (await confirmSheet('Delete this to-do?')) { remove('todos', existing.id); toast('To-do deleted'); }
      });
    },
  });
}

// ---------- Manage lists ----------
function openListsManager() {
  const draw = () => getState().todoLists.map((l) => `
    <li class="list-row" data-list="${l.id}">
      <input class="emoji-input" value="${esc(l.emoji)}" maxlength="4" aria-label="Emoji for ${esc(l.name)}" data-emoji>
      <input class="grow" value="${esc(l.name)}" maxlength="30" aria-label="List name" data-name>
      <button type="button" class="icon-btn sm" data-del-list aria-label="Delete ${esc(l.name)}">${icon('trash')}</button>
    </li>`).join('');

  openSheet({
    title: 'My lists',
    body: `
      <ul class="lists-edit" id="listsEdit">${draw()}</ul>
      <div class="row gap mt">
        <input class="emoji-input" id="newEmoji" value="📝" maxlength="4" aria-label="New list emoji">
        <input class="grow" id="newListName" maxlength="30" placeholder="New list name" aria-label="New list name">
        <button type="button" class="btn" data-add-list>${icon('plus')} Add</button>
      </div>
      <p class="hint mt">Deleting a list moves its to-dos to the first list.</p>
      <button class="btn primary block mt" data-close>Done</button>`,
    onMount(root) {
      const ul = root.querySelector('#listsEdit');
      const redraw = () => { ul.innerHTML = draw(); };
      ul.addEventListener('change', (e) => {
        const li = e.target.closest('[data-list]');
        if (!li) return;
        const name = li.querySelector('[data-name]').value.trim();
        const emoji = li.querySelector('[data-emoji]').value.trim() || '📝';
        if (!name) { redraw(); return; }
        update((s) => Object.assign(s.todoLists.find((l) => l.id === li.dataset.list), { name, emoji }));
      });
      ul.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-del-list]');
        if (!btn) return;
        if (getState().todoLists.length <= 1) { toast('Keep at least one list'); return; }
        const id = btn.closest('[data-list]').dataset.list;
        deleteList(id);
        if (listFilter === id) listFilter = '';
        redraw();
        toast('List deleted');
      });
      const add = () => {
        const name = root.querySelector('#newListName').value.trim();
        if (!name) return;
        const emoji = root.querySelector('#newEmoji').value.trim() || '📝';
        update((s) => s.todoLists.push({ id: uid(), name, emoji }));
        root.querySelector('#newListName').value = '';
        root.querySelector('#newEmoji').value = '📝';
        redraw();
      };
      root.querySelector('[data-add-list]').addEventListener('click', add);
      root.querySelector('#newListName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    },
  });
}

// ---------- Tab ----------
function visible(todos) {
  const now = today();
  return todos.filter((t) => !listFilter || t.list === listFilter).filter((t) => {
    if (view === 'today') return t.due && t.due <= now;
    if (view === 'upcoming') return t.due && t.due > now;
    return true;
  });
}

export default {
  title: 'To-do',
  fab: () => openTodoForm(null, view === 'today' ? { due: today() } : {}),
  render() {
    const s = getState();
    const open = s.todos.filter((t) => !t.done);
    const shown = sortTodos(visible(open));
    const done = s.todos.filter((t) => t.done && (!listFilter || t.list === listFilter))
      .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    const now = today();
    const counts = {
      today: open.filter((t) => t.due && t.due <= now).length,
      upcoming: open.filter((t) => t.due && t.due > now).length,
      all: open.length,
    };
    const emptyMsg = {
      today: ['🌸', 'Nothing due today. Enjoy your day, Sayang!'],
      upcoming: ['📅', 'Nothing scheduled ahead.'],
      all: ['✨', 'Your to-do list is empty.'],
    }[view];

    return `
      <form class="quick-add" id="quickAdd">
        ${icon('plus')}
        <input id="quickTitle" maxlength="120" placeholder="${view === 'today' ? 'Add a task for today…' : 'Add a task…'}" aria-label="Add a task" autocomplete="off">
        <button class="btn sm primary" type="submit">Add</button>
      </form>

      <div class="segmented three" role="tablist">
        ${[['today', 'Today'], ['upcoming', 'Upcoming'], ['all', 'All']].map(([k, l]) =>
          `<label><input type="radio" name="todoView" value="${k}" ${view === k ? 'checked' : ''}><span>${l}${counts[k] ? ` <small class="count">${counts[k]}</small>` : ''}</span></label>`).join('')}
      </div>

      <div class="chips">
        <button class="chip ${!listFilter ? 'on' : ''}" data-list-filter="">All lists</button>
        ${s.todoLists.map((l) => `<button class="chip ${listFilter === l.id ? 'on' : ''}" data-list-filter="${l.id}">${l.emoji} ${esc(l.name)}</button>`).join('')}
        <button class="chip ghost-chip" data-manage-lists>${icon('edit')} Lists</button>
      </div>

      ${shown.length
        ? `<div class="todos">${shown.map(todoRow).join('')}</div>`
        : `<div class="empty"><div class="empty-emoji">${emptyMsg[0]}</div><p>${emptyMsg[1]}</p></div>`}

      ${done.length ? `
        <details class="done-section" ${showDone ? 'open' : ''}>
          <summary>Completed (${done.length})</summary>
          <div class="todos">${done.slice(0, 50).map(todoRow).join('')}</div>
          <button class="btn ghost sm mt" data-clear-done>${icon('trash')} Clear completed</button>
        </details>` : ''}`;
  },
  mount(root, rerender) {
    const input = root.querySelector('#quickTitle');
    root.querySelector('#quickAdd').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = input.value.trim();
      if (!title) return;
      upsert('todos', {
        title, note: '', due: view === 'today' ? today() : '', time: '',
        list: listFilter || getState().todoLists[0]?.id, important: false, repeat: null, done: false, doneAt: null,
      });
      toast('To-do added 💕');
      root.querySelector('#quickTitle')?.focus();
    });
    root.querySelectorAll('[name=todoView]').forEach((r) => r.addEventListener('change', () => { view = r.value; rerender(); }));
    root.querySelectorAll('[data-list-filter]').forEach((b) => b.addEventListener('click', () => {
      listFilter = b.dataset.listFilter; rerender();
    }));
    root.querySelector('[data-manage-lists]').addEventListener('click', openListsManager);
    root.querySelector('.done-section')?.addEventListener('toggle', (e) => { showDone = e.target.open; });
    root.querySelector('[data-clear-done]')?.addEventListener('click', async () => {
      if (await confirmSheet('Remove all completed to-dos?', { ok: 'Clear' })) { clearCompleted(); toast('Completed to-dos cleared'); }
    });
    bindTodoRows(root);
  },
};

// To-do logic: sorting, due-date helpers and repeating tasks.
import { update, getState } from './store.js';
import { uid, today, addDays, addMonths } from './util.js';

/*
  To-do:
  {
    id, title, note,
    due,          // 'YYYY-MM-DD' or '' (no date)
    time,         // 'HH:MM' or ''
    list,         // todoLists[].id
    important,    // boolean
    repeat,       // null | { every: 'daily' | 'weekly' | 'monthly' | 'days', n }
    done, doneAt,
    spawnedId,    // id of the next occurrence created when a repeating task was completed
  }
*/

export const REPEATS = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
  days: 'Every X days',
};

export const repeatLabel = (r) =>
  !r ? '' : r.every === 'days' ? `Every ${r.n} ${r.n === 1 ? 'day' : 'days'}` : REPEATS[r.every];

const step = (iso, r) => {
  switch (r.every) {
    case 'daily': return addDays(iso, 1);
    case 'weekly': return addDays(iso, 7);
    case 'monthly': return addMonths(iso, 1);
    default: return addDays(iso, Math.max(1, Number(r.n) || 1));
  }
};

/**
 * Next due date of a repeating task: one step after its due date,
 * moved forward until it is no earlier than today (so an overdue daily task doesn't pile up).
 */
export function nextDue(t, now = today()) {
  let next = step(t.due || now, t.repeat);
  while (next < now) next = step(next, t.repeat);
  return next;
}

export const isOverdue = (t, now = today()) => !t.done && !!t.due && t.due < now;
export const isDueToday = (t, now = today()) => !t.done && !!t.due && t.due <= now;

/** Open tasks first by date (overdue → today → later → no date), then important, then time. */
export function sortTodos(list) {
  return [...list].sort((a, b) =>
    (a.due || '9999').localeCompare(b.due || '9999')
    || (b.important ? 1 : 0) - (a.important ? 1 : 0)
    || (a.time || '99').localeCompare(b.time || '99')
    || (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export const listById = (id) => {
  const lists = getState().todoLists;
  return lists.find((l) => l.id === id) || lists[0];
};

/** 24h "HH:MM" → "9:05 am". */
export function fmtTime(hm) {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/**
 * Tick / untick a task. Completing a repeating task creates its next occurrence;
 * unticking it again removes that occurrence if it hasn't been done yet.
 * Returns the next occurrence's due date when one was created.
 */
export function toggleDone(id) {
  let spawnedDue = null;
  update((s) => {
    const t = s.todos.find((x) => x.id === id);
    if (!t) return;
    const now = new Date().toISOString();
    if (!t.done) {
      t.done = true;
      t.doneAt = now;
      if (t.repeat) {
        const next = {
          id: uid(), title: t.title, note: t.note, due: nextDue(t), time: t.time,
          list: t.list, important: t.important, repeat: { ...t.repeat },
          done: false, doneAt: null, createdAt: now, updatedAt: now,
        };
        s.todos.push(next);
        t.spawnedId = next.id;
        spawnedDue = next.due;
      }
    } else {
      t.done = false;
      t.doneAt = null;
      if (t.spawnedId) {
        const spawned = s.todos.find((x) => x.id === t.spawnedId);
        if (spawned && !spawned.done) s.todos = s.todos.filter((x) => x.id !== t.spawnedId);
        delete t.spawnedId;
      }
    }
  });
  return spawnedDue;
}

export function clearCompleted() {
  update((s) => { s.todos = s.todos.filter((t) => !t.done); });
}

/** Delete a list; its tasks move to the first remaining list. */
export function deleteList(listId) {
  update((s) => {
    if (s.todoLists.length <= 1) return;
    s.todoLists = s.todoLists.filter((l) => l.id !== listId);
    const fallback = s.todoLists[0].id;
    s.todos.forEach((t) => { if (t.list === listId) t.list = fallback; });
  });
}

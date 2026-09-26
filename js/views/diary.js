// Daily notes / diary.
import { getState, upsert, remove, find } from '../store.js';
import { esc, today, monthKey, fmtMonth, fmtDateLong, fmtDate, addDays } from '../util.js';
import { openSheet, confirmSheet, toast, formData, icon } from '../ui.js';

export const MOODS = [
  ['gembira', '🥰', 'Happy'], ['ok', '🙂', 'Okay'], ['biasa', '😐', 'Meh'],
  ['penat', '😮‍💨', 'Tired'], ['sedih', '😢', 'Sad'], ['marah', '😠', 'Upset'], ['sakit', '🤒', 'Unwell'],
];
export const moodEmoji = (m) => MOODS.find(([k]) => k === m)?.[1] || '📝';

let query = '';

export const sortedNotes = () =>
  [...getState().notes].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));

/** Number of consecutive days (ending today or yesterday) with a diary entry. */
export function streak() {
  const days = new Set(getState().notes.map((n) => n.date));
  let d = today();
  if (!days.has(d)) d = addDays(d, -1);
  let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function noteCard(n) {
  const excerpt = (n.body || '').slice(0, 160);
  return `<button class="note-card" data-note="${n.id}">
    <span class="note-mood">${moodEmoji(n.mood)}</span>
    <span class="grow">
      <span class="note-date">${fmtDateLong(n.date)}</span>
      ${n.title ? `<span class="note-title">${esc(n.title)}</span>` : ''}
      <span class="note-body">${esc(excerpt)}${(n.body || '').length > 160 ? '…' : ''}</span>
    </span>
  </button>`;
}

export function bindNoteCards(root) {
  root.querySelectorAll('[data-note]').forEach((el) =>
    el.addEventListener('click', () => openNoteForm(find('notes', el.dataset.note))));
}

export function openNoteForm(existing) {
  const n = existing || { date: today(), mood: 'ok', title: '', body: '' };
  openSheet({
    title: existing ? `Diary · ${fmtDate(n.date)}` : 'Dear diary…',
    body: `
      <form class="form" id="noteForm">
        <label class="field"><span>Date</span>
          <input name="date" type="date" required value="${esc(n.date)}">
        </label>
        <fieldset class="field">
          <legend>How are you feeling?</legend>
          <div class="moods">
            ${MOODS.map(([k, e, l]) => `<label title="${l}"><input type="radio" name="mood" value="${k}" ${n.mood === k ? 'checked' : ''}><span>${e}<small>${l}</small></span></label>`).join('')}
          </div>
        </fieldset>
        <label class="field"><span>Title (optional)</span>
          <input name="title" type="text" maxlength="100" value="${esc(n.title)}" placeholder="Today in a few words">
        </label>
        <label class="field"><span>Entry</span>
          <textarea name="body" rows="9" required placeholder="What happened today? What are you grateful for?">${esc(n.body)}</textarea>
        </label>
        <div class="row gap mt">
          ${existing ? `<button type="button" class="btn ghost danger-text" data-del>${icon('trash')} Delete</button>` : ''}
          <button class="btn primary grow" type="submit">${icon('check')} Save</button>
        </div>
      </form>`,
    onMount(root, close) {
      const form = root.querySelector('#noteForm');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        upsert('notes', { ...(existing || {}), ...formData(form) });
        close();
        toast('Diary saved 💕');
      });
      root.querySelector('[data-del]')?.addEventListener('click', async () => {
        close();
        if (await confirmSheet('Delete this diary entry?')) { remove('notes', existing.id); toast('Entry deleted'); }
      });
    },
  });
}

function renderList() {
  const q = query.trim().toLowerCase();
  const notes = sortedNotes().filter((n) =>
    !q || `${n.title} ${n.body} ${n.date}`.toLowerCase().includes(q));
  if (!notes.length) {
    return q
      ? `<div class="empty"><div class="empty-emoji">🔍</div><p>No entries match "${esc(query)}".</p></div>`
      : `<div class="empty"><div class="empty-emoji">📔</div><p>No diary entries yet. Start writing today!</p>
          <button class="btn primary" data-add>${icon('pen')} Write diary</button></div>`;
  }
  const groups = new Map();
  for (const n of notes) {
    const k = monthKey(n.date);
    (groups.get(k) || groups.set(k, []).get(k)).push(n);
  }
  return [...groups].map(([k, items]) => `
    <section class="day-group">
      <div class="day-head"><span>${fmtMonth(k)}</span><span class="muted">${items.length} ${items.length === 1 ? 'entry' : 'entries'}</span></div>
      <div class="notes">${items.map(noteCard).join('')}</div>
    </section>`).join('');
}

export default {
  title: 'Diary',
  fab: () => openNoteForm(),
  render() {
    const s = streak();
    return `
      <div class="search">
        ${icon('search')}
        <input type="search" id="noteSearch" placeholder="Search diary…" value="${esc(query)}" aria-label="Search diary">
      </div>
      <section class="stats three">
        <div class="stat"><span class="stat-label">Entries</span><span class="stat-val">${getState().notes.length}</span></div>
        <div class="stat"><span class="stat-label">Streak</span><span class="stat-val">${s} ${s === 1 ? 'day' : 'days'} 🔥</span></div>
        <div class="stat"><span class="stat-label">This month</span><span class="stat-val">${getState().notes.filter((n) => monthKey(n.date) === monthKey(today())).length}</span></div>
      </section>
      <div id="noteList">${renderList()}</div>`;
  },
  mount(root) {
    const list = root.querySelector('#noteList');
    const bind = () => {
      bindNoteCards(list);
      list.querySelector('[data-add]')?.addEventListener('click', () => openNoteForm());
    };
    root.querySelector('#noteSearch').addEventListener('input', (e) => {
      query = e.target.value;
      list.innerHTML = renderList();
      bind();
    });
    bind();
  },
};

// Expense & income records.
import { getState, upsert, remove, find } from '../store.js';
import { esc, rm, rmStat, today, monthKey, fmtMonth, shiftMonth, fmtDateLong, relDays } from '../util.js';
import { openSheet, confirmSheet, toast, formData, icon } from '../ui.js';

export const CATEGORIES = {
  out: [
    ['Food', '🍛'], ['Groceries', '🛒'], ['Transport', '⛽'], ['Bills & Utilities', '💡'],
    ['Shopping', '🛍️'], ['Beauty & Self-care', '💅'], ['Health', '💊'], ['Entertainment', '🎬'],
    ['Education', '📚'], ['Family', '👨‍👩‍👧'], ['Charity', '🤲'], ['Kutu', '🤝'], ['Others', '📦'],
  ],
  in: [
    ['Salary', '💼'], ['Side income', '💸'], ['Kutu', '🤝'], ['Gift', '🎁'], ['Others', '📦'],
  ],
};

export const catEmoji = (type, cat) =>
  (CATEGORIES[type] || []).find(([c]) => c === cat)?.[1] || '📦';

let month = monthKey(today());
let filter = 'all'; // all | out | in

export const txnsInMonth = (key) => getState().txns.filter((t) => monthKey(t.date) === key);

export function totals(list) {
  let out = 0, inc = 0;
  for (const t of list) t.type === 'in' ? (inc += +t.amount) : (out += +t.amount);
  return { out, in: inc, balance: inc - out };
}

export function byCategory(list, type = 'out') {
  const map = new Map();
  for (const t of list) if (t.type === type) map.set(t.category, (map.get(t.category) || 0) + +t.amount);
  return [...map].sort((a, b) => b[1] - a[1]);
}

/** Horizontal bars for the category breakdown (one series, one colour). */
export function categoryBars(rows, type = 'out') {
  if (!rows.length) return '<p class="muted small">No records yet.</p>';
  const max = rows[0][1];
  const sum = rows.reduce((a, [, v]) => a + v, 0);
  return `<ul class="hbars">${rows.map(([cat, v]) => `
    <li title="${esc(cat)}: ${rm(v)} (${Math.round((v / sum) * 100)}%)">
      <span class="hb-label">${catEmoji(type, cat)} ${esc(cat)}</span>
      <span class="hb-track"><span class="hb-fill" style="width:${Math.max(2, (v / max) * 100)}%"></span></span>
      <span class="hb-val">${rm(v)}</span>
    </li>`).join('')}</ul>`;
}

export function txnRow(t) {
  return `<button class="list-item txn" data-txn="${t.id}">
    <span class="emoji-badge">${catEmoji(t.type, t.category)}</span>
    <span class="grow">
      <span class="li-title">${esc(t.note || t.category)}</span>
      <span class="li-sub">${esc(t.category)}${t.link ? ' · auto' : ''}</span>
    </span>
    <span class="amount ${t.type}">${t.type === 'in' ? '+' : '−'}${rm(t.amount)}</span>
  </button>`;
}

export function bindTxnRows(root) {
  root.querySelectorAll('[data-txn]').forEach((el) =>
    el.addEventListener('click', () => openTxnForm(find('txns', el.dataset.txn))));
}

export function openTxnForm(existing, defaults = {}) {
  const t = existing || { type: 'out', amount: '', category: 'Food', date: today(), note: '', ...defaults };
  const catOptions = (type) => CATEGORIES[type]
    .map(([c, e]) => `<option value="${esc(c)}" ${c === t.category ? 'selected' : ''}>${e} ${esc(c)}</option>`).join('');

  openSheet({
    title: existing ? 'Edit record' : 'New record',
    body: `
      <form class="form" id="txnForm">
        <div class="segmented" role="radiogroup">
          <label><input type="radio" name="type" value="out" ${t.type === 'out' ? 'checked' : ''}><span>${icon('arrowUp')} Expense</span></label>
          <label><input type="radio" name="type" value="in" ${t.type === 'in' ? 'checked' : ''}><span>${icon('arrowDown')} Income</span></label>
        </div>
        <label class="field amount-field">
          <span>Amount (RM)</span>
          <input name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" required value="${esc(t.amount)}" placeholder="0.00">
        </label>
        <label class="field"><span>Category</span>
          <select name="category">${catOptions(t.type)}</select>
        </label>
        <label class="field"><span>Date</span>
          <input name="date" type="date" required value="${esc(t.date)}">
        </label>
        <label class="field"><span>Note</span>
          <input name="note" type="text" maxlength="120" value="${esc(t.note)}" placeholder="e.g. Nasi lemak + iced tea">
        </label>
        ${t.link ? '<p class="hint">This record was created automatically from a kutu group.</p>' : ''}
        <div class="row gap mt">
          ${existing ? `<button type="button" class="btn ghost danger-text" data-del>${icon('trash')} Delete</button>` : ''}
          <button class="btn primary grow" type="submit">${icon('check')} Save</button>
        </div>
      </form>`,
    onMount(root, close) {
      const form = root.querySelector('#txnForm');
      form.querySelectorAll('[name=type]').forEach((r) => r.addEventListener('change', () => {
        t.type = r.value;
        t.category = CATEGORIES[r.value][0][0];
        form.category.innerHTML = catOptions(r.value);
      }));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = formData(form);
        upsert('txns', { ...(existing || {}), ...d, amount: Math.round(parseFloat(d.amount) * 100) / 100 });
        month = monthKey(d.date);
        close();
        toast(existing ? 'Record updated' : 'Record saved 💕');
      });
      root.querySelector('[data-del]')?.addEventListener('click', async () => {
        close();
        if (await confirmSheet('Delete this record?')) { remove('txns', existing.id); toast('Record deleted'); }
      });
    },
  });
}

export default {
  title: 'Expenses',
  fab: () => openTxnForm(),
  render() {
    const all = txnsInMonth(month);
    const tot = totals(all);
    const list = all
      .filter((t) => filter === 'all' || t.type === filter)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));

    const groups = new Map();
    for (const t of list) (groups.get(t.date) || groups.set(t.date, []).get(t.date)).push(t);

    return `
      <div class="month-nav">
        <button class="icon-btn" data-month="-1" aria-label="Previous month">${icon('left')}</button>
        <strong>${fmtMonth(month)}</strong>
        <button class="icon-btn" data-month="1" aria-label="Next month">${icon('right')}</button>
      </div>

      <section class="stats three">
        <div class="stat"><span class="stat-label">Spent</span><span class="stat-val out">${rmStat(tot.out)}</span></div>
        <div class="stat"><span class="stat-label">Income</span><span class="stat-val in">${rmStat(tot.in)}</span></div>
        <div class="stat"><span class="stat-label">Balance</span><span class="stat-val ${tot.balance < 0 ? 'out' : ''}">${rmStat(tot.balance)}</span></div>
      </section>

      <section class="card">
        <h3 class="card-title">Spending by category</h3>
        ${categoryBars(byCategory(all, 'out'))}
      </section>

      <div class="chips">
        ${[['all', 'All'], ['out', 'Expenses'], ['in', 'Income']].map(([k, l]) =>
          `<button class="chip ${filter === k ? 'on' : ''}" data-filter="${k}">${l}</button>`).join('')}
      </div>

      ${list.length ? [...groups].map(([date, items]) => {
        const dayOut = items.filter((t) => t.type === 'out').reduce((a, t) => a + +t.amount, 0);
        return `<section class="day-group">
          <div class="day-head"><span>${fmtDateLong(date)} <span class="muted">· ${relDays(date)}</span></span>${dayOut ? `<span class="muted">${rm(dayOut)}</span>` : ''}</div>
          <div class="list">${items.map(txnRow).join('')}</div>
        </section>`;
      }).join('') : `<div class="empty">
          <div class="empty-emoji">🧾</div>
          <p>No records for ${fmtMonth(month)}.</p>
          <button class="btn primary" data-add>${icon('plus')} Add record</button>
        </div>`}
    `;
  },
  mount(root, rerender) {
    root.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => {
      month = shiftMonth(month, +b.dataset.month); rerender();
    }));
    root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.filter; rerender();
    }));
    root.querySelector('[data-add]')?.addEventListener('click', () => openTxnForm());
    bindTxnRows(root);
  },
};

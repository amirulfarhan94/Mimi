// Dashboard: a loving hello plus today's summary — spending, diary, kutu.
import { getState } from '../store.js';
import { esc, rm, rmStat, today, addDays, monthKey, fmtDateLong, fmtDate, fmtShortDay, relDays } from '../util.js';
import { icon } from '../ui.js';
import { txnsInMonth, totals, byCategory, categoryBars, openTxnForm, txnRow, bindTxnRows } from './expenses.js';
import { openNoteForm, noteCard, bindNoteCards, streak } from './diary.js';
import { openGroupForm } from './kutu.js';
import { openTodoForm, todoRow, bindTodoRows } from './todo.js';
import { sortTodos, isDueToday } from '../todo.js';
import { upcomingEvents, myUpcomingPayouts, pot } from '../kutu.js';
import { letterCard, bindLetterCard } from './loveLetter.js';

/** Vertical bars of the last 7 days of spending (one series; values in tooltip & today's label). */
function weekChart(txns) {
  const now = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(now, i - 6));
  const vals = days.map((d) => txns.filter((t) => t.type === 'out' && t.date === d).reduce((a, t) => a + +t.amount, 0));
  const max = Math.max(...vals, 1);
  const total = vals.reduce((a, b) => a + b, 0);
  return `
    <div class="row between"><h3 class="card-title">Last 7 days</h3><span class="muted small">Total ${rm(total)}</span></div>
    <div class="vbars" role="img" aria-label="Spending over the last 7 days">
      ${days.map((d, i) => `
        <div class="vbar ${d === now ? 'today' : ''}" tabindex="0" data-tip="${fmtDate(d)}: ${rm(vals[i])}">
          <span class="vbar-val">${d === now && vals[i] ? rm(vals[i]).replace('RM', '').trim() : ''}</span>
          <span class="vbar-col"><span class="vbar-fill" style="height:${vals[i] ? Math.max(3, (vals[i] / max) * 100) : 0}%"></span></span>
          <span class="vbar-lbl">${fmtShortDay(d)}</span>
        </div>`).join('')}
    </div>
    <table class="sr-only"><caption>Spending over the last 7 days</caption>
      ${days.map((d, i) => `<tr><th>${fmtDate(d)}</th><td>${rm(vals[i])}</td></tr>`).join('')}</table>`;
}

export default {
  title: 'Mimi',
  render() {
    const s = getState();
    const now = today();
    const mTxns = txnsInMonth(monthKey(now));
    const mTot = totals(mTxns);
    const todayOut = s.txns.filter((t) => t.date === now && t.type === 'out').reduce((a, t) => a + +t.amount, 0);
    const todayNote = s.notes.find((n) => n.date === now);
    const events = upcomingEvents(s.kutu, now, 5);
    const payout = myUpcomingPayouts(s.kutu, now)[0];
    const dueTodos = sortTodos(s.todos.filter((t) => isDueToday(t, now)));
    const recent = [...s.txns].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 4);

    return `
      <section class="love-card">
        <span class="love-hearts" aria-hidden="true">♥ ♡ ♥</span>
        <h1 class="script">Hi Sayang ❤️</h1>
        <p class="love-ask">What would you like to do today?</p>
        <p class="love-date">${fmtDateLong(now)}</p>
        ${letterCard()}
      </section>

      <div class="quick" aria-label="Quick add">
        <button class="quick-btn" data-q="txn"><span>💸</span>Expense</button>
        <button class="quick-btn" data-q="todo"><span>✅</span>To-do</button>
        <button class="quick-btn" data-q="note"><span>📝</span>Diary</button>
        <button class="quick-btn" data-q="kutu"><span>🤝</span>Kutu</button>
      </div>

      <section class="card">
        <div class="row between"><h3 class="card-title">${icon('checklist')} Today's to-do</h3><a class="link" href="#/todo">See all</a></div>
        ${dueTodos.length
          ? `<div class="todos">${dueTodos.slice(0, 5).map(todoRow).join('')}</div>
             ${dueTodos.length > 5 ? `<a class="link small" href="#/todo">+${dueTodos.length - 5} more</a>` : ''}`
          : `<button class="prompt" data-q="todo"><span>🌸</span><span class="grow"><b>Nothing due today</b><br><span class="small muted">Tap to add something to your list.</span></span>${icon('right')}</button>`}
      </section>

      <section class="stats three">
        <div class="stat"><span class="stat-label">Spent today</span><span class="stat-val">${rmStat(todayOut)}</span></div>
        <div class="stat"><span class="stat-label">Spent this month</span><span class="stat-val out">${rmStat(mTot.out)}</span></div>
        <div class="stat"><span class="stat-label">Balance this month</span><span class="stat-val ${mTot.balance < 0 ? 'out' : 'in'}">${rmStat(mTot.balance)}</span></div>
      </section>

      <section class="card">${weekChart(s.txns)}</section>

      <section class="card">
        <div class="row between"><h3 class="card-title">${icon('users')} Duit kutu</h3><a class="link" href="#/kutu">See all</a></div>
        ${payout ? `<a class="payout" href="#/kutu/${payout.group.id}">
            ${icon('gift')}<span class="grow"><b>Your turn to receive ${rm(pot(payout.group))}</b><br>
            <span class="small">${esc(payout.group.name)} · ${fmtDate(payout.round.date)} (${relDays(payout.round.date)})</span></span></a>` : ''}
        ${events.length ? `<div class="list">${events.map((e) => {
          const g = e.group, r = e.round;
          const myPaid = g.members.filter((m) => m.isMe).every((m) => g.paid?.[r.index]?.[m.id]);
          return `<a class="list-item" href="#/kutu/${g.id}">
            <span class="emoji-badge ${e.overdue ? 'warn' : ''}">${e.overdue ? icon('alert') : icon('calendar')}</span>
            <span class="grow">
              <span class="li-title">${esc(g.name)}</span>
              <span class="li-sub">${e.overdue ? 'Overdue · ' : ''}Round ${r.index + 1} → ${esc(r.recipient.name)} · ${fmtDate(r.date)}</span>
            </span>
            <span class="pill ${e.overdue ? 'warn' : e.days <= 2 ? 'soon' : ''}">${relDays(r.date)}</span>
            ${!e.overdue && myPaid && g.members.some((m) => m.isMe) ? `<span class="pill ok">${icon('check')}</span>` : ''}
          </a>`;
        }).join('')}</div>` : `<p class="muted small">No upcoming kutu. <a class="link" href="#/kutu">Create a group</a></p>`}
      </section>

      <section class="card">
        <div class="row between"><h3 class="card-title">${icon('book')} Today's diary</h3><span class="muted small">${streak()}-day streak 🔥</span></div>
        ${todayNote ? `<div class="notes">${noteCard(todayNote)}</div>` : `
          <button class="prompt" data-q="note">
            <span>✍️</span><span class="grow"><b>No diary entry yet today</b><br><span class="small muted">Take 2 minutes to write about your day.</span></span>${icon('right')}
          </button>`}
      </section>

      <section class="card">
        <div class="row between"><h3 class="card-title">${icon('wallet')} Top categories this month</h3><a class="link" href="#/expenses">Details</a></div>
        ${categoryBars(byCategory(mTxns, 'out').slice(0, 4))}
      </section>

      <section class="card">
        <div class="row between"><h3 class="card-title">Recent records</h3><a class="link" href="#/expenses">All</a></div>
        ${recent.length ? `<div class="list">${recent.map(txnRow).join('')}</div>` : '<p class="muted small">No expenses recorded yet.</p>'}
      </section>`;
  },
  mount(root) {
    root.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      ({ txn: () => openTxnForm(), todo: () => openTodoForm(null, { due: today() }), note: () => openNoteForm(), kutu: () => openGroupForm() })[b.dataset.q]();
    }));
    bindTxnRows(root);
    bindNoteCards(root);
    bindTodoRows(root);
    bindLetterCard(root);
  },
};

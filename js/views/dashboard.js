// Dashboard: ringkasan hari ini — belanja, diari, kutu.
import { getState } from '../store.js';
import { esc, rm, rmStat, today, addDays, monthKey, fmtDateLong, fmtDate, fmtShortDay, relDays } from '../util.js';
import { icon } from '../ui.js';
import { txnsInMonth, totals, byCategory, categoryBars, openTxnForm, txnRow, bindTxnRows } from './expenses.js';
import { openNoteForm, noteCard, bindNoteCards, streak } from './diary.js';
import { openGroupForm } from './kutu.js';
import { upcomingEvents, myUpcomingPayouts, pot } from '../kutu.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Selamat pagi';
  if (h < 15) return 'Selamat tengah hari';
  if (h < 19) return 'Selamat petang';
  return 'Selamat malam';
}

/** Carta bar menegak belanja 7 hari (satu siri; nilai dalam tooltip & label hari ini). */
function weekChart(txns) {
  const now = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(now, i - 6));
  const vals = days.map((d) => txns.filter((t) => t.type === 'out' && t.date === d).reduce((a, t) => a + +t.amount, 0));
  const max = Math.max(...vals, 1);
  const total = vals.reduce((a, b) => a + b, 0);
  return `
    <div class="row between"><h3 class="card-title">Belanja 7 hari</h3><span class="muted small">Jumlah ${rm(total)}</span></div>
    <div class="vbars" role="img" aria-label="Belanja 7 hari lepas">
      ${days.map((d, i) => `
        <div class="vbar ${d === now ? 'today' : ''}" tabindex="0" data-tip="${fmtDate(d)}: ${rm(vals[i])}">
          <span class="vbar-val">${d === now && vals[i] ? rm(vals[i]).replace('RM', '').trim() : ''}</span>
          <span class="vbar-col"><span class="vbar-fill" style="height:${vals[i] ? Math.max(3, (vals[i] / max) * 100) : 0}%"></span></span>
          <span class="vbar-lbl">${fmtShortDay(d)}</span>
        </div>`).join('')}
    </div>
    <table class="sr-only"><caption>Belanja 7 hari</caption>
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
    const recent = [...s.txns].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 4);
    const name = s.settings.name ? `, ${esc(s.settings.name)}` : '';

    return `
      <header class="hello">
        <p class="muted">${fmtDateLong(now)}</p>
        <h1>${greeting()}${name} 👋</h1>
      </header>

      <div class="quick">
        <button class="quick-btn" data-q="txn"><span>💸</span>Rekod belanja</button>
        <button class="quick-btn" data-q="note"><span>📝</span>Tulis diari</button>
        <button class="quick-btn" data-q="kutu"><span>🤝</span>Kutu baru</button>
      </div>

      <section class="stats three">
        <div class="stat"><span class="stat-label">Belanja hari ini</span><span class="stat-val">${rmStat(todayOut)}</span></div>
        <div class="stat"><span class="stat-label">Belanja bulan ini</span><span class="stat-val out">${rmStat(mTot.out)}</span></div>
        <div class="stat"><span class="stat-label">Baki bulan ini</span><span class="stat-val ${mTot.balance < 0 ? 'out' : 'in'}">${rmStat(mTot.balance)}</span></div>
      </section>

      <section class="card">${weekChart(s.txns)}</section>

      <section class="card">
        <div class="row between"><h3 class="card-title">${icon('users')} Duit kutu</h3><a class="link" href="#/kutu">Lihat semua</a></div>
        ${payout ? `<a class="payout" href="#/kutu/${payout.group.id}">
            ${icon('gift')}<span class="grow"><b>Giliran anda dapat ${rm(pot(payout.group))}</b><br>
            <span class="small">${esc(payout.group.name)} · ${fmtDate(payout.round.date)} (${relDays(payout.round.date)})</span></span></a>` : ''}
        ${events.length ? `<div class="list">${events.map((e) => {
          const g = e.group, r = e.round;
          const myPaid = g.members.filter((m) => m.isMe).every((m) => g.paid?.[r.index]?.[m.id]);
          return `<a class="list-item" href="#/kutu/${g.id}">
            <span class="emoji-badge ${e.overdue ? 'warn' : ''}">${e.overdue ? icon('alert') : icon('calendar')}</span>
            <span class="grow">
              <span class="li-title">${esc(g.name)}</span>
              <span class="li-sub">${e.overdue ? 'Tertunggak · ' : ''}Pusingan ${r.index + 1} → ${esc(r.recipient.name)} · ${fmtDate(r.date)}</span>
            </span>
            <span class="pill ${e.overdue ? 'warn' : e.days <= 2 ? 'soon' : ''}">${relDays(r.date)}</span>
            ${!e.overdue && myPaid && g.members.some((m) => m.isMe) ? `<span class="pill ok">${icon('check')}</span>` : ''}
          </a>`;
        }).join('')}</div>` : `<p class="muted small">Tiada kutu akan datang. <a class="link" href="#/kutu">Cipta kumpulan</a></p>`}
      </section>

      <section class="card">
        <div class="row between"><h3 class="card-title">${icon('book')} Diari hari ini</h3><span class="muted small">${streak()} hari berturut 🔥</span></div>
        ${todayNote ? `<div class="notes">${noteCard(todayNote)}</div>` : `
          <button class="prompt" data-q="note">
            <span>✍️</span><span class="grow"><b>Belum tulis diari hari ini</b><br><span class="small muted">Luangkan 2 minit untuk catat hari anda.</span></span>${icon('right')}
          </button>`}
      </section>

      <section class="card">
        <div class="row between"><h3 class="card-title">${icon('wallet')} Kategori teratas bulan ini</h3><a class="link" href="#/belanja">Butiran</a></div>
        ${categoryBars(byCategory(mTxns, 'out').slice(0, 4))}
      </section>

      <section class="card">
        <div class="row between"><h3 class="card-title">Rekod terkini</h3><a class="link" href="#/belanja">Semua</a></div>
        ${recent.length ? `<div class="list">${recent.map(txnRow).join('')}</div>` : '<p class="muted small">Belum ada rekod belanja.</p>'}
      </section>`;
  },
  mount(root) {
    root.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      ({ txn: () => openTxnForm(), note: () => openNoteForm(), kutu: () => openGroupForm() })[b.dataset.q]();
    }));
    bindTxnRows(root);
    bindNoteCards(root);
  },
};

// Duit kutu group management (list + detail).
import { getState, upsert, find, update } from '../store.js';
import { esc, rm, rmStat, today, fmtDate, fmtDateLong, relDays, uid } from '../util.js';
import { openSheet, confirmSheet, toast, formData, icon } from '../ui.js';
import {
  FREQUENCIES, freqShort, status, pot, mySlots, myContribution, STATE_LABEL,
  togglePaid, toggleHandedOut, markAllPaid, deleteGroup,
} from '../kutu.js';

const openRounds = new Set(); // rounds currently expanded (per session)
const seenGroups = new Set(); // groups whose current round was already auto-expanded

/** "Me" tag for my slots — skipped when the slot is already named "Me". */
const meTag = (m) => (m.isMe && m.name.trim().toLowerCase() !== 'me' ? ' <span class="tag">Me</span>' : '');

// ---------- Group form ----------
export function openGroupForm(existing) {
  const g = existing
    ? structuredClone(existing)
    : { name: '', amount: '', frequency: 'monthly', intervalDays: 14, startDate: today(), members: [{ id: uid(), name: 'Me', isMe: true }], note: '' };

  const memberRow = (m, i) => `
    <li class="member-row" data-id="${m.id}">
      <span class="turn">${i + 1}</span>
      <input class="grow" type="text" value="${esc(m.name)}" placeholder="Member name" aria-label="Member name ${i + 1}" data-name required>
      <label class="me-toggle" title="This is me"><input type="checkbox" data-me ${m.isMe ? 'checked' : ''}><span>Me</span></label>
      <button type="button" class="icon-btn sm" data-up aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${icon('arrowUp')}</button>
      <button type="button" class="icon-btn sm" data-rm aria-label="Remove">${icon('x')}</button>
    </li>`;

  openSheet({
    title: existing ? 'Edit kutu group' : 'New kutu group',
    body: `
      <form class="form" id="groupForm">
        <label class="field"><span>Group name</span>
          <input name="name" required maxlength="60" value="${esc(g.name)}" placeholder="e.g. Office Girls Kutu">
        </label>
        <label class="field"><span>Contribution per member, per round (RM)</span>
          <input name="amount" type="number" inputmode="decimal" step="0.01" min="1" required value="${esc(g.amount)}" placeholder="100">
        </label>
        <fieldset class="field">
          <legend>How often</legend>
          <div class="segmented four">
            ${Object.entries(FREQUENCIES).map(([k, f]) => `<label><input type="radio" name="frequency" value="${k}" ${g.frequency === k ? 'checked' : ''}><span>${k === 'custom' ? 'Custom' : f.short}</span></label>`).join('')}
          </div>
        </fieldset>
        <label class="field" id="customDays" ${g.frequency === 'custom' ? '' : 'hidden'}><span>Every how many days?</span>
          <input name="intervalDays" type="number" min="1" max="366" value="${esc(g.intervalDays || 14)}">
        </label>
        <label class="field"><span>First round date</span>
          <input name="startDate" type="date" required value="${esc(g.startDate)}">
        </label>
        <div class="field">
          <div class="row between"><span class="label">Members in turn order</span>
            <button type="button" class="btn ghost sm" data-shuffle>🎲 Shuffle</button></div>
          <ol class="members" id="members">${g.members.map(memberRow).join('')}</ol>
          <div class="row gap">
            <input type="text" id="newMember" class="grow" placeholder="Add member names…" aria-label="New member name">
            <button type="button" class="btn" data-add-member>${icon('plus')} Add</button>
          </div>
          <p class="hint">Tick <b>Me</b> on your slot(s) — you can hold more than one. The order is who receives the pot when. Separate several names with commas.</p>
        </div>
        <p class="summary" id="groupSummary"></p>
        <label class="field"><span>Note (optional)</span>
          <input name="note" maxlength="200" value="${esc(g.note)}" placeholder="e.g. Pay via DuitNow to Kak Ros">
        </label>
        <button class="btn primary block mt" type="submit">${icon('check')} Save group</button>
      </form>`,
    onMount(root, close) {
      const form = root.querySelector('#groupForm');
      const list = root.querySelector('#members');
      const newInput = root.querySelector('#newMember');

      // Sync input values into g.members before re-rendering
      const sync = () => {
        g.members = [...list.children].map((li) => {
          const prev = g.members.find((m) => m.id === li.dataset.id) || {};
          return { ...prev, id: li.dataset.id, name: li.querySelector('[data-name]').value, isMe: li.querySelector('[data-me]').checked };
        });
      };
      const summary = () => {
        const d = formData(form);
        const n = g.members.length;
        const amt = parseFloat(d.amount) || 0;
        const freq = d.frequency === 'custom' ? `${d.intervalDays} days` : FREQUENCIES[d.frequency].short;
        root.querySelector('#groupSummary').innerHTML = n
          ? `${n} members × ${rm(amt)} = <b>${rm(n * amt)}</b> per round · ${n} rounds, every ${freq}`
          : 'Add at least one member.';
      };
      const draw = () => { list.innerHTML = g.members.map(memberRow).join(''); summary(); };
      const addMember = () => {
        const names = newInput.value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        if (!names.length) return;
        sync();
        names.forEach((name) => g.members.push({ id: uid(), name, isMe: false }));
        newInput.value = '';
        draw();
        newInput.focus();
      };

      list.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        sync();
        const i = g.members.findIndex((m) => m.id === li.dataset.id);
        if (e.target.closest('[data-up]') && i > 0) {
          [g.members[i - 1], g.members[i]] = [g.members[i], g.members[i - 1]];
          draw();
        } else if (e.target.closest('[data-rm]')) {
          g.members.splice(i, 1);
          draw();
        }
      });
      list.addEventListener('change', sync);
      root.querySelector('[data-add-member]').addEventListener('click', addMember);
      newInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } });
      root.querySelector('[data-shuffle]').addEventListener('click', () => {
        sync();
        for (let i = g.members.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [g.members[i], g.members[j]] = [g.members[j], g.members[i]];
        }
        draw();
        toast('Turn order shuffled');
      });
      form.addEventListener('input', summary);
      form.querySelectorAll('[name=frequency]').forEach((r) => r.addEventListener('change', () => {
        root.querySelector('#customDays').hidden = r.value !== 'custom';
      }));
      summary();

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        sync();
        g.members = g.members.map((m) => ({ ...m, name: m.name.trim() })).filter((m) => m.name);
        if (g.members.length < 2) { toast('A group needs at least 2 members'); return; }
        const d = formData(form);
        const saved = {
          ...g,
          name: d.name.trim(),
          amount: Math.round(parseFloat(d.amount) * 100) / 100,
          frequency: d.frequency,
          intervalDays: Math.max(1, parseInt(d.intervalDays, 10) || 14),
          startDate: d.startDate,
          note: d.note,
        };
        upsert('kutu', saved);
        close();
        toast(existing ? 'Group updated' : 'Kutu group created 💕');
        if (!existing) {
          const created = getState().kutu[getState().kutu.length - 1];
          location.hash = `#/kutu/${created.id}`;
        }
      });
    },
  });
}

// ---------- Group card (list & dashboard) ----------
export function groupCard(g) {
  const st = status(g);
  const next = st.next;
  const mine = st.rounds.filter((r) => r.recipient.isMe);
  const nextMine = mine.find((r) => r.date >= today());
  return `<a class="card kutu-card" href="#/kutu/${g.id}">
    <div class="row between">
      <h3 class="card-title">${esc(g.name)}</h3>
      <span class="badge ${st.state}">${STATE_LABEL[st.state]}</span>
    </div>
    <div class="kutu-meta">
      <span>${icon('calendar')} ${freqShort(g)}</span>
      <span>${g.members.length} members</span>
      <span>${rm(g.amount)}/slot</span>
      <span>Pot ${rm(pot(g))}</span>
    </div>
    <div class="progress" role="progressbar" aria-valuenow="${Math.round(st.progress * 100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${st.progress * 100}%"></span></div>
    ${next ? `<p class="kutu-next">Round ${next.index + 1}: <b>${fmtDate(next.date)}</b> (${relDays(next.date)}) → ${esc(next.recipient.name)}${next.recipient.isMe ? ' 🎉' : ''}</p>` : ''}
    ${nextMine ? `<p class="kutu-mine">${icon('gift')} My turn: round ${nextMine.index + 1}, ${fmtDate(nextMine.date)}</p>` : ''}
  </a>`;
}

// ---------- Group detail ----------
function renderDetail(g) {
  const st = status(g);
  const now = today();
  const slots = mySlots(g);
  const myRounds = st.rounds.filter((r) => r.recipient.isMe);
  const myPaidTotal = st.rounds.reduce((a, r) =>
    a + g.members.filter((m) => m.isMe && g.paid?.[r.index]?.[m.id]).length * g.amount, 0);
  const expected = st.current ? st.current.index : -1;
  if (!seenGroups.has(g.id)) {
    seenGroups.add(g.id);
    const focus = st.current || st.next;
    if (focus) openRounds.add(`${g.id}:${focus.index}`);
  }

  return `
    <a class="back" href="#/kutu">${icon('left')} All groups</a>
    <section class="card hero">
      <div class="row between">
        <h2>${esc(g.name)}</h2>
        <span class="badge ${st.state}">${STATE_LABEL[st.state]}</span>
      </div>
      <p class="muted">${FREQUENCIES[g.frequency].label}${g.frequency === 'custom' ? ` — ${g.intervalDays} days` : ''} · started ${fmtDate(g.startDate)}</p>
      ${g.note ? `<p class="small">${esc(g.note)}</p>` : ''}
      <div class="stats two mt">
        <div class="stat"><span class="stat-label">Pot per round</span><span class="stat-val">${rmStat(pot(g))}</span></div>
        <div class="stat"><span class="stat-label">My share / round</span><span class="stat-val">${slots ? rmStat(myContribution(g)) : '—'}</span></div>
        <div class="stat"><span class="stat-label">I have paid</span><span class="stat-val">${rmStat(myPaidTotal)}</span></div>
        <div class="stat"><span class="stat-label">My turn</span><span class="stat-val small-val">${myRounds.length ? myRounds.map((r) => `#${r.index + 1} · ${fmtDate(r.date)}`).join('<br>') : '—'}</span></div>
      </div>
      <div class="progress mt"><span style="width:${st.progress * 100}%"></span></div>
      <p class="muted small">${Math.round(st.progress * 100)}% of rounds fully paid</p>
      <div class="row gap mt">
        <button class="btn" data-edit>${icon('edit')} Edit</button>
        <button class="btn ghost" data-archive>${g.archived ? 'Unarchive' : 'Archive'}</button>
        <button class="btn ghost danger-text" data-delete>${icon('trash')} Delete</button>
      </div>
    </section>

    <h3 class="section-title">Round schedule</h3>
    <div class="rounds">
      ${st.rounds.map((r) => {
        const key = `${g.id}:${r.index}`;
        const complete = r.paidCount === g.members.length;
        const isPast = r.date < now;
        const isCurrent = r.index === expected;
        const myUnpaid = g.members.some((m) => m.isMe && !g.paid?.[r.index]?.[m.id]);
        const cls = [complete ? 'complete' : '', isCurrent ? 'current' : '', isPast && !complete ? 'late' : ''].join(' ');
        return `<details class="round ${cls}" data-key="${key}" ${openRounds.has(key) ? 'open' : ''}>
          <summary>
            <span class="round-no">${r.index + 1}</span>
            <span class="grow">
              <span class="li-title">${esc(r.recipient.name)}${meTag(r.recipient)}</span>
              <span class="li-sub">${fmtDateLong(r.date)} · ${relDays(r.date)}</span>
            </span>
            <span class="round-count ${complete ? 'ok' : ''}">${r.paidCount}/${g.members.length}${isPast && myUnpaid ? ' ⚠️' : ''}</span>
          </summary>
          <div class="round-body">
            <ul class="pay-list">
              ${g.members.map((m) => {
                const paid = !!g.paid?.[r.index]?.[m.id];
                return `<li><label class="check">
                  <input type="checkbox" data-pay="${r.index}:${m.id}" ${paid ? 'checked' : ''}>
                  <span class="grow">${esc(m.name)}${meTag(m)}</span>
                  <span class="muted small">${paid ? 'Paid' : rm(g.amount)}</span>
                </label></li>`;
              }).join('')}
            </ul>
            <div class="row gap wrap mt">
              ${complete ? '' : `<button class="btn sm" data-all="${r.index}">${icon('check')} Mark all as paid</button>`}
              <label class="check inline"><input type="checkbox" data-handout="${r.index}" ${r.handedOut ? 'checked' : ''}>
                <span>${rm(pot(g))} handed to ${esc(r.recipient.name)}</span></label>
            </div>
          </div>
        </details>`;
      }).join('')}
    </div>
    <p class="hint">Ticking a <b>Me</b> payment adds a Kutu expense automatically. When your turn's pot is handed to you, an income record is added.</p>`;
}

function mountDetail(root, g) {
  root.querySelectorAll('details.round').forEach((d) => d.addEventListener('toggle', () => {
    d.open ? openRounds.add(d.dataset.key) : openRounds.delete(d.dataset.key);
  }));
  root.querySelectorAll('[data-pay]').forEach((cb) => cb.addEventListener('change', () => {
    const [round, memberId] = cb.dataset.pay.split(':');
    togglePaid(g.id, +round, memberId);
  }));
  root.querySelectorAll('[data-all]').forEach((b) => b.addEventListener('click', () => {
    markAllPaid(g.id, +b.dataset.all);
    toast('Everyone marked as paid');
  }));
  root.querySelectorAll('[data-handout]').forEach((cb) => cb.addEventListener('change', () => {
    toggleHandedOut(g.id, +cb.dataset.handout);
  }));
  root.querySelector('[data-edit]').addEventListener('click', () => openGroupForm(g));
  root.querySelector('[data-archive]').addEventListener('click', () => {
    const archiving = !g.archived;
    update((s) => { s.kutu.find((k) => k.id === g.id).archived = archiving; });
    toast(archiving ? 'Group archived' : 'Group unarchived');
  });
  root.querySelector('[data-delete]').addEventListener('click', async () => {
    if (await confirmSheet(`Delete "${esc(g.name)}"? Its automatic expense/income records will be deleted too.`)) {
      deleteGroup(g.id);
      location.hash = '#/kutu';
      toast('Group deleted');
    }
  });
}

// ---------- List ----------
let showArchived = false;

export default {
  title: 'Duit Kutu',
  fab: () => openGroupForm(),
  render({ id } = {}) {
    if (id) {
      const g = find('kutu', id);
      return g ? renderDetail(g) : '<div class="empty"><p>Group not found.</p><a class="btn" href="#/kutu">Back</a></div>';
    }
    const groups = getState().kutu;
    const active = groups.filter((g) => !g.archived);
    const archived = groups.filter((g) => g.archived);
    const monthly = active.reduce((a, g) => {
      const perRound = myContribution(g);
      const days = g.frequency === 'weekly' ? 7 : g.frequency === '10days' ? 10 : g.frequency === 'monthly' ? 30.44 : g.intervalDays;
      return a + perRound * (30.44 / days);
    }, 0);

    if (!groups.length) {
      return `<div class="empty">
        <div class="empty-emoji">🤝</div>
        <p>Manage your duit kutu groups — weekly, every 10 days, monthly or any interval you like.</p>
        <button class="btn primary" data-new>${icon('plus')} Create a kutu group</button>
      </div>`;
    }
    return `
      <section class="stats two">
        <div class="stat"><span class="stat-label">Active groups</span><span class="stat-val">${active.length}</span></div>
        <div class="stat"><span class="stat-label">Est. my monthly share</span><span class="stat-val">${rmStat(monthly)}</span></div>
      </section>
      <div class="kutu-list">${active.map(groupCard).join('') || '<p class="muted">No active groups.</p>'}</div>
      ${archived.length ? `
        <button class="btn ghost block mt" data-toggle-archived>${showArchived ? 'Hide' : 'Show'} archived (${archived.length})</button>
        ${showArchived ? `<div class="kutu-list mt">${archived.map(groupCard).join('')}</div>` : ''}` : ''}`;
  },
  mount(root, rerender, { id } = {}) {
    if (id) {
      const g = find('kutu', id);
      if (g) mountDetail(root, g);
      return;
    }
    root.querySelector('[data-new]')?.addEventListener('click', () => openGroupForm());
    root.querySelector('[data-toggle-archived]')?.addEventListener('click', () => { showArchived = !showArchived; rerender(); });
  },
};

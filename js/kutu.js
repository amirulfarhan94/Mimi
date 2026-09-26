// Duit kutu group logic: round schedule, turn order, payment status.
import { addDays, addMonths, today, daysBetween } from './util.js';
import { update, getState } from './store.js';
import { uid } from './util.js';

/*
  Kutu group:
  {
    id, name, amount,            // amount = each member's contribution per round
    frequency: 'weekly' | '10days' | 'monthly' | 'custom',
    intervalDays,                // only for 'custom'
    startDate,                   // date of the first round (YYYY-MM-DD)
    members: [{ id, name, isMe }],  // order = turn order
    paid: { [round]: { [memberId]: true } },
    handedOut: { [round]: true },   // the round's pot has been handed over
    note, archived
  }
*/

export const FREQUENCIES = {
  weekly: { label: 'Weekly (7 days)', short: '1 week' },
  '10days': { label: 'Every 10 days', short: '10 days' },
  monthly: { label: 'Monthly', short: '1 month' },
  custom: { label: 'Custom (days)', short: 'custom' },
};

export const freqShort = (g) =>
  g.frequency === 'custom' ? `${g.intervalDays} days` : FREQUENCIES[g.frequency].short;

/** Date of round i (0-indexed). */
export function roundDate(g, i) {
  switch (g.frequency) {
    case 'weekly': return addDays(g.startDate, 7 * i);
    case '10days': return addDays(g.startDate, 10 * i);
    case 'monthly': return addMonths(g.startDate, i);
    default: return addDays(g.startDate, (Number(g.intervalDays) || 1) * i);
  }
}

export const totalRounds = (g) => g.members.length;
export const pot = (g) => g.amount * g.members.length;
export const mySlots = (g) => g.members.filter((m) => m.isMe).length;
export const myContribution = (g) => g.amount * mySlots(g);

export function rounds(g) {
  return g.members.map((m, i) => ({
    index: i,
    date: roundDate(g, i),
    recipient: m,
    paidCount: g.members.filter((x) => g.paid?.[i]?.[x.id]).length,
    handedOut: !!g.handedOut?.[i],
  }));
}

/**
 * Current group status.
 * current = latest round dated <= today (or null if not started yet).
 * next    = first round dated >= today.
 */
export function status(g, now = today()) {
  const rs = rounds(g);
  if (!rs.length) return { state: 'empty', rounds: rs, current: null, next: null, progress: 0 };
  let current = null;
  for (const r of rs) if (r.date <= now) current = r;
  const next = rs.find((r) => r.date >= now) || null;
  const allPaid = rs.every((r) => r.paidCount === g.members.length);
  const done = rs.filter((r) => r.paidCount === g.members.length).length;
  let state;
  if (g.archived) state = 'archived';
  else if (!current) state = 'upcoming';
  else if (!next && allPaid) state = 'finished';
  else state = 'active';
  return { state, rounds: rs, current, next, progress: done / rs.length };
}

export const STATE_LABEL = {
  upcoming: 'Not started',
  active: 'Active',
  finished: 'Completed',
  archived: 'Archived',
  empty: 'No members',
};

/** Upcoming events across all groups (for the dashboard). */
export function upcomingEvents(groups, now = today(), limit = 5) {
  const events = [];
  for (const g of groups) {
    if (g.archived) continue;
    const st = status(g, now);
    for (const r of st.rounds) {
      if (r.date < now) {
        // Past rounds I haven't paid -> overdue
        const unpaidMine = g.members.filter((m) => m.isMe && !g.paid?.[r.index]?.[m.id]);
        if (unpaidMine.length) events.push({ group: g, round: r, overdue: true, days: daysBetween(now, r.date) });
        continue;
      }
      events.push({ group: g, round: r, overdue: false, days: daysBetween(now, r.date) });
      break; // only the next round of each group
    }
  }
  return events.sort((a, b) => a.round.date.localeCompare(b.round.date)).slice(0, limit);
}

/** Rounds where I'm the recipient and that haven't passed. */
export function myUpcomingPayouts(groups, now = today()) {
  const out = [];
  for (const g of groups) {
    if (g.archived) continue;
    for (const r of rounds(g)) {
      if (r.recipient.isMe && r.date >= now) out.push({ group: g, round: r });
    }
  }
  return out.sort((a, b) => a.round.date.localeCompare(b.round.date));
}

// ---------- Mutations ----------

/**
 * Mark/unmark a member's payment for a round.
 * If the member is "Me", a Kutu expense record is created/removed automatically.
 */
export function togglePaid(groupId, round, memberId) {
  update((s) => {
    const g = s.kutu.find((x) => x.id === groupId);
    if (!g) return;
    g.paid ||= {};
    g.paid[round] ||= {};
    const member = g.members.find((m) => m.id === memberId);
    const nowPaid = !g.paid[round][memberId];
    if (nowPaid) g.paid[round][memberId] = true;
    else delete g.paid[round][memberId];

    if (member?.isMe) {
      const match = (t) => t.link?.kutuId === g.id && t.link.round === round && t.link.memberId === memberId && t.link.kind === 'pay';
      if (nowPaid) {
        const date = roundDate(g, round);
        s.txns.push({
          id: uid(), type: 'out', amount: g.amount, category: 'Kutu',
          date: date > today() ? today() : date,
          note: `Paid ${g.name} — round ${round + 1}`,
          link: { kutuId: g.id, round, memberId, kind: 'pay' },
          createdAt: new Date().toISOString(),
        });
      } else {
        s.txns = s.txns.filter((t) => !match(t));
      }
    }
  });
}

/** Mark every member as paid for a round (only my slots create expense records). */
export function markAllPaid(groupId, round) {
  const g = getState().kutu.find((x) => x.id === groupId);
  if (!g) return;
  for (const m of g.members) if (!g.paid?.[round]?.[m.id]) togglePaid(groupId, round, m.id);
}

/**
 * Mark the round's pot as handed to the recipient.
 * If the recipient is "Me", a Kutu income record is created/removed.
 */
export function toggleHandedOut(groupId, round) {
  update((s) => {
    const g = s.kutu.find((x) => x.id === groupId);
    if (!g) return;
    g.handedOut ||= {};
    const now = !g.handedOut[round];
    if (now) g.handedOut[round] = true;
    else delete g.handedOut[round];

    const recipient = g.members[round];
    if (recipient?.isMe) {
      const match = (t) => t.link?.kutuId === g.id && t.link.round === round && t.link.kind === 'receive';
      if (now) {
        const date = roundDate(g, round);
        s.txns.push({
          id: uid(), type: 'in', amount: pot(g), category: 'Kutu',
          date: date > today() ? today() : date,
          note: `Received ${g.name} — round ${round + 1}`,
          link: { kutuId: g.id, round, memberId: recipient.id, kind: 'receive' },
          createdAt: new Date().toISOString(),
        });
      } else {
        s.txns = s.txns.filter((t) => !match(t));
      }
    }
  });
}

/** Delete a group along with its auto-created transactions. */
export function deleteGroup(groupId) {
  update((s) => {
    s.kutu = s.kutu.filter((g) => g.id !== groupId);
    s.txns = s.txns.filter((t) => t.link?.kutuId !== groupId);
  });
}

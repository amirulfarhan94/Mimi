// Logik kumpulan duit kutu: jadual pusingan, giliran, status bayaran.
import { addDays, addMonths, today, daysBetween } from './util.js';
import { update, getState } from './store.js';
import { uid } from './util.js';

/*
  Kumpulan kutu:
  {
    id, name, amount,            // amount = caruman setiap ahli setiap pusingan
    frequency: 'weekly' | '10days' | 'monthly' | 'custom',
    intervalDays,                // hanya untuk 'custom'
    startDate,                   // tarikh pusingan pertama (YYYY-MM-DD)
    members: [{ id, name, isMe }],  // susunan = susunan giliran
    paid: { [round]: { [memberId]: true } },
    handedOut: { [round]: true },   // duit pusingan sudah diserahkan
    note, archived
  }
*/

export const FREQUENCIES = {
  weekly: { label: 'Mingguan (7 hari)', short: '1 minggu' },
  '10days': { label: 'Setiap 10 hari', short: '10 hari' },
  monthly: { label: 'Bulanan', short: '1 bulan' },
  custom: { label: 'Tempoh lain (hari)', short: 'custom' },
};

export const freqShort = (g) =>
  g.frequency === 'custom' ? `${g.intervalDays} hari` : FREQUENCIES[g.frequency].short;

/** Tarikh untuk pusingan ke-i (0-indexed). */
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
 * Status semasa kumpulan.
 * current = pusingan terkini yang tarikhnya <= hari ini (atau null jika belum mula).
 * next    = pusingan pertama yang tarikhnya >= hari ini.
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
  upcoming: 'Belum mula',
  active: 'Aktif',
  finished: 'Selesai',
  archived: 'Diarkib',
  empty: 'Tiada ahli',
};

/** Acara akan datang merentas semua kumpulan (untuk dashboard). */
export function upcomingEvents(groups, now = today(), limit = 5) {
  const events = [];
  for (const g of groups) {
    if (g.archived) continue;
    const st = status(g, now);
    for (const r of st.rounds) {
      if (r.date < now) {
        // Pusingan lepas yang saya belum bayar -> tunggakan
        const unpaidMine = g.members.filter((m) => m.isMe && !g.paid?.[r.index]?.[m.id]);
        if (unpaidMine.length) events.push({ group: g, round: r, overdue: true, days: daysBetween(now, r.date) });
        continue;
      }
      events.push({ group: g, round: r, overdue: false, days: daysBetween(now, r.date) });
      break; // hanya pusingan seterusnya bagi setiap kumpulan
    }
  }
  return events.sort((a, b) => a.round.date.localeCompare(b.round.date)).slice(0, limit);
}

/** Pusingan di mana saya penerima dan belum lepas. */
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

// ---------- Mutasi ----------

/**
 * Tanda/nyahtanda bayaran ahli untuk satu pusingan.
 * Jika ahli itu "Saya", rekod perbelanjaan kategori Kutu dicipta/dibuang secara automatik.
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
          note: `Bayar ${g.name} — pusingan ${round + 1}`,
          link: { kutuId: g.id, round, memberId, kind: 'pay' },
          createdAt: new Date().toISOString(),
        });
      } else {
        s.txns = s.txns.filter((t) => !match(t));
      }
    }
  });
}

/** Tanda semua ahli sudah bayar untuk pusingan (tidak cipta rekod belanja untuk orang lain). */
export function markAllPaid(groupId, round) {
  const g = getState().kutu.find((x) => x.id === groupId);
  if (!g) return;
  for (const m of g.members) if (!g.paid?.[round]?.[m.id]) togglePaid(groupId, round, m.id);
}

/**
 * Tanda duit pusingan sudah diserahkan kepada penerima.
 * Jika penerima ialah "Saya", rekod pendapatan kategori Kutu dicipta/dibuang.
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
          note: `Terima ${g.name} — pusingan ${round + 1}`,
          link: { kutuId: g.id, round, memberId: recipient.id, kind: 'receive' },
          createdAt: new Date().toISOString(),
        });
      } else {
        s.txns = s.txns.filter((t) => !match(t));
      }
    }
  });
}

/** Buang kumpulan beserta rekod transaksi automatik yang berkaitan. */
export function deleteGroup(groupId) {
  update((s) => {
    s.kutu = s.kutu.filter((g) => g.id !== groupId);
    s.txns = s.txns.filter((t) => t.link?.kutuId !== groupId);
  });
}

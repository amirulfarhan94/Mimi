// Push reminders: builds the upcoming reminder list from local data and keeps the reminder server in sync.
// Only reminder titles/times leave the phone; everything else stays in localStorage.
import { getState } from './store.js';
import { today, addDays, parseISO, rm } from './util.js';
import { rounds, pot } from './kutu.js';
import { sortTodos, fmtTime } from './todo.js';
import { weightSettings } from './weight.js';

const DAYS_AHEAD = 45;   // how far ahead reminders are scheduled (refreshed whenever the app opens)
const DAILY_HOUR = 8;    // 8:00 am: today's to-dos, kutu payments and kutu turns

const at = (iso, h, m = 0) => { const d = parseISO(iso); d.setHours(h, m, 0, 0); return d.getTime(); };
const list = (titles) => titles.slice(0, 3).join(' · ') + (titles.length > 3 ? ` +${titles.length - 3} more` : '');

/** Upcoming reminders ({ id, at, title, body, url }) for the next DAYS_AHEAD days. Pure: depends only on state & now. */
export function buildReminders(state, now = new Date()) {
  const nowMs = now.getTime();
  const start = today();
  const open = state.todos.filter((t) => !t.done && t.due);
  const out = [];
  // Daily weigh-in (once she has started logging); skipped on days already logged. No numbers are sent.
  const ws = weightSettings(state);
  const weights = state.weights || [];
  const [wh, wm] = (ws.reminder.time || '07:00').split(':').map(Number);
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = addDays(start, i);
    const tw = at(day, wh, wm);
    if (ws.reminder.on && weights.length && tw > nowMs && !weights.some((w) => w.date === day)) {
      out.push({ id: `weigh:${day}`, at: tw, title: '⚖️ Time to weigh in', body: 'A quick check-in for today 💕', url: './#/weight' });
    }
    const t8 = at(day, DAILY_HOUR);
    if (t8 <= nowMs) continue;
    // To-dos due that day (today's summary also includes anything overdue)
    const due = sortTodos(open.filter((t) => (i === 0 ? t.due <= day : t.due === day)));
    if (due.length) out.push({ id: `todo-day:${day}`, at: t8, title: `✅ To-do today (${due.length})`, body: list(due.map((t) => t.title)), url: './#/todo' });
    // Kutu rounds on that day
    for (const g of state.kutu) {
      if (g.archived) continue;
      for (const r of rounds(g)) {
        if (r.date !== day) continue;
        const unpaid = g.members.filter((m) => m.isMe && !g.paid?.[r.index]?.[m.id]).length;
        if (unpaid) {
          out.push({ id: `kutu-pay:${g.id}:${r.index}`, at: t8, title: '🤝 Kutu payment today',
            body: `${g.name} — ${rm(g.amount * unpaid)} · round ${r.index + 1} → ${r.recipient.isMe ? 'you' : r.recipient.name}`, url: `./#/kutu/${g.id}` });
        }
        if (r.recipient.isMe && !r.handedOut) {
          out.push({ id: `kutu-turn:${g.id}:${r.index}`, at: t8, title: '🎉 Your kutu turn today!',
            body: `${g.name} — you receive ${rm(pot(g))}`, url: `./#/kutu/${g.id}` });
        }
      }
    }
  }
  // To-dos with a time: remind at that time
  const horizon = nowMs + DAYS_AHEAD * 864e5;
  for (const t of open) {
    if (!t.time) continue;
    const [h, m] = t.time.split(':').map(Number);
    const when = at(t.due, h, m);
    if (when > nowMs && when < horizon) out.push({ id: `todo-at:${t.id}:${t.due}T${t.time}`, at: when, title: `⏰ ${t.title}`, body: `${fmtTime(t.time)}${t.note ? ` · ${t.note}` : ''}`, url: './#/todo' });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 400);
}

// ---------- push subscription & server sync ----------
const cfg = () => self.MIMI_PUSH || {};
const K = { token: 'mimi:push:token', on: 'mimi:push:on', hash: 'mimi:push:hash' };
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

export const pushConfigured = () => !!cfg().workerUrl;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushOn = () => ls.get(K.on) === '1';

function token() {
  let t = ls.get(K.token);
  if (!t) { t = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/[^A-Za-z0-9]/g, ''); ls.set(K.token, t); }
  return t;
}
async function api(path, body) {
  const res = await fetch(cfg().workerUrl.replace(/\/$/, '') + path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!res.ok) throw new Error(`Reminder server error (${res.status})`);
  return res.json();
}
const b64ToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };

/** Ask permission, subscribe to push and send the reminders. Throws with a readable message on failure. */
export async function enablePush() {
  if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications were not allowed');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api('/vapid-public-key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  // The service worker reads the device token from this cache when a push arrives.
  await (await caches.open('mimi-push')).put('./push-token', new Response(JSON.stringify({ token: token() })));
  ls.set(K.on, '1');
  await syncReminders(true);
}

export async function disablePush() {
  ls.set(K.on, '0'); ls.set(K.hash, '');
  try { await api('/unsubscribe', { token: token() }); } catch { /* offline: server forgets it when the push fails */ }
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  await sub?.unsubscribe();
}

export const testPush = () => api('/test', { token: token() });

/** Send the current reminders if they changed (or once a day, to extend the schedule). */
export async function syncReminders(force = false) {
  if (!pushConfigured() || !pushSupported() || !pushOn()) return;
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (!sub) return;
  const reminders = buildReminders(getState());
  const h = hash(today() + sub.endpoint + JSON.stringify(reminders));
  if (!force && h === ls.get(K.hash)) return;
  await api('/sync', { token: token(), subscription: sub.toJSON(), reminders });
  ls.set(K.hash, h);
}

let timer;
/** Debounced sync after data changes. */
export function scheduleSync() {
  if (!pushConfigured() || !pushOn()) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncReminders().catch((e) => console.warn('Reminder sync failed', e)), 1500);
}

// Mimi reminders — a tiny Cloudflare Worker that sends Web Push reminders to the Mimi PWA.
//
// Setup (Cloudflare dashboard, free plan): see push-worker/README.md
//   • KV namespace bound as  MIMI
//   • Cron trigger           */5 * * * *
//
// How it works
//   The app computes its upcoming reminders (to-dos, kutu) and POSTs them to /sync together with
//   its push subscription and a random device token. Every 5 minutes the cron job moves reminders
//   that are due into that device's outbox and sends an empty ("tickle") push. The service worker
//   then POSTs its token to /pending, receives the outbox and shows the notifications. Because the
//   push itself carries no data, no payload encryption is needed — only a VAPID signature, whose
//   key pair the worker creates on first use and keeps in KV (no secrets to configure).

const ALLOWED_ORIGINS = ['https://amirulfarhan94.github.io'];
const VAPID_SUBJECT = 'https://amirulfarhan94.github.io/Mimi/';
const MAX_DEVICES = 10;
const MAX_REMINDERS = 400;
const LATE_GRACE_MS = 6 * 3600e3;      // still deliver a reminder up to 6 h late (e.g. phone was off)

// ---------- helpers ----------
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = new TextEncoder();
const clip = (s, n) => String(s ?? '').slice(0, n);

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const extra = (env.EXTRA_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = ALLOWED_ORIGINS.includes(origin) || extra.includes(origin);
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : null;
}
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

async function vapidKeys(env) {
  let keys = await env.MIMI.get('vapid', 'json');
  if (!keys) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    keys = { privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey), publicKey: b64url(await crypto.subtle.exportKey('raw', pair.publicKey)) };
    await env.MIMI.put('vapid', JSON.stringify(keys));
  }
  return keys;
}

async function vapidAuth(endpoint, env) {
  const keys = await vapidKeys(env);
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${keys.publicKey}`;
}

/** Empty push: tells the service worker to fetch /pending. Returns the push service's status. */
async function tickle(sub, env) {
  const res = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: await vapidAuth(sub.endpoint, env), TTL: '21600', Urgency: 'high', 'Content-Length': '0' } });
  return res.status;
}

const devKey = (token) => `dev:${token}`;
const validToken = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(t);
function validEndpoint(u, env) {
  try { const x = new URL(u); return x.protocol === 'https:' || (env.ALLOW_HTTP_ENDPOINTS === '1' && x.protocol === 'http:'); } catch { return false; }
}
function cleanReminders(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_REMINDERS)
    .filter((r) => r && typeof r.id === 'string' && Number.isFinite(r.at))
    .map((r) => ({ id: clip(r.id, 120), at: Math.round(r.at), title: clip(r.title, 80), body: clip(r.body, 240), url: clip(r.url, 120), tag: clip(r.tag || r.id, 120) }));
}

// ---------- HTTP API ----------
async function handle(req, env) {
  const h = cors(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: h ? 204 : 403, headers: h || {} });
  const path = new URL(req.url).pathname;
  if (req.method === 'GET' && path === '/') return new Response('Mimi reminders are running 💕');
  if (!h) return json({ error: 'origin not allowed' }, 403);

  if (req.method === 'GET' && path === '/vapid-public-key') return json({ key: (await vapidKeys(env)).publicKey }, 200, h);
  if (req.method !== 'POST') return json({ error: 'not found' }, 404, h);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
  if (!validToken(body.token)) return json({ error: 'bad token' }, 400, h);
  const key = devKey(body.token);
  const dev = await env.MIMI.get(key, 'json');

  if (path === '/sync') {
    const sub = body.subscription;
    if (!sub || !validEndpoint(sub.endpoint, env)) return json({ error: 'bad subscription' }, 400, h);
    if (!dev) {
      const { keys } = await env.MIMI.list({ prefix: 'dev:' });
      if (keys.length >= MAX_DEVICES) return json({ error: 'too many devices' }, 429, h);
    }
    const reminders = cleanReminders(body.reminders);
    const ids = new Set(reminders.map((r) => r.id));
    const next = {
      subscription: { endpoint: sub.endpoint },
      reminders,
      sent: (dev?.sent || []).filter((id) => ids.has(id)),   // forget ids that no longer exist
      outbox: dev?.outbox || [],
      updated: Date.now(),
    };
    await env.MIMI.put(key, JSON.stringify(next));
    return json({ ok: true, reminders: reminders.length }, 200, h);
  }

  if (!dev) return json({ error: 'unknown device' }, 404, h);

  if (path === '/pending') {
    const outbox = dev.outbox || [];
    if (outbox.length) { dev.outbox = []; await env.MIMI.put(key, JSON.stringify(dev)); }
    return json({ notifications: outbox }, 200, h);
  }
  if (path === '/test') {
    dev.outbox = [...(dev.outbox || []), { id: `test-${Date.now()}`, title: 'Mimi reminders are on 💕', body: 'You’ll get your to-dos and kutu reminders here.', url: './#/', tag: 'mimi-test' }];
    await env.MIMI.put(key, JSON.stringify(dev));
    const status = await tickle(dev.subscription, env);
    return json({ ok: status >= 200 && status < 300, status }, 200, h);
  }
  if (path === '/unsubscribe') {
    await env.MIMI.delete(key);
    return json({ ok: true }, 200, h);
  }
  return json({ error: 'not found' }, 404, h);
}

// ---------- cron: deliver what is due ----------
async function deliver(env, now = Date.now()) {
  const { keys } = await env.MIMI.list({ prefix: 'dev:' });
  const report = [];
  for (const { name } of keys) {
    const dev = await env.MIMI.get(name, 'json');
    if (!dev) continue;
    const sent = new Set(dev.sent || []);
    const due = (dev.reminders || []).filter((r) => r.at <= now && r.at > now - LATE_GRACE_MS && !sent.has(r.id));
    if (!due.length) continue;
    dev.outbox = [...(dev.outbox || []), ...due.map(({ id, title, body, url, tag }) => ({ id, title, body, url, tag }))].slice(-30);
    dev.sent = [...sent, ...due.map((r) => r.id)];
    await env.MIMI.put(name, JSON.stringify(dev));
    const status = await tickle(dev.subscription, env);
    if (status === 404 || status === 410) await env.MIMI.delete(name);   // subscription is gone
    report.push({ device: name.slice(4, 10), due: due.length, status });
  }
  return report;
}

export default {
  fetch: (req, env) => handle(req, env).catch((e) => json({ error: String(e && e.message || e) }, 500)),
  scheduled: (event, env, ctx) => ctx.waitUntil(deliver(env)),
  // exported for tests
  _deliver: deliver,
};

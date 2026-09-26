# Mimi reminders server (Cloudflare Worker, free plan)

Sends push notifications to the Mimi PWA: at **8:00 am** today's to-dos, kutu payments and
your kutu turn, plus to-dos that have a time (at that time). The app sends only reminder
titles and times; diary and money data stay on the phone.

## One-time setup (Cloudflare dashboard, ~5 minutes)

1. Sign up / log in at <https://dash.cloudflare.com> (free).
2. **Workers & Pages → Create → Create Worker** ("Hello World"), name it `mimi-push`, **Deploy**.
3. **Edit code** → replace everything with [`worker.js`](worker.js) → **Deploy**.
4. **Storage & Databases → KV → Create** a namespace called `mimi-push`.
5. Open the worker → **Settings → Bindings → Add → KV namespace**:
   variable name **`MIMI`**, namespace **`mimi-push`** → Save.
6. Worker → **Settings → Trigger events → Add → Cron trigger**: **`*/5 * * * *`** → Save.
7. Open the worker's URL (`https://mimi-push.<your-subdomain>.workers.dev`). It should say
   *"Mimi reminders are running 💕"*. Put that URL in `push-config.js` (`workerUrl`).

No secrets are needed: the worker creates its VAPID key pair on first use and keeps it in KV.

## Using it

In the app: **Settings → 🔔 Reminders → Turn on reminders** (allow notifications), then
**Send a test**. On Android, open Mimi from the installed app (Chrome).

## CLI alternative

`npx wrangler kv namespace create mimi-push`, put the id in `wrangler.toml`, then `npx wrangler deploy`.

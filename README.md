# Mimi 💕

A sweet little PWA made for Sayang — daily diary, expense tracker and duit kutu groups in one app.

Every time the app opens, the dashboard greets her with:

> **Hi Sayang ❤️**
> What would you like to do today?
> — *Always here for you.*

## Features

- **💌 Mimi Love Letter** — a daily note from Amirul on the dashboard. Tap the card for a popup with today's letter, **Another Note** for a bonus one, and special letters on **2 April** (Mimi's birthday 🎂), **10 October** (Amirul's birthday 🎂) and **30 November** (anniversary 💍).
- **📔 Diary** — daily entries with a mood, search, and a writing streak.
- **✅ To-do** — quick add, Today / Upcoming / All views, custom lists with emoji (🏠 Home, 🛒 Shopping, 💼 Work, 💕 Personal…), due date & time, ★ important, and **repeating tasks** (daily, weekly, monthly or every X days — ticking one creates the next).
- **💸 Expenses** — expenses & income by category, month navigation, category breakdown and monthly balance.
- **🤝 Duit kutu** — manage many groups at once: **weekly**, **every 10 days**, **monthly**, or any custom interval.
  - Set the turn order (or 🎲 shuffle), tick **Me** on your slot(s) — more than one is fine.
  - Automatic round schedule with dates & recipients, per-member payment ticks, overdue rounds flagged ⚠️.
  - Ticking your own payment adds a Kutu expense; receiving your pot adds Kutu income.
- **🏠 Dashboard** — today's to-dos (tick them right there), spent today / this month, balance, 7-day chart, upcoming kutu, your next payout, today's diary.

## PWA

- Installable (Android/Chrome: *Install app*; iPhone/Safari: *Share → Add to Home Screen*).
- Works **offline** — the app shell, icons and fonts are all cached by the service worker.
- Soft pink theme with automatic dark mode, mobile-first, app shortcuts.

## Love letters

The 365 daily letters and the special-date messages are bundled with the app (they work offline and never leave the device):

- `js/data/loveLetters.js` — 365 letters, day 1 = 1 January … day 365 = 31 December. Edit any `text` directly.
- `js/data/specialLetters.js` — birthdays & anniversary. Each occasion has a `messages` list; add more messages and the app rotates one per year (the others appear under *Another Note*). `signature: null` hides the "— Amirul" sign-off.
- `scripts/import-love-letters.py <workbook.xlsx>` — regenerate both files from the review workbook (`pip install openpyxl`).

How a date picks its letter (`js/loveLetter.js`): special dates first; otherwise the day of the year on a non-leap calendar (so 1 March is always #60 and 31 December #365). 29 February gets a stable "bonus" letter chosen from the year. After editing letters, bump `VERSION` in `sw.js`.

## Data

All data stays **on the device** (localStorage) — no server, no account.
Use **Settings → Export JSON** for regular backups and **Import JSON** to restore or move to a new phone.

## Run locally

No build step — plain static files (HTML, CSS, ES modules).

```bash
npx serve .          # or: python3 -m http.server 8080
```

Service workers need `localhost` or HTTPS.

### Deploy

Upload this folder to any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages).
All paths are relative, so it also works from a sub-folder (e.g. `username.github.io/Mimi/`).

> Whenever you change app files, bump `VERSION` in `sw.js` so installed copies pick up the update
> (the app shows *"A new version is available — Reload"*).

## Structure

```
index.html              app shell
manifest.webmanifest    PWA manifest
sw.js                   service worker (offline cache)
css/style.css           styles (light & dark)
fonts/                  Quicksand + Dancing Script (SIL OFL)
js/app.js               hash router, navigation, FAB, SW updates
js/store.js             localStorage store + backup
js/kutu.js              kutu logic: round schedule, status, payments
js/todo.js              to-do logic: sorting, repeating tasks, lists
js/loveLetter.js        love letter logic: date → letter, special dates, Another Note
js/data/                bundled love letters (daily + special dates)
scripts/                import-love-letters.py (workbook → js/data)
js/views/*.js           Dashboard, Diary, To-do, Expenses, Kutu, Settings, Love Letter card & popup
icons/                  app icons generated from the Mimi logo (any + maskable + Apple)
```

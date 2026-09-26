# Mimi — Diari, Belanja & Duit Kutu

Web app mudah alih (PWA) untuk:

- **📔 Diari harian** — tulis catatan dengan mood, cari, dan kira hari berturut-turut.
- **💸 Rekod belanja & pendapatan** — ikut kategori, navigasi bulan, pecahan kategori dan baki bulanan.
- **🤝 Duit kutu** — urus banyak kumpulan sekaligus: **mingguan (7 hari)**, **setiap 10 hari**, **bulanan**, atau tempoh sendiri.
  - Susun giliran ahli (atau 🎲 cabut undi), tanda slot **Saya** (boleh lebih dari satu kepala).
  - Jadual pusingan automatik dengan tarikh & penerima, tanda siapa dah bayar, tunggakan ditanda ⚠️.
  - Bayaran **Saya** automatik direkod sebagai belanja (kategori Kutu); duit giliran anda direkod sebagai pendapatan.
- **🏠 Dashboard** — belanja hari ini/bulan ini, baki, carta 7 hari, kutu akan datang, giliran anda dapat, diari hari ini.

## Mesra PWA

- Boleh dipasang ke skrin utama (Android/Chrome: *Pasang app*; iPhone/Safari: *Kongsi → Tambah ke Skrin Utama*).
- Berfungsi **luar talian** (service worker cache app shell).
- Mod gelap automatik, reka bentuk mudah alih dahulu, pintasan app (Rekod belanja / Tulis diari / Duit kutu).

## Data

Semua data disimpan **dalam peranti** (localStorage) — tiada pelayan, tiada akaun.
Gunakan **Tetapan → Eksport JSON** untuk sandaran berkala dan **Import JSON** untuk pulihkan / pindah peranti.

## Jalankan

Tiada build step — fail statik sahaja (HTML, CSS, ES modules).

```bash
npx serve .          # atau: python3 -m http.server 8080
```

Buka `http://localhost:3000`. Service worker memerlukan `localhost` atau HTTPS.

### Deploy

Muat naik folder ini ke mana-mana hosting statik (GitHub Pages, Netlify, Vercel, Cloudflare Pages).
Semua laluan adalah relatif, jadi ia juga berfungsi di bawah sub-folder (cth. `username.github.io/Mimi/`).

> Setiap kali mengubah fail app, naikkan `VERSION` dalam `sw.js` supaya pengguna menerima versi baru
> (app akan papar *"Versi baru tersedia — Muat semula"*).

## Struktur

```
index.html              shell app
manifest.webmanifest    manifest PWA
sw.js                   service worker (cache luar talian)
css/style.css           gaya (terang & gelap)
js/app.js               penghala hash, navigasi, FAB, kemas kini SW
js/store.js             simpanan localStorage + sandaran
js/kutu.js              logik kutu: jadual pusingan, status, bayaran
js/views/*.js           Dashboard, Diari, Belanja, Kutu, Tetapan
icons/                  ikon app (SVG + PNG + maskable)
```

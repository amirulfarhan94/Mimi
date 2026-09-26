// Tetapan: nama, pasang app, sandaran & pulih data.
import { getState, update, exportJSON, importJSON, resetAll } from '../store.js';
import { esc, today } from '../util.js';
import { confirmSheet, toast, icon } from '../ui.js';
import { canInstall, promptInstall, isStandalone } from '../pwa.js';

export default {
  title: 'Tetapan',
  render() {
    const s = getState();
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return `
      <a class="back" href="#/">${icon('left')} Dashboard</a>
      <section class="card">
        <h3 class="card-title">Profil</h3>
        <label class="field"><span>Nama panggilan</span>
          <input id="nameInput" value="${esc(s.settings.name)}" placeholder="cth: Mimi" maxlength="40">
        </label>
      </section>

      <section class="card">
        <h3 class="card-title">Pasang sebagai app</h3>
        ${isStandalone() ? '<p class="muted small">✅ Mimi sedang berjalan sebagai app.</p>'
          : canInstall() ? `<button class="btn primary" data-install>${icon('download')} Pasang Mimi</button>`
          : ios ? '<p class="muted small">Di Safari, tekan butang <b>Kongsi</b> kemudian <b>Tambah ke Skrin Utama</b>.</p>'
          : '<p class="muted small">Buka menu pelayar dan pilih <b>Pasang app</b> / <b>Tambah ke skrin utama</b>.</p>'}
        <p class="muted small">Mimi berfungsi luar talian. Semua data disimpan dalam peranti ini sahaja.</p>
      </section>

      <section class="card">
        <h3 class="card-title">Sandaran data</h3>
        <p class="muted small">${s.notes.length} diari · ${s.txns.length} rekod belanja · ${s.kutu.length} kumpulan kutu</p>
        <div class="row gap wrap">
          <button class="btn" data-export>${icon('download')} Eksport JSON</button>
          <label class="btn">${icon('upload')} Import JSON<input type="file" accept="application/json,.json" hidden data-import></label>
        </div>
        <p class="hint">Buat sandaran secara berkala — data hilang jika cache pelayar dipadam.</p>
      </section>

      <section class="card">
        <h3 class="card-title">Zon bahaya</h3>
        <button class="btn danger" data-reset>${icon('trash')} Padam semua data</button>
      </section>`;
  },
  mount(root, rerender) {
    const name = root.querySelector('#nameInput');
    name.addEventListener('change', () => {
      update((s) => { s.settings.name = name.value.trim(); });
      toast('Nama disimpan');
    });
    root.querySelector('[data-install]')?.addEventListener('click', async () => {
      await promptInstall();
      rerender();
    });
    root.querySelector('[data-export]').addEventListener('click', () => {
      const blob = new Blob([exportJSON()], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), download: `mimi-sandaran-${today()}.json`,
      });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    root.querySelector('[data-import]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!(await confirmSheet('Import akan menggantikan semua data sedia ada. Teruskan?', { ok: 'Import', danger: false }))) return;
      try {
        importJSON(await file.text());
        toast('Data berjaya diimport');
      } catch (err) {
        toast(`Gagal import: ${err.message}`);
      }
    });
    root.querySelector('[data-reset]').addEventListener('click', async () => {
      if (await confirmSheet('Semua diari, rekod belanja dan kumpulan kutu akan dipadam kekal. Pastikan anda sudah eksport sandaran.', { ok: 'Padam semua' })) {
        resetAll();
        toast('Semua data dipadam');
      }
    });
  },
};

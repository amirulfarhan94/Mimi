// Settings: install app, backup & restore data.
import { getState, exportJSON, importJSON, resetAll } from '../store.js';
import { today } from '../util.js';
import { confirmSheet, toast, icon } from '../ui.js';
import { canInstall, promptInstall, isStandalone } from '../pwa.js';

export default {
  title: 'Settings',
  render() {
    const s = getState();
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return `
      <a class="back" href="#/">${icon('left')} Dashboard</a>

      <section class="card">
        <h3 class="card-title">Install as an app</h3>
        ${isStandalone() ? '<p class="muted small">✅ Mimi is running as an installed app.</p>'
          : canInstall() ? `<button class="btn primary" data-install>${icon('download')} Install Mimi</button>`
          : ios ? '<p class="muted small">In Safari, tap <b>Share</b> then <b>Add to Home Screen</b>.</p>'
          : '<p class="muted small">Open the browser menu and choose <b>Install app</b> / <b>Add to Home screen</b>.</p>'}
        <p class="muted small">Mimi works offline. All data is stored on this device only.</p>
      </section>

      <section class="card">
        <h3 class="card-title">Backup</h3>
        <p class="muted small">${s.notes.length} diary entries · ${s.txns.length} money records · ${s.kutu.length} kutu groups</p>
        <div class="row gap wrap">
          <button class="btn" data-export>${icon('download')} Export JSON</button>
          <label class="btn">${icon('upload')} Import JSON<input type="file" accept="application/json,.json" hidden data-import></label>
        </div>
        <p class="hint">Back up regularly — data is lost if the browser's site data is cleared.</p>
      </section>

      <section class="card">
        <h3 class="card-title">Danger zone</h3>
        <button class="btn danger" data-reset>${icon('trash')} Delete all data</button>
      </section>

      <p class="made-with">Made with ❤️ for Sayang</p>`;
  },
  mount(root, rerender) {
    root.querySelector('[data-install]')?.addEventListener('click', async () => {
      await promptInstall();
      rerender();
    });
    root.querySelector('[data-export]').addEventListener('click', () => {
      const blob = new Blob([exportJSON()], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), download: `mimi-backup-${today()}.json`,
      });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    root.querySelector('[data-import]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!(await confirmSheet('Importing replaces all existing data. Continue?', { ok: 'Import', danger: false }))) return;
      try {
        importJSON(await file.text());
        toast('Data imported');
      } catch (err) {
        toast(`Import failed: ${err.message}`);
      }
    });
    root.querySelector('[data-reset]').addEventListener('click', async () => {
      if (await confirmSheet('All diary entries, money records and kutu groups will be permanently deleted. Make sure you have exported a backup.', { ok: 'Delete everything' })) {
        resetAll();
        toast('All data deleted');
      }
    });
  },
};

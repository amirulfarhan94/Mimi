// Small UI pieces: modal (bottom sheet), toast, confirmation, icons.
import { $ } from './util.js';

const dialog = () => $('#sheet');

/**
 * Open a sheet with a title & body HTML. `onMount(root, close)` runs after render.
 * Returns a function that closes it.
 */
export function openSheet({ title, body, onMount }) {
  const d = dialog();
  d.innerHTML = `
    <div class="sheet-head">
      <h2 id="sheetTitle">${title}</h2>
      <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet-body">${body}</div>`;
  const close = () => d.open && d.close();
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  d.onclick = (e) => { if (e.target === d) close(); };
  d.showModal();
  onMount?.(d, close);
  const first = d.querySelector('input:not([type=hidden]):not([type=checkbox]), textarea, select');
  if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
  return close;
}

export function confirmSheet(message, { ok = 'Delete', danger = true } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet({
      title: 'Are you sure?',
      body: `<p class="muted">${message}</p>
        <div class="row gap end mt">
          <button class="btn ghost" data-close>Cancel</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${ok}</button>
        </div>`,
      onMount(root, close) {
        root.querySelector('[data-ok]').addEventListener('click', () => {
          answered = true; resolve(true); close();
        });
        // Closing the previous sheet (e.g. an edit form) queues a 'close' event that arrives after this
        // sheet has opened — ignore it while the dialog is still open.
        const onClose = () => {
          if (root.open) return;
          root.removeEventListener('close', onClose);
          if (!answered) resolve(false);
        };
        root.addEventListener('close', onClose);
      },
    });
  });
}

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/** Read form values as an object. */
export const formData = (form) => Object.fromEntries(new FormData(form).entries());

const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M8 7h7"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M16 15h2"/><path d="M6 6l9-3 2 3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 5.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  gift: '<rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3 8 4s0 4 4 4zm0 0s1.5-5 4-4 0 4-4 4z"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  checklist: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 9l1.5 1.5L12 8M8 15l1.5 1.5L12 14M14.5 9.5H17M14.5 15.5H17"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;

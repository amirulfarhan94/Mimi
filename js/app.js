// Shell aplikasi: penghala hash, navigasi bawah, FAB & kemas kini PWA.
import { subscribe } from './store.js';
import { $, $$ } from './util.js';
import { icon } from './ui.js';
import { registerSW, onInstallChange } from './pwa.js';
import dashboard from './views/dashboard.js';
import diary from './views/diary.js';
import expenses from './views/expenses.js';
import kutu from './views/kutu.js';
import settings from './views/settings.js';

const routes = [
  { re: /^\/?$/, view: dashboard, tab: 'home' },
  { re: /^\/diari$/, view: diary, tab: 'diari' },
  { re: /^\/belanja$/, view: expenses, tab: 'belanja' },
  { re: /^\/kutu$/, view: kutu, tab: 'kutu' },
  { re: /^\/kutu\/([\w-]+)$/, view: kutu, tab: 'kutu', params: (m) => ({ id: m[1] }) },
  { re: /^\/tetapan$/, view: settings, tab: null },
];

let current = null;

function resolve() {
  const path = location.hash.replace(/^#/, '') || '/';
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) return { ...r, params: r.params ? r.params(m) : {}, path };
  }
  return { ...routes[0], params: {}, path: '/' };
}

function render({ keepScroll = false } = {}) {
  const route = resolve();
  const main = $('#main');
  const y = window.scrollY;
  main.innerHTML = route.view.render(route.params);
  route.view.mount?.(main, () => render({ keepScroll: true }), route.params);

  $('#pageTitle').textContent = route.view === dashboard ? 'Mimi' : route.view.title;
  document.title = route.view === dashboard ? 'Mimi — Diari, Belanja & Kutu' : `${route.view.title} · Mimi`;
  $$('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === route.tab));
  $$('.tabbar a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.tab === route.tab));

  const fab = $('#fab');
  const fabAction = route.params.id ? null : route.view.fab;
  fab.hidden = !fabAction;
  fab.onclick = fabAction || null;

  if (keepScroll) window.scrollTo(0, y);
  else if (current !== route.path) window.scrollTo(0, 0);
  current = route.path;
}

// Isi ikon navigasi
$$('[data-icon]').forEach((el) => { el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)); });

window.addEventListener('hashchange', () => render());
subscribe(() => render({ keepScroll: true }));
onInstallChange(() => { if (resolve().view === settings) render({ keepScroll: true }); });

// Kemas kini tarikh apabila app dibuka semula pada hari lain
let lastDay = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && new Date().toDateString() !== lastDay) {
    lastDay = new Date().toDateString();
    render({ keepScroll: true });
  }
});

// Muat semula hanya selepas pengguna setuju kemas kini (bukan semasa pemasangan pertama).
let updateRequested = false;
registerSW((reg) => {
  const bar = $('#updateBar');
  bar.hidden = false;
  bar.querySelector('button').onclick = () => {
    updateRequested = true;
    reg.waiting?.postMessage('SKIP_WAITING');
  };
});
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (!updateRequested) return;
  updateRequested = false;
  location.reload();
});

render();

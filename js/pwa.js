// Service worker registration & "Install app" support.
let deferred = null;
const listeners = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  listeners.forEach((fn) => fn());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  listeners.forEach((fn) => fn());
});

export const canInstall = () => !!deferred;
export const onInstallChange = (fn) => listeners.add(fn);
export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  listeners.forEach((fn) => fn());
  return outcome === 'accepted';
}

export function registerSW(onUpdate) {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) onUpdate?.(reg);
        });
      });
    } catch (e) {
      console.warn('Service worker registration failed', e);
    }
  });
}

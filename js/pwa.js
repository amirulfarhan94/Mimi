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

/**
 * Register the service worker and keep the app up to date.
 * `onUpdate()` runs when a newer version has taken over while this page shows the old one.
 */
export function registerSW(onUpdate) {
  if (!('serviceWorker' in navigator)) return;
  // The first install is not an update; any later change of worker is.
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) onUpdate?.();
    controlled = true;
  });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      // A version downloaded by an older build may still be waiting: let it take over now.
      reg.waiting?.postMessage('SKIP_WAITING');
      // Installed apps are usually resumed from the background rather than reloaded,
      // so also look for a new version whenever the app comes back to the screen.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (e) {
      console.warn('Service worker registration failed', e);
    }
  });
}

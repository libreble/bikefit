/**
 * Registers the service worker (see `public/sw.js`) that makes Bikefit installable and offline-
 * capable. Production only — in dev a worker would fight Vite's HMR and serve stale modules.
 *
 * The script URL is built from Vite's `BASE_URL` so it resolves to the deploy root at any subpath
 * (`./sw.js` → `/bikefit/sw.js` on GitHub Pages); the worker's scope then defaults to that same
 * directory. Registration is deferred to `load` so it never competes with first paint. Failures are
 * swallowed: the app is fully functional without the worker (it just won't be offline-installable).
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // No offline support this session — not fatal, so stay quiet.
    })
  })
}

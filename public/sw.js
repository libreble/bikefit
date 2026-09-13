/*
 * Bikefit service worker — makes the app installable and usable offline.
 *
 * Strategy (kept deliberately tiny, matching the app's hand-rolled, no-plugin ethos):
 *   • Navigations  → network-first, falling back to the cached app shell when offline. Keeps the
 *                    HTML fresh online (so new asset hashes are picked up) yet always loads offline.
 *   • Other GETs   → cache-first. Vite fingerprints asset filenames, so a cached hit is always the
 *                    exact byte-for-byte file that was requested — safe to serve forever.
 *
 * Updates: we do NOT call skipWaiting(). A new worker installs and waits; it takes over the next
 * time every app tab has been closed and reopened. That sidesteps the classic stale-tab hazard
 * (an old page requesting an old chunk that a mid-session cache purge just deleted) at the cost of
 * updates landing on the next fresh open — the right trade for short, on-the-bike sessions.
 *
 * All paths are relative to this script's location, so the worker works unchanged at any deploy
 * subpath (e.g. GitHub Pages' /bikefit/) — same reasoning as Vite's `base: './'`.
 */

const CACHE = 'bikefit-shell-v1'

// The app shell (index.html), resolved against this worker's own URL → the deploy root.
const SHELL = new URL('./', self.location).toString()

// Best-effort precache so the very first offline load (after one online visit) has the shell and
// icons ready. Hashed JS/CSS chunks are left to runtime caching on first paint.
const PRECACHE = [SHELL, './manifest.webmanifest', './icon.svg', './favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // allSettled, not addAll: one missing asset must not abort the whole install.
      Promise.allSettled(PRECACHE.map((url) => cache.add(url))),
    ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k.startsWith('bikefit-') && k !== CACHE).map((k) => caches.delete(k)),
      )
      await self.clients.claim() // control this page now so offline works without a manual reload
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // never touch cross-origin requests

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE)
        try {
          const fresh = await fetch(request)
          cache.put(SHELL, fresh.clone()) // keep the offline shell current
          return fresh
        } catch {
          return (await cache.match(SHELL)) || (await cache.match(request)) || Response.error()
        }
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const hit = await cache.match(request)
      if (hit) return hit
      const fresh = await fetch(request)
      if (fresh.ok && fresh.type === 'basic') cache.put(request, fresh.clone())
      return fresh
    })(),
  )
})

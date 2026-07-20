/**
 * URL feature flags. The demo affordances — the "Demo" fake-ride button (ConnectionBar) and the
 * "Add demo session" seeder (HistoryPage) — are testing-only, so they're hidden by default and
 * appear only when the page is opened with `?demo=1`.
 *
 * The flag is a real query param placed *before* the hash (`…/?demo=1#/sessions`), i.e.
 * `window.location.search`. With HashRouter only the hash changes on navigation, so the search
 * string is stable for the page's lifetime — read it once at startup and every route keeps demo on.
 */

/** True when the page was loaded with `?demo=1`. Fixed for the page's lifetime. */
export const demoEnabled: boolean = (() => {
  try {
    return new URLSearchParams(window.location.search).get('demo') === '1'
  } catch {
    return false
  }
})()

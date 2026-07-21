/**
 * URL feature flags — opt-in switches read once at startup. Each is a real query param placed
 * *before* the hash (`…/?demo=1#/sessions`), i.e. `window.location.search`. With HashRouter only the
 * hash changes on navigation, so the search string is stable for the page's lifetime — read it once
 * and every route keeps the flag on.
 *
 * - `demo` — the testing-only affordances: the "Demo" fake-ride button (ConnectionBar) and the
 *   "Add demo session" seeder (HistoryPage).
 * - `cbc` — Coach-By-Color live zones on the power tile. Gated off by default until the bike's zone
 *   indexing (0- vs 1-based) is confirmed against a real CBC-on ride; the demo uses 1..5, so it
 *   renders under `?cbc=1` today. See `src/cbc/zones.ts`.
 */

/** Read a `?<name>=1` query flag, false on any parse failure. Fixed for the page's lifetime. */
function urlFlag(name: string): boolean {
  try {
    return new URLSearchParams(window.location.search).get(name) === '1'
  } catch {
    return false
  }
}

/** True when the page was loaded with `?demo=1`. */
export const demoEnabled: boolean = urlFlag('demo')

/** True when the page was loaded with `?cbc=1` — gates the power-tile Coach-By-Color zones. */
export const cbcEnabled: boolean = urlFlag('cbc')

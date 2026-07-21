# Decision log

Newest first. Each entry: **what**, **why**, and **how to reverse** if we change our mind.

---

## 2026-07-21 — Heart-rate zones (5-band %HRmax) + age-estimated max HR

**What.** Added HR training zones, surfaced two ways: the live HR tile recolours to the current zone
and shows a `Zx` badge; the post-ride summary (the History detail view) gets a stacked time-in-zone
bar with per-zone %, minutes, and the HRmax used. New `src/hr/zones.ts` holds the pure model
(`estimateMaxHr`, `hrZoneIndex`, `hrZoneCounts`, `HR_ZONES`) and `src/ui/HrZoneBar.tsx` the bar. The
profile form now auto-fills Max HR from age as `220 − age` (a hint says so); typing your own locks
the field, and an already-saved value is never overwritten.

**Why `220 − age`.** The rider asked for it explicitly — it's the formula on every gym HR chart. The
estimate is persisted into `profile.maxHr` (not derived at read-time), so everything downstream —
zones *and* the value sent to the bike — just reads one concrete field. Kept entirely in the profile
form; no max-HR abstraction threaded elsewhere.

**Why 5-band %HRmax** (`<60 / 60–70 / 70–80 / 80–90 / ≥90`). It's the only zone model our profile
data supports: %HRR (Karvonen) needs a resting HR we don't collect, %LTHR needs a threshold test.
Z1 is open-ended below so every sample buckets with no "below zone" edge case. These are HR zones,
distinct from the bike's Coach-By-Color *power* zones (off FTP).

**Trade-off / caveat.** The post-ride breakdown uses the rider's *current* profile max HR — we don't
snapshot HRmax per session, so editing it re-buckets old rides. Fine for a personal tool; revisit if
per-session HRmax ever matters. All zone UI hides when no max HR (or age) is set.

**How to reverse.** Delete `src/hr/` + `HrZoneBar` and the `maxHr` props threaded through
App→LivePage→LiveTiles and SessionPage→SessionSummaryView; drop the profile form's age→maxHr effect.
Adding resting HR later would unlock a Karvonen option without changing the call sites.

---

## 2026-07-21 — Installable PWA: hand-rolled manifest + service worker (no plugin)

**What.** The app is now an installable, offline-capable PWA. Added `public/manifest.webmanifest`
(name, `standalone` display, theme/background `#0b0f14`, PNG icons at 192/512 + a maskable 512 + an
SVG), PNG/SVG icons generated from the bike glyph (`public/icon.svg`, `public/maskable.svg`, and
their rasterizations + `apple-touch-icon.png`), and a small service worker (`public/sw.js`)
registered in production only from `src/pwa/register.ts`. `index.html` gained the manifest link,
apple-touch-icon, and iOS meta tags. Verified in-browser: SW registers + activates + controls the
page, the manifest and all four icons load, and after one reload the JS/CSS chunks are cached so the
app runs fully offline.

**Why hand-rolled (no `vite-plugin-pwa`/Workbox).** Same ethos as the own-framer / own-sparklines /
own-i18n choices: the caching need here is tiny, so a ~70-line worker beats a plugin + Workbox
runtime. The SW does two things — **network-first** for navigations (HTML stays fresh online, falls
back to the cached shell offline) and **cache-first** for everything else (Vite content-hashes asset
filenames, so a cached hit is always the exact file). All paths are relative to the worker's own URL,
so it works unchanged at the `/bikefit/` GitHub Pages subpath — same reasoning as Vite's `base: './'`
and the manifest's relative `start_url`/`scope`/icon `src`.

**Why no `skipWaiting()`.** A new worker installs and waits, taking over only once every app tab is
closed and reopened. That deliberately avoids the stale-tab hazard (a live old page requesting an old
chunk that a mid-session cache purge just deleted) at the cost of updates landing on the next fresh
open — the right trade for short on-the-bike sessions. `clients.claim()` on activate still lets the
*first* visit go offline without a manual reload.

**Icons** were rasterized from SVG with ImageMagick (`convert`) at build-authoring time and committed
as static PNGs — no `sharp`/build-step dependency. The maskable variant pre-scales the glyph into the
center safe zone so a launcher's circle/squircle mask never clips it.

**How to reverse.** Delete `public/sw.js` + the `registerServiceWorker()` call to drop offline/SW
(the manifest alone still gives an installable app on most browsers); delete the manifest link to
stop it being installable. To adopt a plugin later, keep the registration call site and swap the
worker.

---

## 2026-07-21 — Demo affordances gated behind `?demo=1`

**What.** The two testing-only controls — the "Demo" fake-ride button (ConnectionBar) and "Add demo
session" seeder (HistoryPage) — are hidden by default and shown only when the page is opened with
`?demo=1`. One flag in `src/app/flags.ts` (`demoEnabled`), read once at startup and consumed as a
plain boolean in both components.

**Why the query is *before* the hash** (`…/?demo=1#/sessions`, i.e. `location.search`). With
HashRouter only the hash changes on in-app navigation, so a real query param on the document URL is
stable for the page's lifetime — set demo once and every route keeps it on, with no router wiring.
Putting it *inside* the hash (`#/sessions?demo=1`) would tie it to one route and drop on navigation.

**Why gate them at all.** Real riders never need to fake a ride or seed fake history; those are dev
affordances. Hiding them declutters the default UI while keeping them one URL param away for testing
off the bike. Already-seeded demo sessions still show in history (they're real stored rows) — the
flag hides the *controls*, not past data.

**How to reverse.** Drop the `demoEnabled &&` guards in ConnectionBar/HistoryPage (and delete
`flags.ts`) to always show them; or flip the default by inverting the flag.

---

## 2026-07-21 — i18n: hand-rolled typed catalog, en + nl

**What.** Made every user-facing string translatable and added English + Dutch. New `src/i18n/`:
`messages.ts` (a flat `en` catalog as the source of truth — its keys derive the `MessageKey` union,
and `nl` is typed `Record<MessageKey, string>` so a missing key is a compile error) and `i18n.ts`
(the runtime). Locale lives in a small Zustand store: components translate with the reactive
`useT()` hook (re-renders on switch), and plain non-React modules — the thrown, user-visible error
messages in `importer`/`detect`/`controller`/`exporter` — call the module-level `t()`, which reads
the locale at throw-time. Metric names moved from literal `label` on `METRICS` to a `labelKey`
i18n key. A header `<select>` (`LanguageSwitcher`) switches live; the choice is auto-detected from
`navigator.languages` on first load, persisted to `localStorage`, and mirrored onto `<html lang>`.
Verified in-browser: auto-detected nl, live-switched to en across every surface (tiles, graphs,
dialogs, history, aria-labels), and the choice survived a route reload.

**Why hand-rolled (no i18next/react-intl).** Same ethos as the rest of the app (own framer, own
sparklines, minimal deps): the catalog is simple strings with `{name}` interpolation, so a ~60-line
translator beats pulling in ~40 KB of library and its plural/ICU machinery. The typed-catalog trick
gives us the one guarantee that actually matters here — no locale can silently drift from `en`.

**Trade-off.** No built-in plural/gender/number-format rules; if a future string needs real
pluralization we add a tiny helper or reconsider a library. Unit *symbols* (W, kg, bpm, km/h, …)
are intentionally left as literals (international), so only words are translated. Two deep BLE-stack
guard errors (`device has no GATT server`, `not connected`) stay untranslated — internal invariants
a rider shouldn't ever see.

**How to reverse / extend.** Add a locale: extend `Locale`/`LOCALES` and add one
`Record<MessageKey, string>` object — TypeScript lists every key you still owe. To drop a library
in later, keep the `t`/`useT` call sites and re-point them at the library's API.

---

## 2026-07-21 — Client routing via HashRouter; session history is a real destination

**What.** Added `react-router-dom` and split the single screen into routes: `/` (live dashboard),
`/sessions` (history list), `/sessions/:id` (a bookmarkable session page). The header gained a
Live/History nav; the old past-sessions side panel + review modal became the History page + the
session detail page. App is now a shell (header + `<Routes>`) with the pages under `src/pages/`.
Uses **HashRouter**, so URLs look like `…/bikefit/#/sessions/:id`.

**Why HashRouter (not BrowserRouter/clean URLs).** The app ships to a **GitHub Pages subpath** with
a deliberately **relative Vite base** (`base: './'`, so `dist/` runs from any path — see the
2026-07-11 stack decision) and **no SPA 404 fallback**. Hash routes are client-only: a deep link
like `/bikefit/#/sessions/abc` loads `index.html` at `/bikefit/` and the router reads the hash, so
**bookmarks and refresh just work** with zero server/deploy config. Verified in-browser: hard-reload
of a session URL renders that session; an unknown id shows a graceful not-found. The BLE session +
Zustand store are module singletons, so navigating between routes never interrupts a live ride
(also verified: HR/speed/elapsed kept climbing across a History↔Live round-trip).

**Trade-off.** Clean URLs (`/bikefit/sessions/abc`) would need `base: '/bikefit/'` + a `404.html`
redirect trick, giving up the "runs from any path" property and adding a redirect flash. Not worth
it for a personal PWA; the `#` is cosmetic.

**How to reverse.** Swap `HashRouter`→`BrowserRouter basename={import.meta.env.BASE_URL}` in
`main.tsx`, set Vite `base: '/bikefit/'`, and add a `public/404.html` SPA-redirect. Routes/pages
stay as-is. To drop routing entirely, re-inline the pages into `App.tsx` and remove the dep.

---

## 2026-07-21 — Storage pivot: store the decoded time series, drop raw-frame capture

**What.** Retired the lossless raw-frame black box. IndexedDB (v2) now holds **`sessions`** (meta +
our summary + the bike's final AGGREGATED totals snapshot) and **`samples`** (the decoded LIVE
time series, ~1 Hz) — the `frames` (raw hex) and `messages` stores are gone, and so is the whole
Debug/Log panel + manual command sender. `AdapterEvents` lost `onRaw`. The bike's AGGREGATED_STREAM
totals (IF/TSS/time-in-zone) are kept as **one latest snapshot** on the session record, not the
~3600 identical copies it streams over an hour. Export is now `SessionFile` **v2** (meta + summary +
aggregated + samples[], no frames/messages).

**Why.** The raw capture existed as a re-parse safety net for *unverified* decoders (PLAN §1 called
it "the single most important decision in round 1"). That premise is spent: the decoder is
oracle-verified byte-exact vs the ICG app **and** field-proven over a real gym ride (PROGRESS
2026-07-12). Keeping raw hex + every decoded message + 3600 repeated totals was pure duplication of
data we can already trust. Storing the decoded series is smaller, is what history/graphs/replay
actually need, and drops a debug surface no rider wants.

**Trade-off.** We lose the ability to *re-parse old logs* if a decode bug surfaces later — an old
session is now only as correct as the decoder was at capture time. Accepted because the decoder is
proven; if we ever touch the byte layouts again, re-enable raw capture first.

**How to reverse.** Re-add the `frames` store + `onRaw` to `AdapterEvents`/recorder/adapters, bump
the DB version, and restore `DebugLog`. Git history (this commit) has the deleted code intact.

---

## 2026-07-12 — FTP/user-data handshake: opt-in local profile, no live recompute

**What.** Added a rider **profile** (FTP, weight, maxHR, age, name, Coach-By-Color toggle) stored
in **localStorage** (`src/profile/profile.ts`), editable + deletable on a settings panel
(`src/ui/ProfilePanel.tsx`). When a profile exists, the ICG adapter answers the bike's
`GET_ALL_USER_DATA` (msg 1) with `SET_ALL_USER_DATA` (msg 2) — the 10-byte payload reversed in
PROTOCOL.md §8a. Encoder (`encodeIcgAllUserData`) verified byte-exact + framer round-trip.

**Why opt-in.** Don't push a feature users didn't ask for; on a shared gym bike, silently
overwriting the console's user is undesirable. A saved profile *is* the explicit opt-in — with none,
the adapter stays silent and the bike keeps its own defaults (no Coach-By-Color, bike-default FTP).

**No live recompute.** We do **not** recompute IF/TSS/zones live. The profile's FTP goes to the
bike, and the bike returns accurate numbers in its own `AGGREGATED_STREAM` (msg 13), which we just
display (as the vendor app does — it never recomputes either). App-side recompute is reserved for
**historical sessions** (correcting FTP after a ride) and needs the stored power series (the
persistence pivot, still pending). No profile = you accept the bike's default-FTP numbers live.

**How to reverse.** Delete `src/profile/`, drop the `GET_ALL_USER_DATA` branch in
`IcgUartAdapter.autoRespond`, remove `getUserData` from `detect`/the adapter ctor, and unmount
`ProfilePanel`. Everything downstream is untouched.

---

## 2026-07-12 — North star: **multiplayer spinning app** (was: single-user telemetry logger)

**What.** The product vision shifts from a single-rider fit/telemetry logger to a
**multiplayer spinning** app: riders join a **shared live session** via a **4-letter lobby
code**; longer-term, gamification on top — e.g. **instant duels** when two riders ramp power at
the same time.

**Not now — deferred by explicit instruction.** Near-term work is unchanged: **finish the
single-user core, local/offline.** No lobby / network / multiplayer code until the core is done.

**Why it matters for the decisions below.** Multiplayer needs a **real-time relay/backend**,
which directly conflicts with the standing *"zero network at runtime, no cloud, ever — by design"*
stance in the stack decision. That offline-only rule now scopes to **the core / v1, not forever.**
When multiplayer begins we revisit: relay transport (WebSocket vs WebRTC), lobby-code → session
mapping, presence/sync, and whether offline single-user stays a first-class path.

**How to reverse.** Vision-level, reversible by decision. The framework-agnostic core
(`decode/` / `ble/` / `session/`) is unaffected either way — networking attaches *above* the
store, never inside the decoders.

---

## 2026-07-11 — Stack: Vite + React 19 + TypeScript (pnpm) — the PLAN §2 stack

**What.** Vite 8 + React 19 + TypeScript 6 (strict, byte-safety flags on), Zustand for state,
`idb` for IndexedDB, oxlint + prettier. Installed with pnpm. This **supersedes** the buildless
decision below.

**Why.** Clarified constraints: **build-time internet is available** (npm/pnpm fetch fine); the
"offline" requirement is about **how the app runs**, not how it's built. So there's no reason to
give up the PLAN's stack — TypeScript gives real compile-time byte-safety for frame parsing
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), and it's what PLAN.md already chose.

**"Offline" means runtime, not build.** The app must make **zero network requests at runtime**,
no accounts, all data in IndexedDB. It's served from `localhost` (Vite dev, or `vite build` →
static `dist/` behind any local server). No GitHub, no cloud, ever — by design, not limitation.

**Still gym-ready.** `vite build` emits static files with a relative `base`, servable from
`localhost` on a laptop/phone; Web Bluetooth's secure-context requirement is met by `localhost`.

**How to reverse.** Unlikely, but the framework-agnostic core (`decode/`, `ble/`, `session/`)
has no React imports, so it could move to another shell.

---

## 2026-07-11 — ~~Buildless, dependency-free PWA (plain ES modules)~~ — SUPERSEDED

> Superseded within the hour by the React decision above once it was clarified that npm/pnpm
> fetching is available. Kept for the record; rationale below was sound only under a (mistaken)
> no-package-install assumption.

## ~~Buildless, dependency-free PWA (plain ES modules) for v1~~

**What.** The app is plain JavaScript ES modules loaded directly by the browser
(`<script type="module">`), no bundler, no framework, no `npm install`. Types are expressed
via JSDoc `@typedef` + `// @ts-check` so an editor/`tsc` can still check byte math later.
Graphs are hand-rolled inline SVG. Storage is a thin IndexedDB wrapper; state is a ~40-line
pub/sub store. Everything is static files.

**Why.**
- **Offline tonight.** `npm install` of the PLAN's React/Vite/Zustand/idb stack fails without
  network (even `typescript` wouldn't link its binary from cache). Buildless needs zero install.
- **KISS** (explicit user ask). For a connect→capture→export→dashboard tool, a bundler +
  framework is more moving parts than the problem needs.
- **Runs from `localhost`, no cloud.** Web Bluetooth needs a secure context; offline that
  means `localhost`. Static files served by any local server (`python3 -m http.server`)
  satisfy it — no GitHub, no Pages, no network. (A future remote/Pages deploy stays possible
  but is explicitly *not* required.)
- **No lock-in.** The core (decoders, adapters, store, recorder) is framework-agnostic by
  design (PLAN §3), so it ports to React/TS unchanged if we want.

**Trade-off.** We lose compile-time TS enforcement now. Mitigated with `// @ts-check` + JSDoc
and guarded DataView reads. No automated tests tonight (user deferred them).

**No service worker in v1.** Offline caching isn't needed when serving from `localhost`; skip
it for KISS. Add later if we ever want installable-offline-from-a-remote.

**How to reverse.** When online, either keep this (it's adequate) or `npm create vite`, move
`src/decode/*` and `src/ble/*` in verbatim, and wrap the UI in React. The seams are already
there.

---

## 2026-07-11 — Target device is ICG IC-6; ICG-UART adapter only in v1

**What.** v1 implements the ICG Nordic-UART adapter only. FTMS / CPS / HR adapters are
scaffolded as seams (detect.js dispatch) but not built yet.

**Why.** User named IC-6 as the target. KISS: get one real device working end-to-end before
generalizing. The detection layer + `NormalizedSample` contract keep FTMS/HR additive (PLAN §10).

**How to reverse.** Add `adapters/ftmsAdapter.js` + `decode/ftms.js` and register in `detect.js`.
No change to recorder/store/UI (they only see `NormalizedSample`).

---

## 2026-07-11 — Protocol source of truth = PROTOCOL.md (reverse-engineered)

**What.** The ICG framing + live/aggregated decoders are implemented straight from
`PROTOCOL.md` (reverse-engineered from the official app v4.1.1).

**Why.** It's the confirmed protocol; standard CPS/HR/FTMS are unused by the IC-6's own app.

**Open at the bike (see PROTOCOL.md §9).** Whether the stream auto-starts or needs a trigger
command; exact units for lapTime/workoutTime/ftpPercent/brakeLevel. → We therefore **persist raw
bytes for every frame** so any wrong guess is a re-parse of stored logs, never a lost session.

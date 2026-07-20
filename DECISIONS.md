# Decision log

Newest first. Each entry: **what**, **why**, and **how to reverse** if we change our mind.

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

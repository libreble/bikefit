# Progress log

Running status so anyone (incl. future me) can pick this up. Newest first.

## 2026-07-12 — FTP / user-data handshake implemented (opt-in profile)

Reversed `setAllUserData` + the RX dispatch from the app bundle → **PROTOCOL.md §8a** (fixed 10-byte
`SET_ALL_USER_DATA` @ msg 2; FTP is u16 BE @ bytes 4–5; byte 7 = colorMode; the app answers msg 1
reactively). Built on it:
- **Rider profile** as a **modal popup** opened from a header button (`src/ui/ProfileDialog.tsx`,
  native `<dialog>`, off the main page for mobile) — FTP / weight / maxHR / age / name /
  Coach-By-Color, **localStorage**, Save + **Delete** (`src/profile/profile.ts`,
  `src/ui/ProfilePanel.tsx`). Browser-verified: open/save/flash, backdrop+Esc close, localStorage
  survives reload, Delete disabled until a profile exists.
- Adapter now answers `GET_ALL_USER_DATA` with the profile — **opt-in: silent if no profile saved**
  (`IcgUartAdapter.autoRespond`; provider threaded via `detect(..., {getUserData})`).
- Encoder `encodeIcgAllUserData` **verified byte-exact** (frame `ff0c02…3055`) + framer round-trip
  (Node type-strip harness, staged from real source). typecheck / lint / build all green.
- **Decision:** no live recompute — profile→bike→accurate msg-13 numbers; app-side recompute is
  historical-only (needs the persistence pivot). See DECISIONS.md (2026-07-12).
- **Aggregated interval (vendor app):** bike pushes LIVE+AGG *paired* at ~1 Hz; the app does no
  polling and no `throttleTime`/`sampleTime` — it consumes every message.
- **RE source preserved:** beautified bundle + base APK copied out of volatile /tmp to `~/icg-re/`.

**PENDING (needs the bike):** confirm the reply actually lights up Coach-By-Color and that the
bike's `AGGREGATED_STREAM` IF/TSS become sane once a real FTP is sent (they were inflated when msg 1
went unanswered). Set a profile with your real FTP, connect, watch the front light + the summary.

## 2026-07-12 — North-star pivot + session log analyzed

**North star changed → multiplayer spinning app.** Lobbies joined by a 4-letter code, shared
live sessions; later gamification (power-ramp "duels"). **Deferred — finish the single-user core
first, stay local/offline. No multiplayer code yet.** Rationale + the offline-vs-relay tension:
see DECISIONS.md (2026-07-12).

**Session log analyzed (the NEXT item below — DONE).** User exported two `SessionFile` JSONs
(start + end of one ~1 h IC-6 gym ride). Findings:
- **Decoder is clean on real field data** — 524 frames → 176 messages across both files, **zero**
  `ok:false`, zero bad checksums, only the expected msgIds (12 LIVE, 13 AGGREGATED, 1 GET_USER).
- **`ftpPercent` scaling resolved** (was TBC): plain integer % of FTP. 43 W→27%, 70 W→43%,
  82 W→51% all imply **FTP ≈ 160 W** configured in the bike. Field = `round(power/FTP×100)`.
- **`brakeLevel` confirmed live** (byte 12): 0→14 warmup, 22→35 hard finish. Observed range 0–35.
- **`workoutTime` counts active pedaling, not wall time** (advanced 54 min over 58 min wall).
- **HR = 0 everywhere** — no strap paired to console; bytes 5–6 decode fine, just empty.
- **Session state persists on the bike across app reconnects** — file 2 was a fresh app session
  (new session/device id) yet resumed at 3344 s / 33.4 km / 743 kcal with full aggregates.
- **Caveat:** aggregated `IF 1.3 / TSS 164` are inflated because the bike's FTP (~160 W) is below
  the rider's real FTP; `powerMax 303` / `cadenceMax 135` come from the unlogged mid-ride. The
  app should surface/override FTP rather than trust bike IF/TSS. (Not yet folded into PROTOCOL.md.)

**Near-term focus:** finish the single-user core (reliable connect → correct live tiles →
record/export). Multiplayer is later.

## 2026-07-12 (at the bike) — FIRST CONNECT SUCCESS ✅

First real ride: **connected on the first try, most live values visible in the app.** The
oracle-proven decoder works against real IC-6 hardware. Field notes:
- **Device name in the picker: `BIKE <number>`** (e.g. "BIKE 42"). The wide net paid off; later
  we can tighten with `namePrefix: 'BIKE'` and/or `{ services: [ICG_SERVICE] }`.
- **Streaming auto-starts on connect** — values appeared with no trigger command. Resolves the big
  open question: no RX handshake needed to begin the live stream.
- "Most" values, not all — some tiles may be blank/wrong; the log dump will pin down which.

### → ~~NEXT AGENT: analyze the exported session log~~ — DONE 2026-07-12 (see top entry)

The user will paste an exported **SessionFile JSON** (app → "Export session (JSON)"). It's
self-contained (schema in `src/types.ts`):
- `session.context` → `advertisedName`, `advertisedUuids`, `presentServices`, `rssi` (filter recon)
- `session.device` → name/id; `summary` → avg/max power/cadence/hr, distance, energy
- `frames[]` → every raw notification as hex `{seq,t,src,hex}` — lossless, re-parseable
- `messages[]` → decoded `{t,msgId,name,fields,leftover,ok}`

Checklist:
1. **Anomalies** — any message with non-empty `leftover` or `ok:false`? A LIVE frame (msg 12) with
   leftover means the 29-byte model is off for this firmware. Tally which msgId names appeared.
2. **Confirm the filter** — does `advertisedUuids` include `6e400001…`? Is `advertisedName` "BIKE ##"?
   Are standard CPS `0x1818` / CSC `0x1816` / FTMS `0x1826` in `presentServices` (a simpler path)?
3. **Confirm units** — sanity-check `fields` vs what the console displayed: `brakeLevel` range,
   `workoutTime`/`currentLapTime` (seconds?), `ftpPercent` scaling, speed/distance (÷10). Raw hex
   lets you re-parse — decoders are pure fns in `src/decode/` (framer + messages).
4. **Blank/wrong tile** — map it to the field/offset, fix the decoder, re-parse the stored frames.
5. Reference: `PROTOCOL.md` (spec), `src/decode/` (impl). Our decode is **oracle-verified
   byte-exact** vs the ICG app, so discrepancies are likelier firmware/unit differences than bugs.

## 2026-07-12 — deployed, validated, wider picker

- **Live on GitHub Pages:** https://libreble.github.io/bikefit/ (Actions workflow; relative
  `base` works at the `/bikefit/` subpath). Every push to `main` auto-redeploys. All Actions
  pinned to latest majors (Node 24 — no deprecation warnings).
- **Decoder validated against the real app (oracle test).** A faithful reimplementation of the
  ICG app's own decoder was diffed against ours over 4000 random frames each (framer, live,
  aggregated, encoder round-trip) plus 1000 corruption/fragmentation cases → **100% match**.
  Our frame decode is byte-for-byte the reference. Harness kept in scratchpad (`oracle.mts`),
  not committed (tests deferred); re-runnable with `pnpm dlx tsx`.
- **Wide-net device picker:** `requestDevice` now uses `acceptAllDevices` instead of service
  filters, so an inaccurate filter can never hide the bike. Tighten to
  `{ services: [ICG_SERVICE] }` (what the real app uses) once confirmed at the bike.
- **Connect-time recon captured:** session context now records the advertised name + service
  UUIDs (best-effort via `watchAdvertisements` — experimental in Chrome) and the services
  actually present after connect. Both show in the Debug/Log panel and the exported JSON, so a
  single real ride tells us whether a service filter is safe to use.

## 2026-07-11 (overnight build, offline)

**Goal for this session:** first working version — a live workout dashboard (tiles + graphs)
for the ICG IC-6, plus the debug **logging** feature: capture every raw BLE notification and
save/export a session for later analysis even when we can't decode it live.

**Stack decision:** buildless dependency-free PWA (see DECISIONS.md). Runs offline, deploys to
GitHub Pages as static files.

### Status
- [x] Repo init (local, no remote — no GitHub by design)
- [x] Decision log + progress log + task list
- [x] Scaffold — **Vite + React 19 + TS** (stack pivot, see DECISIONS): build-time net is fine,
      "offline" = runtime/local-first. pnpm. No service worker in v1 (localhost serving).
- [x] Shared contract (types, BLE constants, zustand store, hex/time utils)
- [x] ICG protocol core (framer, messages, encoder) — **passed offline smoke-test**
      (reassembly across BLE chunks, field decode, checksum reject, short-frame)
- [x] Session capture (IndexedDB + recorder + exporter)
- [x] BLE layer (BleConnection + detect + IcgUartAdapter + wake lock)
- [x] Controller (connect → detect → adapter → recorder orchestration)
- [x] Dashboard UI + graphs + debug log panel (built by a subagent; reviewed — clean)
- [x] Controller recreated after a subagent race deleted it (its stub-cleanup `rm`'d my
      uncommitted `src/app/controller.ts`; lesson: commit hand-written files before fanning out
      agents that touch the same dir)
- [x] Integration green: `pnpm typecheck`, `pnpm lint` (oxlint), `pnpm build` all pass;
      `dist/` builds (~220 kB js / 9 kB css)

### Verification done / pending
- DONE offline: protocol core smoke-test (synthetic frame round-trips), typecheck, lint, build.
- PENDING (needs a browser / the bike): visual render check (browser extension was offline at
  build time) and the real BLE session on the IC-6 — the point of the whole exercise. When you
  run `pnpm dev` and open localhost, watch the browser console; then at the gym, tap Connect and
  watch the Debug/Log panel fill with frames.

### Notes / things to verify at the bike (IC-6)
- Does the live stream (msg id 12) auto-start on connect, or does it need a trigger written to
  RX? The adapter auto-responds to known bike requests and exposes a manual "send command" box
  in the debug panel as a fallback.
- Confirm units live: brakeLevel range, lapTime/workoutTime (s vs ms), ftpPercent scaling.
- Confirm the device shows up under the Nordic-UART service filter and the name prefix.

### How to run (once files exist)
Any static server over https/localhost, e.g. `python3 -m http.server 8000` then open
`http://localhost:8000/`. For the gym, deploy to GitHub Pages (HTTPS) — Web Bluetooth needs it.

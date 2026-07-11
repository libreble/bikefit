# ICG Ride Logger — Implementation Plan

A local-first PWA that connects (over Web Bluetooth) to an ICG IC6 indoor bike and a
heart-rate strap, logs a complete training session, shows a live workout UI (HR zones,
average/normalized power), and saves the session to a self-contained file for later
analysis. Round 1 is deliberately rough but structurally solid, so rounds 2+ (confirming
our protocol guesses against the ICG app, richer analytics) drop in without a rewrite.

> **⚠️ Protocol update — see [`PROTOCOL.md`](./PROTOCOL.md).** The ICG app has been
> reverse-engineered (it's a Capacitor app; BLE logic is readable JS). The IC6 is **not**
> driven over the standard BLE fitness profiles — the app uses a **proprietary framed
> protocol over the Nordic UART Service**, with standard Cycling Power / Heart Rate / FTMS
> unused. `PROTOCOL.md` is the authoritative spec (framing, message IDs, byte layouts) and
> **supersedes the standard-profile assumptions** in §4–§5 and §11 below. This effectively
> completes "Round 2" ahead of schedule; the R1 core decoder should be the ICG UART framer,
> not the CPS/HR flag-walkers described here.

### North star

The bike logger is round one of a bigger idea: an **offline, open-source, account-less
health tracker**. Everything stays local; no login, no cloud. The same architecture —
*detect the device's BLE services → route to a protocol adapter → normalize → log raw+parsed*
— that reads an ICG or FTMS bike also reads a chest strap today and, later, BLE **scales
(weight/body-composition), blood-pressure monitors, SpO₂, glucose**. One local timeline of
your own health signals. We build toward it in slices (§10); **each slice must stand on its
own**, and slice one is simply: *at the gym next session, connect to the bike and capture data.*

---

## 1. Constraints that shape the design

These are platform facts, not choices, and every decision below follows from them:

- **Web Bluetooth is foreground-only.** No `navigator.bluetooth` in a service worker;
  GATT lives on the window main thread of a secure context. The session records only
  while the page is visible. Backgrounding the app freezes event processing. Acceptable,
  because the device sits on the bike showing live numbers.
- **Screen wake lock is mandatory.** Without it the display sleeps, visibility is lost,
  and mobile tears down the GATT link within seconds. Wake lock auto-releases on hide, so
  it must be re-acquired on `visibilitychange`.
- **Two devices = two connections = two user gestures.** `requestDevice` prompts once per
  device and can't multi-select. Bike and HR are fully independent connections with
  independent reconnect.
- **Our decoders will be wrong in unknown places** until we confirm against the ICG app.
  Therefore we persist **raw bytes plus the best-effort parse**, so a wrong guess is a
  re-parse of old logs, never a lost gym session. This is the single most important
  decision in round 1.
- **HTTPS required** for BLE, wake lock, and installability. GitHub Pages (already in the
  burnmark workflow) is the deploy target; `localhost` covers dev.

---

## 2. Stack & tooling

- **Vite + React 18 + TypeScript** (`react-ts` template).
- **State:** [Zustand](https://github.com/pmndrs/zustand) — minimal, no provider
  boilerplate, and (crucially) writable from plain non-React services. BLE managers and
  the recorder are framework-agnostic classes that push into the store; React reads from
  it. Swappable later; nothing else depends on the choice.
- **Persistence:** IndexedDB via [`idb`](https://github.com/jakearchibald/idb) (thin typed
  Promise wrapper). Not localStorage (size, string-only, sync).
- **Formatting/quality:** Prettier + `tsc --noEmit` typecheck. ESLint (`@typescript-eslint`)
  recommended but optional for R1.

### package.json scripts

```jsonc
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### tsconfig — strict, plus byte-safety flags

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,   // forces guarding DataView/array reads — matters for byte parsing
    "exactOptionalPropertyTypes": true, // clean modelling of "field present only if flag set"
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true
  }
}
```

`noUncheckedIndexedAccess` is not cosmetic here: it makes the compiler force offset/length
guards in the flag-walkers, which is exactly where a rough parser silently corrupts data.

---

## 3. Architecture

Strict layering, with **pure decoders** at the core so the same functions parse live frames
and re-parse stored raw bytes.

```
src/
  ble/
    constants.ts         // all UUIDs: ICG NUS, FTMS, CPS, CSC, HR, DeviceInfo, Battery
    BleConnection.ts     // generic GATT connect/notify/reconnect + wake-lock-aware lifecycle
    detect.ts            // after connect, inspect getPrimaryServices() -> choose adapter
    adapters/            // one per protocol; each emits NormalizedSample + keeps raw bytes
      TrainerAdapter.ts  // interface: protocol / start / onSample / stop
      IcgUartAdapter.ts  // ICG Nordic-UART framed protocol (see PROTOCOL.md)
      FtmsAdapter.ts     // FTMS Indoor Bike Data 0x2AD2 (Domyos & most smart bikes)
      CyclingPowerAdapter.ts // generic CPS 0x1818 / CSC 0x1816 fallback
      HeartRateAdapter.ts    // HRS 0x180D (+ RR intervals = HRV), independent connection
  decode/               // PURE, no DOM, no BLE — unit-testable, reusable for re-parse
    icgUart.ts           // frame state machine + decodeIcgLive / decodeIcgAggregated (big-endian)
    ftms.ts              // decodeIndoorBikeData(DataView) flag-walker (little-endian!)
    cyclingPower.ts      // decodeCpsMeasurement / CSC
    heartRate.ts         // decodeHrMeasurement -> bpm + RR
    context.ts           // Device Info / Battery / Feature bitfields
  session/
    Recorder.ts          // receives frames from the active adapter(s), timestamps, appends
    db.ts                // IndexedDB schema + read/write
    exporter.ts          // build SessionFile, serialize, trigger save
  metrics/              // PURE — derived metrics from sample streams
    power.ts             // avg, max, normalized power, kJ, (optional) TSS/IF
    heartRate.ts         // avg, max, time-in-zone
    zones.ts             // zone model + current-zone resolution
  store/
    useSessionStore.ts   // Zustand: connection state, live samples, derived metrics
  ui/
    App.tsx
    ConnectionBar.tsx
    LiveTiles.tsx
    HeartRateZones.tsx
    PowerSummary.tsx
    SessionControls.tsx
  types.ts
  main.tsx
```

**Data flow:** connect → `detect.ts` picks an adapter from the device's actual services →
the adapter emits a `NormalizedSample` (and the raw bytes) → `Recorder` writes a raw+parsed
`Frame` to IndexedDB and pushes the latest sample into the Zustand store → `metrics/*`
recompute derived values → UI renders. The recorder, metrics, and UI never learn *which*
protocol is underneath — they only ever see `NormalizedSample`. Save = `exporter` reads all
frames for the session and writes a `SessionFile`.

---

## 4. BLE layer

### Constants

```ts
export const ICG_NUS = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';           // ICG proprietary
export const ICG_RX  = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';           // write commands
export const ICG_TX  = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';           // notify stream
export const FTMS = 0x1826, FTMS_INDOOR_BIKE = 0x2ad2, FTMS_CP = 0x2ad9; // Domyos & most smart bikes
export const CPS = 0x1818, CPS_MEAS = 0x2a63, CPS_FEAT = 0x2a65, CPS_LOC = 0x2a5d;
export const CSC = 0x1816, HRS = 0x180d, HR_MEAS = 0x2a37;
export const DEV_INFO = 0x180a, BATTERY = 0x180f;
```

### Discovery & detection

`requestDevice` (one user gesture) lists **all** supported services so both ICG and FTMS bikes
appear, plus everything we'll later read as `optionalServices` (see PROTOCOL.md §1 for the exact
call). **Detection is after connect, not during scan** (Web Bluetooth can't probe an unpicked
device): `getPrimaryServices()` → pick adapter by priority `ICG-UART > FTMS > CPS`.

### Lifecycle (`BleConnection`)

- `connect()` — `requestDevice` (gesture) → `gatt.connect()` → `getPrimaryServices()` → `detect`.
- On connect, read and store **static context** once: Device Info, Battery, and the protocol's
  feature bitfield (CPS Feature / FTMS Feature). This metadata makes an old log interpretable.
- The chosen adapter subscribes to its notify characteristic (ICG `TX`, FTMS Indoor Bike Data,
  or CPS Measurement) and forwards `characteristicvaluechanged` as `NormalizedSample` + raw bytes.
- `gattserverdisconnected` → reconnect with capped backoff (250ms → 4s). Within a session
  no new gesture is needed. Cross-reload reconnect via `getDevices()` is deferred to R3.
- Owns nothing about UI; emits samples via callback/emitter.
- **May need a kick:** some FTMS machines require Control Point *Request Control → Start* before
  streaming; ICG may need a trigger too (open question). The adapter owns any such handshake.

### Wake lock (session-scoped, in the recorder or an app-level hook)

```ts
let lock: WakeLockSentinel | null = null;
const acquire = async () => { try { lock = await navigator.wakeLock.request('screen'); } catch {} };
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store.sessionActive) acquire();
});
```

### Known caveat to resolve at the bike

Most chest straps allow a single connection. If the IC6 console has claimed the strap for
its own HR mode, the PWA can't also have it — connect the strap to the *PWA*, or discover
whether the ICG relays HR over its own GATT (an R2 question).

---

## 5. Decoding (pure functions)

Both walkers advance a rolling offset and only read fields the flags declare. They also
record any **leftover bytes** — a non-zero remainder means our field model is wrong, which
is the signal we act on in R2.

### CPS `0x2A63`

`uint16` flags, then `sint16` instantaneous power (always present), then optional fields in
fixed order: pedal power balance (`uint8`, ½%), accumulated torque, wheel rev data, crank
rev data (cumulative revs + last-event time in 1/1024 s — differentiate across frames,
handle 16-bit rollover, this is cadence), extreme force/torque magnitudes, dead-spot
angles, accumulated energy. Capture all present, not just power/cadence/balance.

### HR `0x2A37`

`uint8` flags: bit0 selects `uint8`/`uint16` BPM format; bit3 energy expended; **bit4 RR
intervals** (array of `uint16`, 1/1024 s) — raw HRV data, captured because it's the most
valuable optional field and trivial to lose.

### Sample types

```ts
interface CpsSample {
  t: number;                     // performance.now() offset, ms
  powerW: number;
  cadenceRpm?: number;
  balanceLeftPct?: number;
  extra?: Record<string, number>;// any other decoded optional fields
}
interface HrSample {
  t: number;
  bpm: number;
  energyJ?: number;
  rrIntervalsMs?: number[];
}
```

### `NormalizedSample` — the common shape every adapter emits

Per-protocol decoders (above) produce their native structs; the adapter maps them into one
device-agnostic sample. Everything downstream (recorder, metrics, UI) sees only this. All
fields optional except `t` and `src` — a device provides the subset it exposes (see the
overlap table for ICG vs FTMS field mapping).

```ts
interface NormalizedSample {
  t: number;                       // performance.now() offset, ms
  src: 'icg' | 'ftms' | 'cps' | 'hr';
  powerW?: number;
  cadenceRpm?: number;
  speedKmh?: number;
  bpm?: number;
  rrIntervalsMs?: number[];        // HRV, when present
  resistance?: number;             // ICG brakeLevel / FTMS resistance level
  distanceKm?: number;
  energyKcal?: number;
  elapsedS?: number;
  extra?: Record<string, number>;  // protocol-specific extras (ICG zone/ftp%/IF/TSS/laps, FTMS avgs, …)
}
```

---

## 6. Session model & persistence (IndexedDB)

```ts
interface Frame {
  t: number;                     // performance.now() offset from session start, ms (monotonic)
  src: 'cps' | 'hr';
  raw: string;                   // hex of the full characteristic value — the re-parse safety net
  parsed: CpsSample | HrSample;
}

interface SessionMeta {
  id: string;                    // uuid
  startedAtWall: number;         // Date.now() at start — anchors monotonic t to real time
  endedAtWall?: number;
  devices: { bike?: DeviceInfo; hr?: DeviceInfo };
  context: { cpsFeature?: number; sensorLocation?: number; battery?: number; deviceInfo?: Record<string,string> };
  config: ZoneConfig & { ftpW?: number; maxHr?: number };
}
```

Two object stores: **`sessions`** (keyed by `id`) and **`frames`** (keyed by
`[sessionId, seq]`, append-only). A 45-min session at ~1–2 Hz is a few thousand rows —
negligible. `performance.now()` gives monotonic timing; `startedAtWall` anchors it to
wall-clock for analysis.

---

## 7. Save session to file (stated requirement)

The saved file is **self-contained and analysis-friendly**: metadata, static context, every
raw+parsed frame, and a computed summary in one document, so it loads directly into
`jq`/pandas/JS later without needing the app.

### `SessionFile` schema

```ts
interface SessionFile {
  version: 1;
  session: SessionMeta;
  frames: Frame[];               // raw hex preserved — re-parseable when guesses are corrected
  summary: SessionSummary;       // derived at save time (see §8)
}
```

### Mechanism

- Serialize to pretty JSON, wrap in a `Blob`, save via anchor download
  (`ride-<ISO>-<id>.json`). Reliable on mobile Chrome, which is the gym target.
- Where the **File System Access API** exists (desktop Chrome), offer
  `showSaveFilePicker` for a real save dialog; feature-detect and fall back to download.
- JSON (not NDJSON) for R1: one portable file, trivial to load. NDJSON/FIT/TCX exporters
  are additive in R3 and read from the same stored frames.

Autosave a crash-safe copy to IndexedDB continuously (that's just the frame store); the
file save is an explicit end-of-session action plus an "export past session" path.

---

## 8. Derived metrics (pure)

Computed live for the UI and recomputed at save time for `summary`.

- **Power:** average, max, energy (kJ = Σ power·dt / 1000), **Normalized Power** (30 s
  rolling average → 4th power → mean → 4th root). If FTP is set: IF = NP/FTP and
  TSS = (sec·NP·IF)/(FTP·3600)·100. FTP fits the ICG ecosystem, so wire the field even if
  TSS display waits for R3.
- **Heart rate:** average, max, **time-in-zone** distribution.
- **Cadence:** average, max.

```ts
function normalizedPower(samples: {t:number; powerW:number}[], windowS = 30): number {
  // 1) resample/rolling-average power over `windowS`, 2) mean of 4th powers, 3) 4th root
}
```

### Zone model

```ts
interface ZoneConfig {
  basis: 'hrMax' | 'lthr';
  // default %HRmax thresholds; array-driven so LTHR (Friel) swaps in without code change
  hrZones: number[];             // e.g. [0.60, 0.70, 0.80, 0.90] → 5 zones
}
```

Current zone = resolve latest BPM against `maxHr × thresholds`. Power zones (Coggan 7-zone
off FTP) are the same pattern and a natural R2/R3 add.

---

## 9. Workout UI

Kept modest for R1 but genuinely usable on the bike.

- **`ConnectionBar`** — two connect buttons (Bike, HR), live status dots, battery, reconnect
  indicator.
- **`LiveTiles`** — big-readout power / cadence / HR / elapsed, legible at arm's length.
- **`HeartRateZones`** — current zone (color + label), a zone bar showing where current HR
  sits, and a running time-in-zone breakdown.
- **`PowerSummary`** — avg, normalized, max, kJ; IF/TSS slot reserved.
- **`SessionControls`** — start / stop / save-to-file, plus an "export past session" entry
  point reading from IndexedDB.

A lightweight power+HR sparkline is optional in R1 (nice sanity check, low cost) and
formalizes into a proper session graph in R3.

---

## 10. Phasing

Each round is independently useful; we don't start the next until the current one works on
real hardware.

- **Round 1 — gym-ready capture (next session's goal).** PWA scaffold; Web Bluetooth connect
  with multi-service **detection**; adapters for **ICG-UART**, **FTMS indoor bike**, and **HR**;
  wake-lock lifecycle; **raw + best-effort-parsed frames to IndexedDB**; a minimal live readout
  (power / cadence / HR / speed, plus a raw-hex view and a "leftover/unparsed bytes" flag);
  export a self-contained JSON. Goal: *tap connect at the bike, watch numbers move, capture a
  whole ride to a file* — even if a unit or two is still guessed. Protocol RE is already done
  (PROTOCOL.md), so this is mostly plumbing.
- **Round 2 — make it a workout app.** Confirm units / streaming-trigger from R1 captures and
  **re-parse stored logs**; HR zones + time-in-zone; power avg/max/NP, IF/TSS (or read ICG's);
  cadence; nicer live UI; reconnect polish; optional session graph.
- **Round 3 — broaden the fitness side.** Other FTMS machine types (treadmill / rower /
  elliptical), generic CPS/CSC/RSC sensors, `getDevices()` reconnect-across-reload, FIT/TCX
  export for Strava/Golden Cheetah, HRV from the RR stream.
- **Round 4+ — the north star: full offline health tracker.** Add BLE **scales
  (weight/body-composition)**, **blood-pressure**, SpO₂, glucose as new adapters feeding the
  same normalized store; a unified local, account-less health timeline. No architecture change —
  just more adapters and views.

---

## 11. Open questions to settle at the bike / in the ICG app

> **Most of these are now answered from the app — see [`PROTOCOL.md`](./PROTOCOL.md) §8.**
> In short: cadence yes (proprietary stream, not CPS); pedal balance is **IC8-only**; HR is
> **relayed inside the bike's own stream** (no separate `0x180d`); the private service is the
> Nordic UART protocol; FTMS is absent. What still genuinely needs the physical bike:
> whether streaming auto-starts or needs a trigger, exact units (lapTime/workoutTime/
> ftpPercent/brakeLevel), and whether standard `0x1818`/`0x1816` are *also* live as a fallback.

1. Does the IC6 expose standard CPS `0x1818` at all, and is **crank rev data** present
   (i.e. do we get cadence, or only power)?
2. Does the CPS stream include **pedal power balance** on the IC6, or is that IC7-only?
3. Can the PWA hold the **HR strap** while the console also wants it, or must we pick one —
   and does the IC6 re-broadcast HR over its own GATT?
4. Any **private ICG service** on the bike, and what's in it?
5. Confirm **FTMS `0x1826` is absent** (expected — manual brake, read-only).

---

## 12. Definition of done — Round 1

Scoped to **capture, not analytics** — the goal is a trustworthy first ride log from the gym:

- Tap **Connect**; the app **detects** whether the picked device is ICG-UART, FTMS, or CPS,
  and connects (HR strap is an optional second connect).
- Screen **stays awake** through a full ride (wake lock, re-acquired on `visibilitychange`).
- **Every notification stored as raw hex + best-effort parse** in IndexedDB, with a visible
  "leftover/unparsed bytes" flag so a wrong guess is obvious, not silent.
- Live readout shows **power, cadence, HR, speed, elapsed** updating in real time, plus a
  raw-frame view for on-the-spot protocol confirmation.
- End-of-session (or "export past session") writes a self-contained `SessionFile` JSON to disk.
- `npm run typecheck` and `npm run format:check` pass clean.

Zones, normalized power, IF/TSS and time-in-zone move to **Round 2** — they're analysis on top
of captured frames, not needed to get real data off the bike next session.

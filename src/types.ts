/**
 * Central contract shared by every layer. Keep this framework-agnostic (no React, no BLE
 * imports) — decoders, adapters, the recorder and the store all speak these types.
 */

/** Which protocol produced a sample/frame. `icg` = ICG Nordic-UART (our v1 target, IC-6). */
export type SampleSource = 'icg' | 'ftms' | 'cps' | 'hr'

/**
 * The device-agnostic sample every adapter emits. Everything downstream (recorder, store, UI)
 * sees only this — it never learns which protocol is underneath. All metrics optional except
 * `t`/`src`; a device provides the subset it exposes.
 */
export interface NormalizedSample {
  /** ms since session start (monotonic, from performance.now offset). */
  t: number
  src: SampleSource
  powerW?: number
  cadenceRpm?: number
  speedKmh?: number
  bpm?: number
  /** R-R intervals (ms) — HRV, when the source provides them. */
  rrIntervalsMs?: number[]
  /** ICG brakeLevel / FTMS resistance level (unit is protocol-specific). */
  resistance?: number
  distanceKm?: number
  energyKcal?: number
  elapsedS?: number
  /** Protocol-specific extras (ICG: zone, ftpPercent, IF/TSS, laps, W/kg, W/HR; FTMS: averages). */
  extra?: Record<string, number>
}

/**
 * One decoded point in the persisted session time series (the ~1 Hz LIVE stream). This — not raw
 * bytes — is what a session stores now: the genuinely-changing metrics, enough to redraw the graphs
 * and review a past ride. Raw-frame capture was dropped once the decoder was proven (DECISIONS.md).
 */
export interface SessionSample {
  /** ms since session start (monotonic). */
  t: number
  powerW?: number
  cadenceRpm?: number
  bpm?: number
  speedKmh?: number
  /** ICG brakeLevel / FTMS resistance level. */
  resistance?: number
  distanceKm?: number
  energyKcal?: number
  elapsedS?: number
}

/**
 * A decoded protocol message — derived from raw bytes, used for the live debug view and the
 * exported summary. `leftover` being non-empty is our wrong-guess signal (PLAN §5).
 */
export interface DecodedMessage {
  /** ms since session start. */
  t: number
  src: SampleSource
  /** Protocol message id (ICG BLE_MSG_ID_*), when applicable. */
  msgId?: number
  /** Human-readable name, when known. */
  name?: string
  /** Decoded fields for display. */
  fields?: Record<string, number | number[]>
  /** Hex of bytes we could not account for — non-empty means our field model is wrong. */
  leftover?: string
  /** True for a session-totals message (ICG AGGREGATED_STREAM); the recorder keeps the latest. */
  aggregate?: boolean
  /** Frame/checksum validity. */
  ok: boolean
}

export interface DeviceInfo {
  name?: string
  /** Opaque per-browser device id (Web Bluetooth `BluetoothDevice.id`). */
  id?: string
  firmware?: string
  serial?: string
  /** e.g. "IC6" once we can read/guess it. */
  model?: string
}

/**
 * What a device broadcasts in its advertisement — the ground truth for whether a
 * `{ services: [...] }` picker filter would surface it. Captured best-effort via
 * `watchAdvertisements()` (experimental in Chrome), so treat as a bonus, not guaranteed.
 */
export interface AdvertisementInfo {
  name?: string
  /** Advertised service UUIDs — does it include our ICG service? This confirms the filter. */
  uuids: string[]
  rssi?: number
  txPower?: number
  appearance?: number
  /** Company IDs present in manufacturer data. */
  manufacturerData?: number[]
  /** Service UUIDs that carry service data. */
  serviceData?: string[]
}

export interface SessionMeta {
  /** uuid */
  id: string
  /** Date.now() at start — anchors monotonic `t` to wall-clock. */
  startedAtWall: number
  endedAtWall?: number
  device?: DeviceInfo
  protocol?: SampleSource
  /** Static context read once at connect (firmware, battery, feature bits, …). */
  context?: Record<string, string | number>
}

export interface SessionSummary {
  /** Number of stored time-series points (~1 Hz). */
  samples: number
  durationS: number
  avgPowerW?: number
  maxPowerW?: number
  avgCadenceRpm?: number
  maxCadenceRpm?: number
  avgBpm?: number
  maxBpm?: number
  distanceKm?: number
  energyKcal?: number
}

/**
 * Self-contained, analysis-friendly export: metadata + the decoded LIVE time series + the bike's
 * final aggregated totals + our summary — one JSON document, loadable in jq/pandas/JS without the
 * app. v2 dropped the raw-frame/message logs once the decoder was proven (DECISIONS.md).
 */
export interface SessionFile {
  version: 2
  session: SessionMeta
  summary: SessionSummary
  /** The bike's own final AGGREGATED_STREAM totals (IF/TSS/time-in-zone/…), latest snapshot only. */
  aggregated?: Record<string, number | number[]>
  /** Decoded LIVE time series (~1 Hz). */
  samples: SessionSample[]
}

/** Sink an adapter pushes into. The recorder implements this (persist the time series, update store). */
export interface AdapterEvents {
  /** Each decoded message. The recorder keeps the latest `aggregate` one; the rest are transient. */
  onMessage: (m: DecodedMessage) => void
  /** Each normalized sample — drives the live dashboard and the persisted time series. */
  onSample: (s: NormalizedSample) => void
}

/** Monotonic clock returning ms since session start — keeps all timestamps on one base. */
export type Clock = () => number

/**
 * One protocol implementation. Depends only on a GATT server + these abstractions
 * (dependency inversion): the rest of the app never imports an adapter directly, only via
 * `detect()`.
 */
export interface TrainerAdapter {
  readonly protocol: SampleSource
  deviceInfo(): DeviceInfo
  /** Subscribe to notifications and begin emitting events. Runs any needed handshake. */
  start(events: AdapterEvents, now: Clock): Promise<void>
  stop(): Promise<void>
  /** Write a raw command to the device (e.g. a stream trigger). Optional per protocol. */
  sendCommand?(bytes: Uint8Array): Promise<void>
}

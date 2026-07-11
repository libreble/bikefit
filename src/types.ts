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
 * Lossless record of one BLE notification exactly as it arrived — the re-parse safety net.
 * Even if our decode is wrong, the raw bytes are preserved so old logs can be re-parsed.
 * This is the core of the debug "logging" feature.
 */
export interface RawFrame {
  /** Monotonic sequence within the session. */
  seq: number
  /** ms since session start. */
  t: number
  src: SampleSource
  /** Full characteristic value as lowercase hex, no separators. */
  hex: string
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
  frames: number
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

/** Self-contained, analysis-friendly export: metadata + every raw frame + decoded + summary. */
export interface SessionFile {
  version: 1
  session: SessionMeta
  frames: RawFrame[]
  messages: DecodedMessage[]
  summary: SessionSummary
}

/** Sink an adapter pushes into. The recorder implements this (persist raw, update store). */
export interface AdapterEvents {
  /** Every raw notification, hex. Lossless — persisted verbatim. */
  onRaw: (hex: string) => void
  /** Each decoded message (for live debug + summary). */
  onMessage: (m: DecodedMessage) => void
  /** Each normalized sample (for live dashboard). */
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

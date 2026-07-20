/**
 * Inverse of the ICG stream decoders (src/decode/icgMessages.ts): build the raw LIVE (msg 12) and
 * AGGREGATED (msg 13) payloads a real IC-6 emits. Used only by the demo bike (src/demo) so its
 * frames flow through the exact same framer → decoder → recorder path as hardware and export just
 * like a real ride. Big-endian; every scale mirrors the decoder (speed/distance ×10, the ×10 ratio
 * bytes, u8 vs i16 widths), so `decode(encode(x)) === x` within rounding.
 */

import { ICG_AGG_LEN, ICG_LIVE_LEN } from '../decode/icgMessages'

/** LIVE_STREAM (msg 12) fields — real units; scaling is applied on encode. */
export interface LiveFields {
  power: number
  ftpPercent: number
  trainingZone: number
  heartRate: number
  hrPercentOfMax: number
  powerToHrRatio: number
  powerToWeightRatio: number
  cadence: number
  speedKmh: number
  brakeLevel: number
  currentLap: number
  currentLapTime: number
  currentLapDistance: number
  totalLaps: number
  workoutTime: number
  distanceKm: number
  calories: number
}

/** AGGREGATED_STREAM (msg 13) fields — real units; the five zone arrays are length 5. */
export interface AggFields {
  powerAvg: number
  powerMax: number
  powerToHrAvg: number
  powerToWeightAvg: number
  calories: number
  hrAvg: number
  hrMax: number
  cadenceAvg: number
  cadenceMax: number
  distance: number
  speedAvg: number
  speedMax: number
  intensityFactor: number
  trainingStressScore: number
  timeInZone: number[]
  percentInZone: number[]
  distanceInZone: number[]
  caloriesInZone: number[]
  ep: number
}

const r = Math.round
const u8 = (v: number): number => {
  const n = r(v)
  return n < 0 ? 0 : n > 0xff ? 0xff : n
}
const at = (a: number[], i: number): number => a[i] ?? 0

/** Encode a 29-byte LIVE_STREAM payload (inverse of {@link decodeIcgLive}). */
export function encodeLivePayload(f: LiveFields): Uint8Array {
  const p = new Uint8Array(ICG_LIVE_LEN)
  const d = new DataView(p.buffer)
  d.setInt16(0, r(f.power), false)
  d.setInt16(2, r(f.ftpPercent), false)
  d.setUint8(4, u8(f.trainingZone))
  d.setUint8(5, u8(f.heartRate))
  d.setUint8(6, u8(f.hrPercentOfMax))
  d.setUint8(7, u8(f.powerToHrRatio * 10))
  d.setUint8(8, u8(f.powerToWeightRatio * 10))
  d.setUint8(9, u8(f.cadence))
  d.setInt16(10, r(f.speedKmh * 10), false)
  d.setUint8(12, u8(f.brakeLevel))
  d.setUint8(13, u8(f.currentLap))
  d.setInt32(14, r(f.currentLapTime), false)
  d.setInt16(18, r(f.currentLapDistance * 10), false)
  d.setUint8(20, u8(f.totalLaps))
  d.setInt32(21, r(f.workoutTime), false)
  d.setInt16(25, r(f.distanceKm * 10), false)
  d.setInt16(27, r(f.calories), false)
  return p
}

/** Encode a 59-byte AGGREGATED_STREAM payload (inverse of {@link decodeIcgAggregated}). */
export function encodeAggPayload(f: AggFields): Uint8Array {
  const p = new Uint8Array(ICG_AGG_LEN)
  const d = new DataView(p.buffer)
  d.setInt16(0, r(f.powerAvg), false)
  d.setInt16(2, r(f.powerMax), false)
  d.setUint8(4, u8(f.powerToHrAvg * 10))
  d.setUint8(5, u8(f.powerToWeightAvg * 10))
  d.setInt16(6, r(f.calories), false)
  d.setUint8(8, u8(f.hrAvg))
  d.setUint8(9, u8(f.hrMax))
  d.setUint8(10, u8(f.cadenceAvg))
  d.setUint8(11, u8(f.cadenceMax))
  d.setInt16(12, r(f.distance * 10), false)
  d.setInt16(14, r(f.speedAvg * 10), false)
  d.setInt16(16, r(f.speedMax * 10), false)
  d.setInt16(18, r(f.intensityFactor * 10), false)
  d.setInt16(20, r(f.trainingStressScore * 10), false)
  ;[22, 24, 26, 28, 30].forEach((o, i) => d.setInt16(o, r(at(f.timeInZone, i)), false))
  ;[32, 33, 34, 35, 36].forEach((o, i) => d.setUint8(o, u8(at(f.percentInZone, i))))
  ;[37, 39, 41, 43, 45].forEach((o, i) => d.setInt16(o, r(at(f.distanceInZone, i) * 10), false))
  ;[47, 49, 51, 53, 55].forEach((o, i) => d.setInt16(o, r(at(f.caloriesInZone, i)), false))
  d.setInt16(57, r(f.ep * 10), false)
  return p
}

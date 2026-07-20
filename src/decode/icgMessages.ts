/**
 * ICG message decoders (PROTOCOL.md §3–§7). Big-endian. Pure functions: same code decodes a
 * live frame and re-parses a stored raw frame. Unknown/undecoded messages still round-trip via
 * their preserved raw bytes — nothing is lost.
 */

import type { DecodedMessage, NormalizedSample } from '../types'
import { bytesToHex } from '../util/hex'

/** BLE_MSG_ID_* values we care about (full table in PROTOCOL.md §3). */
export const ICG_MSG = {
  NULL: 0,
  GET_ALL_USER_DATA: 1,
  SET_ALL_USER_DATA: 2,
  GENERAL_STREAM_DATA: 3,
  GET_PHONE_NAME: 4,
  SET_PHONE_NAME: 5,
  LIVE_STREAM: 12,
  AGGREGATED_STREAM: 13,
  SET_FTP_TEST_RESULT: 15,
  REQUEST_DISCONNECT: 16,
  POWER_TEST_STREAM: 27,
  FIRMWARE_VERSIONS: 33,
  IC8_PEDALLING_SYMMETRY: 37,
  GET_SERIAL_NUMBER: 38,
  SET_SERIAL_NUMBER: 39,
  GET_TRAINING_MODE: 40,
  SET_TRAINING_MODE: 41,
  GET_BIKE_TYPE: 42,
  SET_BIKE_TYPE: 43,
} as const

const NAMES: Record<number, string> = {
  0: 'NULL',
  1: 'GET_ALL_USER_DATA',
  2: 'SET_ALL_USER_DATA',
  3: 'GENERAL_STREAM_DATA',
  4: 'GET_PHONE_NAME',
  5: 'SET_PHONE_NAME',
  12: 'LIVE_STREAM',
  13: 'AGGREGATED_STREAM',
  15: 'SET_FTP_TEST_RESULT',
  16: 'REQUEST_DISCONNECT',
  27: 'POWER_TEST_STREAM',
  33: 'FIRMWARE_VERSIONS',
  37: 'IC8_PEDALLING_SYMMETRY',
  38: 'GET_SERIAL_NUMBER',
  39: 'SET_SERIAL_NUMBER',
  40: 'GET_TRAINING_MODE',
  41: 'SET_TRAINING_MODE',
  42: 'GET_BIKE_TYPE',
  43: 'SET_BIKE_TYPE',
}

export function icgMessageName(msgId: number): string {
  return NAMES[msgId] ?? `MSG_${msgId}`
}

/** Payload length of a full live-stream frame (PROTOCOL.md §4). */
export const ICG_LIVE_LEN = 29
/** Payload length of a full aggregated frame (PROTOCOL.md §5). */
export const ICG_AGG_LEN = 59

function dv(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength)
}

export interface LiveDecode {
  fields: Record<string, number>
  sample: NormalizedSample
}

/** Decode LIVE_STREAM (msg 12). Throws nothing; caller guards length via the returned message. */
export function decodeIcgLive(data: Uint8Array, tMs: number): LiveDecode {
  const d = dv(data)
  const power = d.getInt16(0, false)
  const ftpPercent = d.getInt16(2, false)
  const trainingZone = d.getUint8(4)
  const heartRate = d.getUint8(5)
  const hrPercentOfMax = d.getUint8(6)
  const powerToHrRatio = d.getUint8(7) / 10
  const powerToWeightRatio = d.getUint8(8) / 10
  const cadence = d.getUint8(9)
  const speedKmh = d.getInt16(10, false) / 10
  const brakeLevel = d.getUint8(12)
  const currentLap = d.getUint8(13)
  const currentLapTime = d.getInt32(14, false)
  const currentLapDistance = d.getInt16(18, false) / 10
  const totalLaps = d.getUint8(20)
  const workoutTime = d.getInt32(21, false)
  const distanceKm = d.getInt16(25, false) / 10
  const calories = d.getInt16(27, false)

  const fields: Record<string, number> = {
    power,
    ftpPercent,
    trainingZone,
    heartRate,
    hrPercentOfMax,
    powerToHrRatio,
    powerToWeightRatio,
    cadence,
    speedKmh,
    brakeLevel,
    currentLap,
    currentLapTime,
    currentLapDistance,
    totalLaps,
    workoutTime,
    distanceKm,
    calories,
  }

  const sample: NormalizedSample = {
    t: tMs,
    src: 'icg',
    powerW: power,
    cadenceRpm: cadence,
    speedKmh,
    resistance: brakeLevel,
    distanceKm,
    energyKcal: calories,
    elapsedS: workoutTime,
    extra: {
      ftpPercent,
      trainingZone,
      hrPercentOfMax,
      powerToHrRatio,
      powerToWeightRatio,
      currentLap,
      currentLapTime,
      currentLapDistance,
      totalLaps,
    },
  }
  // HR of 0 means "no strap" — omit so the tile shows "--" rather than a fake 0.
  if (heartRate > 0) sample.bpm = heartRate

  return { fields, sample }
}

/** Decode AGGREGATED_STREAM (msg 13) scalar fields + zone arrays (PROTOCOL.md §5). */
export function decodeIcgAggregated(data: Uint8Array): Record<string, number | number[]> {
  const d = dv(data)
  const word = (o: number) => d.getInt16(o, false)
  const arr5 = (offs: number[], scale = 1) => offs.map((o) => word(o) / scale)
  return {
    powerAvg: word(0),
    powerMax: word(2),
    powerToHrAvg: d.getUint8(4) / 10,
    powerToWeightAvg: d.getUint8(5) / 10,
    calories: word(6),
    hrAvg: d.getUint8(8),
    hrMax: d.getUint8(9),
    cadenceAvg: d.getUint8(10),
    cadenceMax: d.getUint8(11),
    distance: word(12) / 10,
    speedAvg: word(14) / 10,
    speedMax: word(16) / 10,
    intensityFactor: word(18) / 10,
    trainingStressScore: word(20) / 10,
    timeInZone: arr5([22, 24, 26, 28, 30]),
    percentInZone: [
      d.getUint8(32),
      d.getUint8(33),
      d.getUint8(34),
      d.getUint8(35),
      d.getUint8(36),
    ],
    distanceInZone: arr5([37, 39, 41, 43, 45], 10),
    caloriesInZone: arr5([47, 49, 51, 53, 55]),
    ep: word(57) / 10,
  }
}

export interface DecodedResult {
  message: DecodedMessage
  sample?: NormalizedSample
}

/**
 * Turn a reassembled frame into a display message (+ a live sample when applicable).
 * Never throws: length shortfalls are reported as `leftover`/`ok:false`, and the raw bytes are
 * preserved by the caller regardless.
 */
export function decodeIcgMessage(msgId: number, data: Uint8Array, tMs: number): DecodedResult {
  const name = icgMessageName(msgId)

  if (msgId === ICG_MSG.LIVE_STREAM) {
    if (data.byteLength < ICG_LIVE_LEN) {
      return { message: { t: tMs, src: 'icg', msgId, name, ok: false, leftover: bytesToHex(data) } }
    }
    const { fields, sample } = decodeIcgLive(data, tMs)
    const leftover = data.byteLength > ICG_LIVE_LEN ? bytesToHex(data.subarray(ICG_LIVE_LEN)) : ''
    const message: DecodedMessage = { t: tMs, src: 'icg', msgId, name, fields, ok: true }
    if (leftover) message.leftover = leftover
    return { message, sample }
  }

  if (msgId === ICG_MSG.AGGREGATED_STREAM) {
    if (data.byteLength < ICG_AGG_LEN) {
      return { message: { t: tMs, src: 'icg', msgId, name, ok: false, leftover: bytesToHex(data) } }
    }
    return {
      message: { t: tMs, src: 'icg', msgId, name, fields: decodeIcgAggregated(data), aggregate: true, ok: true },
    }
  }

  // Known-but-undecoded (firmware, serial, training mode, …): keep the raw bytes visible.
  const message: DecodedMessage = { t: tMs, src: 'icg', msgId, name, ok: true }
  if (data.byteLength > 0) message.fields = { byteLength: data.byteLength }
  return { message }
}

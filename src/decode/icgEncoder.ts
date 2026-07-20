/**
 * Build ICG command frames to write to the RX characteristic (PROTOCOL.md §2). Used to
 * respond to the bike's requests and, if the live stream turns out to need a kick, to send a
 * trigger. Inverse of the framer's checksum.
 */

import { ICG_MSG } from './icgMessages'

const SOF = 0xff
const EOF = 0x55

/** Encode `[SOF][LEN][MSG_ID][DATA…][XOR][EOF]`. Throws if the payload is too long. */
export function encodeIcgFrame(msgId: number, data: Uint8Array = new Uint8Array(0)): Uint8Array {
  const n = data.length
  const len = n + 2
  if (len > 256) throw new RangeError(`ICG payload too long: ${n} bytes`)

  const frame = new Uint8Array(n + 5)
  frame[0] = SOF
  frame[1] = len
  frame[2] = msgId
  frame.set(data, 3)

  let checksum = len ^ msgId
  for (const b of data) checksum ^= b
  frame[n + 3] = checksum & 0xff
  frame[n + 4] = EOF
  return frame
}

/**
 * Fields for `SET_ALL_USER_DATA` (msg 2) — the reply to the bike's `GET_ALL_USER_DATA`
 * (PROTOCOL.md §8a). The payload is a fixed 10 bytes; only `ftpIndoorW` is load-bearing (it drives
 * the bike's Coach-By-Color zones / IF / TSS). Everything else is cosmetic or unlocks W/kg (weight)
 * and %HRmax (maxHr). Unset fields should be passed as 0.
 */
export interface IcgUserData {
  /** Indoor FTP, watts (bytes 4–5, u16 BE). */
  ftpIndoorW: number
  /** Body weight, kg (byte 2) — enables W/kg. */
  weightKg: number
  /** Max heart rate, bpm (byte 6) — enables %HRmax. */
  maxHr: number
  /** Age, years (byte 1). */
  ageYears: number
  /** Fitness level (byte 3). */
  fitnessLevel: number
  /** Gender code as the app stores it: byte 0 bit0 is set when `gender === 0` (cosmetic). */
  gender: number
  /** First-name initial (byte 8) — shown on the bike console. */
  firstInitial: string
  /** Surname initial (byte 9). */
  lastInitial: string
  /** Enable Coach-By-Color (byte 7 bit0) — lights the bike's front indicator by zone. */
  colorMode: boolean
}

const u8 = (v: number): number => {
  const n = Math.round(v)
  return n < 0 ? 0 : n > 0xff ? 0xff : n
}
const u16 = (v: number): number => {
  const n = Math.round(v)
  return n < 0 ? 0 : n > 0xffff ? 0xffff : n
}
const initialByte = (s: string): number => (s.length > 0 ? s.charCodeAt(0) & 0xff : 0)

/**
 * Build a `SET_ALL_USER_DATA` (msg 2) frame. Byte-for-byte the official app's `setAllUserData`
 * (PROTOCOL.md §8a): a fixed 10-byte, big-endian payload framed by {@link encodeIcgFrame}.
 */
export function encodeIcgAllUserData(u: IcgUserData): Uint8Array {
  const p = new Uint8Array(10)
  p[0] = u.gender === 0 ? 1 : 0
  p[1] = u8(u.ageYears)
  p[2] = u8(u.weightKg)
  p[3] = u8(u.fitnessLevel)
  const ftp = u16(u.ftpIndoorW)
  p[4] = (ftp >>> 8) & 0xff
  p[5] = ftp & 0xff
  p[6] = u8(u.maxHr)
  p[7] = u.colorMode ? 1 : 0
  p[8] = initialByte(u.firstInitial)
  p[9] = initialByte(u.lastInitial)
  return encodeIcgFrame(ICG_MSG.SET_ALL_USER_DATA, p)
}

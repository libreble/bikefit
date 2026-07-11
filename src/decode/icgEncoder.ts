/**
 * Build ICG command frames to write to the RX characteristic (PROTOCOL.md §2). Used to
 * respond to the bike's requests and, if the live stream turns out to need a kick, to send a
 * trigger. Inverse of the framer's checksum.
 */

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

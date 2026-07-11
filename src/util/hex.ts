/** Byte <-> hex helpers. Lowercase, no separators, so hex round-trips losslessly. */

export function bytesToHex(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/\s+/g, '')
  const len = clean.length >> 1
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16)
  return out
}

/** Space-grouped hex for human reading in the debug panel, e.g. "ff 0d 0c 00 …". */
export function hexPretty(hex: string): string {
  return hex.replace(/(..)/g, '$1 ').trim()
}

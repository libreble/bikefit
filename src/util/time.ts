/** Timing + id helpers. `performance.now()` gives monotonic ms; wall-clock anchors it. */

export function nowMs(): number {
  return performance.now()
}

export function uuid(): string {
  return crypto.randomUUID()
}

/** Seconds -> "h:mm:ss" or "m:ss". */
export function formatDuration(totalS: number): string {
  const s = Math.max(0, Math.floor(totalS))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`
}

/**
 * Screen wake lock. Without it the display sleeps, the page loses visibility, and mobile tears
 * down the GATT link within seconds. The lock auto-releases on hide, so we re-acquire on
 * `visibilitychange` while a session is active (PLAN §4).
 */

let sentinel: WakeLockSentinel | null = null
let wanted = false

async function request(): Promise<void> {
  if (!('wakeLock' in navigator)) return
  try {
    sentinel = await navigator.wakeLock.request('screen')
  } catch (e) {
    // Denied (e.g. tab not focused) — will retry on next visibility change.
    console.warn('[wakeLock] request failed', e)
  }
}

export async function acquireWakeLock(): Promise<void> {
  wanted = true
  await request()
}

export async function releaseWakeLock(): Promise<void> {
  wanted = false
  try {
    await sentinel?.release()
  } finally {
    sentinel = null
  }
}

document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible' && sentinel === null) void request()
})

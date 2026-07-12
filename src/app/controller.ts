/**
 * Orchestration the UI drives. Owns the connect → detect → adapter → recorder wiring and the
 * session lifecycle, keeping the React layer free of BLE details. One module-level connection
 * at a time (this is a single-bike app). On reconnect the same recorder continues, so a dropout
 * is one continuous session with a gap, not a new log.
 */

import type { AdvertisementInfo, DecodedMessage, SampleSource, SessionMeta, TrainerAdapter } from '../types'
import { BleConnection } from '../ble/BleConnection'
import { detect } from '../ble/detect'
import { acquireWakeLock, releaseWakeLock } from '../ble/wakeLock'
import { Recorder } from '../session/recorder'
import { exportSession } from '../session/exporter'
import { deleteSession, listSessions } from '../session/db'
import { useSessionStore } from '../store/useSessionStore'
import { hexToBytes, bytesToHex } from '../util/hex'
import { uuid } from '../util/time'

let connection: BleConnection | null = null
let adapter: TrainerAdapter | null = null
let recorder: Recorder | null = null
let sessionId: string | null = null
let pendingAd: AdvertisementInfo | null = null

const store = () => useSessionStore.getState()

/** (Re)attach an adapter to a freshly connected server. Runs on first connect and each reconnect. */
async function onReady(
  server: BluetoothRemoteGATTServer,
  device: BluetoothDevice,
): Promise<void> {
  const { adapter: a, services } = await detect(server, device)
  adapter = a
  store().setDevice(a.deviceInfo(), a.protocol)

  if (!recorder) {
    const meta: SessionMeta = {
      id: uuid(),
      startedAtWall: Date.now(),
      device: a.deviceInfo(),
      protocol: a.protocol,
    }
    recorder = new Recorder(meta)
    sessionId = meta.id
    await recorder.init()
    await acquireWakeLock()
    await logConnectContext(a.protocol, services)
  }

  await a.start(recorder, recorder.now)
}

/**
 * Record what we learned at connect — advertised name/uuids (if captured) and the services
 * actually present — into the session context and the debug log. This is what lets us confirm,
 * after a real ride, whether a `{ services: [ICG_SERVICE] }` picker filter is safe to use.
 */
async function logConnectContext(protocol: SampleSource, services: string[]): Promise<void> {
  const rec = recorder
  if (!rec) return
  const ctx: Record<string, string | number> = { presentServices: services.join(',') }
  const messages: DecodedMessage[] = []

  if (pendingAd) {
    ctx.advertisedName = pendingAd.name ?? ''
    ctx.advertisedUuids = pendingAd.uuids.join(',')
    if (pendingAd.rssi !== undefined) ctx.rssi = pendingAd.rssi
    messages.push({
      t: 0,
      src: protocol,
      ok: true,
      name: `ADV name=${pendingAd.name ?? '?'} uuids=[${pendingAd.uuids.join(' ') || 'none'}] rssi=${pendingAd.rssi ?? '?'}`,
    })
  } else {
    messages.push({
      t: 0,
      src: protocol,
      ok: true,
      name: 'ADV not captured (watchAdvertisements unsupported — enable chrome://flags Experimental Web Platform features to see it)',
    })
  }
  messages.push({ t: 0, src: protocol, ok: true, name: `SERVICES present=[${services.join(' ')}]` })

  await rec.setContext(ctx)
  for (const m of messages) store().pushMessage(m)
}

/** Prompt for a device and start a session. Must be called from a user gesture (button click). */
export async function connect(): Promise<void> {
  if (connection) return
  pendingAd = null
  const conn = new BleConnection({
    onReady,
    onStatus: (status, error) => store().setStatus(status, error),
    onAdvertisement: (ad) => {
      pendingAd = ad
      console.info('[controller] advertisement', ad)
    },
  })
  connection = conn
  try {
    await conn.connect()
  } catch (e) {
    connection = null
    if (e instanceof DOMException && e.name === 'NotFoundError') {
      store().setStatus('idle') // user dismissed the chooser — not an error
    } else {
      store().setStatus('error', e instanceof Error ? e.message : String(e))
    }
  }
}

/** Intentional teardown: stop notifications, finalize the log, release the lock. */
export async function disconnect(): Promise<void> {
  try {
    await adapter?.stop()
  } catch (e) {
    console.warn('[controller] adapter stop failed', e)
  }
  try {
    await recorder?.finalize()
  } catch (e) {
    console.warn('[controller] finalize failed', e)
  }
  await releaseWakeLock()
  connection?.disconnect()
  connection = null
  adapter = null
  recorder = null
  // sessionId kept so the just-finished ride can still be exported.
}

export async function exportCurrentSession(): Promise<void> {
  if (!sessionId) throw new Error('no session to export')
  await exportSession(sessionId)
}

export async function listPastSessions(): Promise<SessionMeta[]> {
  return listSessions()
}

export async function exportPastSession(id: string): Promise<void> {
  await exportSession(id)
}

export async function deletePastSession(id: string): Promise<void> {
  await deleteSession(id)
  if (id === sessionId) sessionId = null
}

/** Debug fallback: write a raw hex command to the device (e.g. to probe a stream trigger). */
export async function sendManualCommandHex(hex: string): Promise<void> {
  if (!adapter?.sendCommand) throw new Error('no device connected')
  const bytes = hexToBytes(hex)
  if (bytes.length === 0) throw new Error('empty command')
  await adapter.sendCommand(bytes)
  console.info('[controller] sent command', bytesToHex(bytes))
}

/**
 * Orchestration the UI drives. Owns the connect → detect → adapter → recorder wiring and the
 * session lifecycle, keeping the React layer free of BLE details. One module-level connection
 * at a time (this is a single-bike app). On reconnect the same recorder continues, so a dropout
 * is one continuous session with a gap, not a new log.
 */

import type { AdvertisementInfo, SessionMeta, TrainerAdapter } from '../types'
import { BleConnection } from '../ble/BleConnection'
import { detect } from '../ble/detect'
import { DemoAdapter } from '../demo/DemoAdapter'
import { acquireWakeLock, releaseWakeLock } from '../ble/wakeLock'
import { Recorder } from '../session/recorder'
import { exportSession, exportSessionTcx } from '../session/exporter'
import { importSessionFile } from '../session/importer'
import {
  deleteSession,
  getSamples,
  getSession,
  listSessions,
  type StoredSession,
} from '../session/db'
import { seedDemoSession as runSeedDemoSession } from '../demo/seed'
import { currentUserData } from '../profile/profile'
import type { SessionSample } from '../types'
import { useSessionStore } from '../store/useSessionStore'
import { uuid } from '../util/time'
import { t } from '../i18n/i18n'

let connection: BleConnection | null = null
let adapter: TrainerAdapter | null = null
let recorder: Recorder | null = null
let sessionId: string | null = null
let pendingAd: AdvertisementInfo | null = null
/** True while a synthetic demo session is running (no BleConnection to drive status events). */
let demo = false

const store = () => useSessionStore.getState()

/** (Re)attach an adapter to a freshly connected server. Runs on first connect and each reconnect. */
async function onReady(server: BluetoothRemoteGATTServer, device: BluetoothDevice): Promise<void> {
  const { adapter: a, services } = await detect(server, device, { getUserData: currentUserData })
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
    await logConnectContext(services)
  }

  await a.start(recorder, recorder.now)
}

/**
 * Record what we learned at connect — advertised name/uuids (if captured) and the services
 * actually present — into the session context. This is what lets us confirm, after a real ride,
 * whether a `{ services: [ICG_SERVICE] }` picker filter is safe to use (it rides along in the export).
 */
async function logConnectContext(services: string[]): Promise<void> {
  const rec = recorder
  if (!rec) return
  const ctx: Record<string, string | number> = { presentServices: services.join(',') }
  if (pendingAd) {
    ctx.advertisedName = pendingAd.name ?? ''
    ctx.advertisedUuids = pendingAd.uuids.join(',')
    if (pendingAd.rssi !== undefined) ctx.rssi = pendingAd.rssi
  }
  await rec.setContext(ctx)
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

/**
 * Start a synthetic session with no hardware — a fake bike streaming a realistic ride. Runs the
 * same detect-less path onto the real recorder + store, so every UI surface and the export behave
 * exactly as with a bike. Reuses {@link disconnect} to tear down. For UI work off the bike.
 */
export async function connectDemo(): Promise<void> {
  if (connection || adapter) return
  demo = true
  pendingAd = null
  store().setStatus('connecting')
  try {
    const a = new DemoAdapter()
    adapter = a
    store().setDevice(a.deviceInfo(), a.protocol)
    const meta: SessionMeta = {
      id: uuid(),
      startedAtWall: Date.now(),
      device: a.deviceInfo(),
      protocol: a.protocol,
    }
    recorder = new Recorder(meta)
    sessionId = meta.id
    await recorder.init()
    await recorder.setContext({ demo: 1 })
    await a.start(recorder, recorder.now)
    store().setStatus('connected')
  } catch (e) {
    demo = false
    adapter = null
    recorder = null
    store().setStatus('error', e instanceof Error ? e.message : String(e))
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
  // A demo has no BleConnection to fire a disconnect event, so settle the status here.
  if (demo) {
    demo = false
    store().setStatus('idle')
  }
  // sessionId kept so the just-finished ride can still be exported.
}

export async function exportCurrentSession(): Promise<void> {
  if (!sessionId) throw new Error(t('error.noSessionToExport'))
  await exportSession(sessionId)
}

export async function exportCurrentSessionTcx(): Promise<void> {
  if (!sessionId) throw new Error(t('error.noSessionToExport'))
  await exportSessionTcx(sessionId)
}

export async function exportPastSessionTcx(id: string): Promise<void> {
  await exportSessionTcx(id)
}

/** Import a SessionFile JSON (as text) into IndexedDB; returns the imported session id. */
export async function importSession(text: string): Promise<string> {
  return importSessionFile(text)
}

export async function listPastSessions(): Promise<StoredSession[]> {
  return listSessions()
}

export async function exportPastSession(id: string): Promise<void> {
  await exportSession(id)
}

export async function deletePastSession(id: string): Promise<void> {
  await deleteSession(id)
  if (id === sessionId) sessionId = null
}

/** Generate a finished demo ride into IndexedDB (to populate/exercise the history UI). */
export async function seedDemoSession(minutes = 45): Promise<string> {
  return runSeedDemoSession(minutes)
}

export interface SessionDetail {
  session: StoredSession
  samples: SessionSample[]
}

/** Load a past session's metadata + full sample series for review. */
export async function loadSessionDetail(id: string): Promise<SessionDetail> {
  const session = await getSession(id)
  if (!session) throw new Error(t('error.sessionNotFound', { id }))
  const samples = await getSamples(id)
  return { session, samples }
}

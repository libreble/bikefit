/**
 * IndexedDB persistence — the crash-safe black box. As a session runs we write the decoded LIVE
 * time series here (~1 Hz), so a ride survives a reload/crash and can be reviewed later. Thin
 * wrapper over `idb`; no business logic. (v2 dropped the raw-frame/message logs — see DECISIONS.md.)
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { SessionMeta, SessionSample, SessionSummary } from '../types'

export type StoredSession = SessionMeta & {
  summary?: SessionSummary
  /** The bike's final AGGREGATED_STREAM totals (IF/TSS/time-in-zone/…), latest snapshot only. */
  aggregated?: Record<string, number | number[]>
}
export type StoredSample = SessionSample & { sessionId: string; seq: number }

interface BikefitDB extends DBSchema {
  sessions: { key: string; value: StoredSession }
  samples: { key: [string, number]; value: StoredSample; indexes: { bySession: string } }
}

const DB_NAME = 'bikefit'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<BikefitDB>> | null = null

function getDb(): Promise<IDBPDatabase<BikefitDB>> {
  dbPromise ??= openDB<BikefitDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('sessions', { keyPath: 'id' })
      }
      if (oldVersion < 2) {
        // Drop the v1 raw-frame/message logs; add the decoded time series.
        const legacy = db as unknown as IDBPDatabase
        for (const name of ['frames', 'messages']) {
          if (legacy.objectStoreNames.contains(name)) legacy.deleteObjectStore(name)
        }
        const samples = db.createObjectStore('samples', { keyPath: ['sessionId', 'seq'] })
        samples.createIndex('bySession', 'sessionId')
      }
    },
  })
  return dbPromise
}

export async function putSession(session: StoredSession): Promise<void> {
  const db = await getDb()
  await db.put('sessions', session)
}

export async function getSession(id: string): Promise<StoredSession | undefined> {
  const db = await getDb()
  return db.get('sessions', id)
}

/** Newest first. */
export async function listSessions(): Promise<StoredSession[]> {
  const db = await getDb()
  const all = await db.getAll('sessions')
  return all.sort((a, b) => b.startedAtWall - a.startedAtWall)
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['sessions', 'samples'], 'readwrite')
  await tx.objectStore('sessions').delete(id)
  const idx = tx.objectStore('samples').index('bySession')
  let cursor = await idx.openCursor(id)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function addSample(sample: StoredSample): Promise<void> {
  const db = await getDb()
  await db.put('samples', sample)
}

/** Bulk-write samples in one transaction (used to seed a whole demo ride at once). */
export async function addSamples(rows: StoredSample[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('samples', 'readwrite')
  await Promise.all([...rows.map((r) => tx.store.put(r)), tx.done])
}

/** The session's decoded time series, in order. */
export async function getSamples(sessionId: string): Promise<SessionSample[]> {
  const db = await getDb()
  const rows = await db.getAllFromIndex('samples', 'bySession', sessionId)
  rows.sort((a, b) => a.seq - b.seq)
  // Strip storage-only keys back to the SessionSample shape.
  return rows.map(({ sessionId: _sid, seq: _seq, ...s }) => s)
}

/**
 * IndexedDB persistence — the crash-safe black box. Every raw notification is written here as
 * it arrives, so a session survives a reload/crash and can be re-parsed later even if our
 * decode was wrong. Thin wrapper over `idb`; no business logic.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { DecodedMessage, RawFrame, SessionMeta, SessionSummary } from '../types'

export type StoredSession = SessionMeta & { summary?: SessionSummary }
export type StoredFrame = RawFrame & { sessionId: string }
export type StoredMessage = DecodedMessage & { sessionId: string; seq: number }

interface BikefitDB extends DBSchema {
  sessions: { key: string; value: StoredSession }
  frames: { key: [string, number]; value: StoredFrame; indexes: { bySession: string } }
  messages: { key: [string, number]; value: StoredMessage; indexes: { bySession: string } }
}

const DB_NAME = 'bikefit'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<BikefitDB>> | null = null

function getDb(): Promise<IDBPDatabase<BikefitDB>> {
  dbPromise ??= openDB<BikefitDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('sessions', { keyPath: 'id' })
      const frames = db.createObjectStore('frames', { keyPath: ['sessionId', 'seq'] })
      frames.createIndex('bySession', 'sessionId')
      const messages = db.createObjectStore('messages', { keyPath: ['sessionId', 'seq'] })
      messages.createIndex('bySession', 'sessionId')
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
  const tx = db.transaction(['sessions', 'frames', 'messages'], 'readwrite')
  await tx.objectStore('sessions').delete(id)
  for (const store of ['frames', 'messages'] as const) {
    const idx = tx.objectStore(store).index('bySession')
    let cursor = await idx.openCursor(id)
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
  }
  await tx.done
}

export async function addFrame(frame: StoredFrame): Promise<void> {
  const db = await getDb()
  await db.put('frames', frame)
}

export async function getFrames(sessionId: string): Promise<RawFrame[]> {
  const db = await getDb()
  const rows = await db.getAllFromIndex('frames', 'bySession', sessionId)
  rows.sort((a, b) => a.seq - b.seq)
  return rows.map(({ seq, t, src, hex }) => ({ seq, t, src, hex }))
}

export async function addMessage(message: StoredMessage): Promise<void> {
  const db = await getDb()
  await db.put('messages', message)
}

export async function getMessages(sessionId: string): Promise<DecodedMessage[]> {
  const db = await getDb()
  const rows = await db.getAllFromIndex('messages', 'bySession', sessionId)
  rows.sort((a, b) => a.seq - b.seq)
  // Strip storage-only keys back to the DecodedMessage shape.
  return rows.map(({ sessionId: _sid, seq: _seq, ...msg }) => msg)
}

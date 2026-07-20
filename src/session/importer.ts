/**
 * Import a previously-exported SessionFile JSON back into IndexedDB — round-trips our own export,
 * and pairs with seeding to populate history. Accepts v2 files only (the current schema); older
 * raw-frame exports aren't supported. Keeps the original session id so re-importing overwrites
 * rather than duplicating.
 */

import type { SessionFile, SessionSample } from '../types'
import { uuid } from '../util/time'
import { addSamples, putSession, type StoredSample, type StoredSession } from './db'

function isSessionFile(v: unknown): v is SessionFile {
  if (typeof v !== 'object' || v === null) return false
  const f = v as Partial<SessionFile>
  return (
    f.version === 2 &&
    typeof f.session === 'object' &&
    f.session !== null &&
    typeof f.summary === 'object' &&
    f.summary !== null &&
    Array.isArray(f.samples)
  )
}

export async function importSessionFile(text: string): Promise<string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not valid JSON.')
  }
  if (!isSessionFile(parsed)) {
    const version = (parsed as { version?: unknown } | null)?.version
    throw new Error(
      version !== undefined && version !== 2
        ? `Unsupported session file (version ${String(version)}; expected 2).`
        : 'Not a Bikefit session file.',
    )
  }

  const id = parsed.session.id || uuid()
  const session: StoredSession = { ...parsed.session, id, summary: parsed.summary }
  if (parsed.aggregated) session.aggregated = parsed.aggregated
  await putSession(session)

  const rows: StoredSample[] = (parsed.samples as SessionSample[]).map((s, i) => ({
    ...s,
    sessionId: id,
    seq: i,
  }))
  await addSamples(rows)
  return id
}

/**
 * Build and save a self-contained `SessionFile` (metadata + the decoded LIVE time series + the
 * bike's final aggregated totals + summary) as one JSON document — loadable later in jq/pandas/JS
 * without the app. Saving is a plain anchor download (reliable on mobile Chrome, our gym target).
 */

import type { SessionFile, SessionSummary } from '../types'
import { getSamples, getSession } from './db'

function isoStamp(ms: number): string {
  // Filesystem-safe ISO: 2026-07-11T21-30-05
  return new Date(ms).toISOString().replace(/:/g, '-').replace(/\..+$/, '')
}

export async function buildSessionFile(sessionId: string): Promise<SessionFile> {
  const session = await getSession(sessionId)
  if (!session) throw new Error(`session ${sessionId} not found`)

  const samples = await getSamples(sessionId)

  const lastT = samples.length > 0 ? (samples[samples.length - 1]?.t ?? 0) : 0
  const summary: SessionSummary = session.summary ?? {
    samples: samples.length,
    durationS: Math.round(lastT / 1000),
  }

  const { summary: _s, aggregated, ...meta } = session
  const file: SessionFile = { version: 2, session: meta, summary, samples }
  if (aggregated) file.aggregated = aggregated
  return file
}

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so the download has grabbed the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportSession(sessionId: string): Promise<void> {
  const file = await buildSessionFile(sessionId)
  const shortId = sessionId.slice(0, 8)
  const name = `bikefit-${isoStamp(file.session.startedAtWall)}-${shortId}.json`
  download(name, JSON.stringify(file, null, 2))
}

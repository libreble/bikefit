/**
 * Build and save a self-contained `SessionFile` (metadata + the decoded LIVE time series + the
 * bike's final aggregated totals + summary) as one JSON document — loadable later in jq/pandas/JS
 * without the app. Saving is a plain anchor download (reliable on mobile Chrome, our gym target).
 */

import type { SessionFile, SessionSummary } from '../types'
import { getSamples, getSession } from './db'
import { buildTcx } from './tcx'

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

function download(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: mime })
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

function baseName(startedAtWall: number, sessionId: string): string {
  return `bikefit-${isoStamp(startedAtWall)}-${sessionId.slice(0, 8)}`
}

export async function exportSession(sessionId: string): Promise<void> {
  const file = await buildSessionFile(sessionId)
  download(`${baseName(file.session.startedAtWall, sessionId)}.json`, JSON.stringify(file, null, 2))
}

/** Export as Garmin TCX (Strava / intervals.icu / TrainingPeaks / Golden Cheetah). */
export async function exportSessionTcx(sessionId: string): Promise<void> {
  const file = await buildSessionFile(sessionId)
  download(
    `${baseName(file.session.startedAtWall, sessionId)}.tcx`,
    buildTcx(file),
    'application/vnd.garmin.tcx+xml',
  )
}

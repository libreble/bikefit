/**
 * Seed a finished demo ride straight into IndexedDB — for developing/reviewing the session-history
 * UI without needing real rides. Runs the same {@link DemoRide} the live demo bike uses, but writes
 * a complete stored session (meta + summary + the bike's final aggregated snapshot + the sample
 * series) in one shot, stamped in the recent past. FTP-relative numbers follow the saved profile.
 */

import { uuid } from '../util/time'
import { loadProfile } from '../profile/profile'
import { addSamples, putSession, type StoredSample, type StoredSession } from '../session/db'
import type { SessionSample, SessionSummary } from '../types'
import { decodeIcgAggregated } from '../decode/icgMessages'
import { DemoRide } from './ride'
import { encodeAggPayload, type AggFields } from './synthFrames'

export async function seedDemoSession(minutes = 45): Promise<string> {
  const p = loadProfile()
  const ride = new DemoRide(p?.ftpW ?? 200, p?.weightKg ?? 75, p?.maxHr ?? 185)
  const id = uuid()
  const steps = Math.max(1, Math.round(minutes * 60))
  const endedAtWall = Date.now()
  const startedAtWall = endedAtWall - steps * 1000

  const samples: StoredSample[] = []
  let sumP = 0
  let nP = 0
  let maxP = 0
  let sumC = 0
  let nC = 0
  let maxC = 0
  let sumH = 0
  let nH = 0
  let maxH = 0
  let maxDist = 0
  let maxKcal = 0
  let lastAgg: AggFields | undefined

  for (let i = 0; i < steps; i++) {
    const { live, agg } = ride.step(1)
    lastAgg = agg
    const sample: SessionSample = {
      t: (i + 1) * 1000,
      powerW: live.power,
      cadenceRpm: live.cadence,
      speedKmh: live.speedKmh,
      resistance: live.brakeLevel,
      distanceKm: live.distanceKm,
      energyKcal: live.calories,
      elapsedS: live.workoutTime,
    }
    if (live.heartRate > 0) sample.bpm = live.heartRate
    samples.push({ ...sample, sessionId: id, seq: i })

    sumP += live.power
    nP++
    maxP = Math.max(maxP, live.power)
    sumC += live.cadence
    nC++
    maxC = Math.max(maxC, live.cadence)
    if (live.heartRate > 0) {
      sumH += live.heartRate
      nH++
      maxH = Math.max(maxH, live.heartRate)
    }
    maxDist = Math.max(maxDist, live.distanceKm)
    maxKcal = Math.max(maxKcal, live.calories)
  }

  const summary: SessionSummary = { samples: steps, durationS: steps }
  if (nP > 0) {
    summary.avgPowerW = Math.round(sumP / nP)
    summary.maxPowerW = maxP
  }
  if (nC > 0) {
    summary.avgCadenceRpm = Math.round(sumC / nC)
    summary.maxCadenceRpm = maxC
  }
  if (nH > 0) {
    summary.avgBpm = Math.round(sumH / nH)
    summary.maxBpm = maxH
  }
  if (maxDist > 0) summary.distanceKm = Math.round(maxDist * 100) / 100
  if (maxKcal > 0) summary.energyKcal = maxKcal

  // Represent the final totals exactly as a live session would store them (decoder round-trip).
  const aggregated = lastAgg ? decodeIcgAggregated(encodeAggPayload(lastAgg)) : undefined

  const session: StoredSession = {
    id,
    startedAtWall,
    endedAtWall,
    device: { name: 'DEMO BIKE', id: 'demo', model: 'IC6 (demo)' },
    protocol: 'icg',
    context: { demo: 1, seeded: 1 },
    summary,
  }
  if (aggregated) session.aggregated = aggregated

  await putSession(session)
  await addSamples(samples)
  return id
}

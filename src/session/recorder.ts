/**
 * Recorder — the sink an adapter pushes into. It (a) persists the decoded LIVE time series to
 * IndexedDB (~1 Hz), (b) mirrors samples into the live store for the dashboard, (c) keeps the
 * bike's latest AGGREGATED totals snapshot (not the full 1 Hz repeat), and (d) accumulates our own
 * summary. It owns the session clock so every timestamp shares one base.
 */

import type {
  AdapterEvents,
  DecodedMessage,
  NormalizedSample,
  SessionMeta,
  SessionSummary,
} from '../types'
import { useSessionStore } from '../store/useSessionStore'
import { addSample, putSession, type StoredSession } from './db'

class Accumulator {
  private sumP = 0
  private nP = 0
  private maxP = 0
  private sumC = 0
  private nC = 0
  private maxC = 0
  private sumH = 0
  private nH = 0
  private maxH = 0
  private distanceKm = 0
  private energyKcal = 0

  add(s: NormalizedSample): void {
    if (s.powerW !== undefined) {
      this.sumP += s.powerW
      this.nP++
      this.maxP = Math.max(this.maxP, s.powerW)
    }
    if (s.cadenceRpm !== undefined) {
      this.sumC += s.cadenceRpm
      this.nC++
      this.maxC = Math.max(this.maxC, s.cadenceRpm)
    }
    if (s.bpm !== undefined) {
      this.sumH += s.bpm
      this.nH++
      this.maxH = Math.max(this.maxH, s.bpm)
    }
    // Distance/energy are cumulative on the bike — keep the largest seen.
    if (s.distanceKm !== undefined) this.distanceKm = Math.max(this.distanceKm, s.distanceKm)
    if (s.energyKcal !== undefined) this.energyKcal = Math.max(this.energyKcal, s.energyKcal)
  }

  summary(samples: number, durationS: number): SessionSummary {
    const out: SessionSummary = { samples, durationS: Math.round(durationS) }
    if (this.nP > 0) {
      out.avgPowerW = Math.round(this.sumP / this.nP)
      out.maxPowerW = this.maxP
    }
    if (this.nC > 0) {
      out.avgCadenceRpm = Math.round(this.sumC / this.nC)
      out.maxCadenceRpm = this.maxC
    }
    if (this.nH > 0) {
      out.avgBpm = Math.round(this.sumH / this.nH)
      out.maxBpm = this.maxH
    }
    if (this.distanceKm > 0) out.distanceKm = this.distanceKm
    if (this.energyKcal > 0) out.energyKcal = this.energyKcal
    return out
  }
}

export class Recorder implements AdapterEvents {
  private seq = 0
  private lastT = 0
  private readonly startMs = performance.now()
  private readonly acc = new Accumulator()
  private readonly meta: SessionMeta
  /** Latest AGGREGATED_STREAM totals from the bike — kept, not the full 1 Hz history. */
  private aggregated: Record<string, number | number[]> | undefined

  constructor(meta: SessionMeta) {
    this.meta = meta
  }

  /** ms since session start — passed to the adapter so all timestamps share this base. */
  readonly now = (): number => performance.now() - this.startMs

  /** Create the session row and flip the store into recording mode. */
  async init(): Promise<void> {
    await putSession(this.meta)
    useSessionStore.getState().startSession(this.meta.id, this.meta.startedAtWall)
  }

  /** Merge static connect-time context (advertised name/uuids, present services) and persist it. */
  async setContext(context: Record<string, string | number>): Promise<void> {
    this.meta.context = { ...this.meta.context, ...context }
    await putSession(this.meta)
  }

  onMessage(m: DecodedMessage): void {
    // Keep only the latest session-totals snapshot; the bike resends full totals ~1×/s.
    if (m.aggregate && m.fields) this.aggregated = m.fields
  }

  onSample(s: NormalizedSample): void {
    const t = s.t
    this.lastT = t
    this.acc.add(s)
    useSessionStore.getState().pushSample(s)
    void addSample({
      sessionId: this.meta.id,
      seq: this.seq++,
      t,
      powerW: s.powerW,
      cadenceRpm: s.cadenceRpm,
      bpm: s.bpm,
      speedKmh: s.speedKmh,
      resistance: s.resistance,
      distanceKm: s.distanceKm,
      energyKcal: s.energyKcal,
      elapsedS: s.elapsedS,
    }).catch((e) => console.error('[recorder] addSample failed', e))
  }

  /** Persist end time + summary + the bike's final totals; leave store data in place for review. */
  async finalize(): Promise<void> {
    const summary = this.acc.summary(this.seq, this.lastT / 1000)
    const stored: StoredSession = { ...this.meta, endedAtWall: Date.now(), summary }
    if (this.aggregated) stored.aggregated = this.aggregated
    await putSession(stored)
    useSessionStore.getState().stopSession()
  }
}

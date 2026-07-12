/**
 * Recorder — the sink an adapter pushes into. It (a) persists every raw notification to
 * IndexedDB losslessly, (b) mirrors decoded messages + normalized samples into the live store,
 * and (c) accumulates a summary. It owns the session clock so every timestamp shares one base.
 */

import type {
  AdapterEvents,
  DecodedMessage,
  NormalizedSample,
  SampleSource,
  SessionMeta,
  SessionSummary,
} from '../types'
import { useSessionStore } from '../store/useSessionStore'
import { addFrame, addMessage, putSession } from './db'

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

  summary(frames: number, durationS: number): SessionSummary {
    const out: SessionSummary = { frames, durationS: Math.round(durationS) }
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
  private mseq = 0
  private lastT = 0
  private readonly startMs = performance.now()
  private readonly src: SampleSource
  private readonly acc = new Accumulator()
  private readonly meta: SessionMeta

  constructor(meta: SessionMeta) {
    this.meta = meta
    this.src = meta.protocol ?? 'icg'
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

  onRaw(hex: string): void {
    const t = this.now()
    this.lastT = t
    void addFrame({ sessionId: this.meta.id, seq: this.seq++, t, src: this.src, hex }).catch((e) =>
      console.error('[recorder] addFrame failed', e),
    )
    useSessionStore.getState().countRaw()
  }

  onMessage(m: DecodedMessage): void {
    useSessionStore.getState().pushMessage(m)
    void addMessage({ ...m, sessionId: this.meta.id, seq: this.mseq++ }).catch((e) =>
      console.error('[recorder] addMessage failed', e),
    )
  }

  onSample(s: NormalizedSample): void {
    this.acc.add(s)
    useSessionStore.getState().pushSample(s)
  }

  /** Persist end time + computed summary; leave the store's data in place for review/export. */
  async finalize(): Promise<void> {
    const summary = this.acc.summary(this.seq, this.lastT / 1000)
    await putSession({ ...this.meta, endedAtWall: Date.now(), summary })
    useSessionStore.getState().stopSession()
  }
}

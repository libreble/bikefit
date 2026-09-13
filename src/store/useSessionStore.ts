import { create } from 'zustand'
import type { DeviceInfo, NormalizedSample, SampleSource } from '../types'

/** Points kept in memory for the live graphs (full-resolution data lives in IndexedDB). */
const HISTORY_MAX = 1800

export type ConnStatus =
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

/** One plotted point — a snapshot of the merged live values at time `t`. */
export interface HistoryPoint {
  t: number
  powerW?: number
  cadenceRpm?: number
  bpm?: number
  speedKmh?: number
}

/** Session-long running averages of the instantaneous metrics (for the hero tile's avg + trend). */
export interface LiveAverages {
  powerW?: number
  cadenceRpm?: number
  bpm?: number
  speedKmh?: number
}

interface SessionState {
  // connection
  status: ConnStatus
  device?: DeviceInfo
  protocol?: SampleSource
  error?: string

  // session
  sessionId?: string
  recording: boolean
  startedAtWall?: number

  // live
  latest: NormalizedSample
  history: HistoryPoint[]
  avg: LiveAverages

  // actions
  setStatus: (status: ConnStatus, error?: string) => void
  setDevice: (device: DeviceInfo, protocol: SampleSource) => void
  startSession: (sessionId: string, startedAtWall: number) => void
  stopSession: () => void
  pushSample: (s: NormalizedSample) => void
  reset: () => void
}

const EMPTY_SAMPLE: NormalizedSample = { t: 0, src: 'icg' }

/** Running sums for session-long averages — kept out of the state shape, reset per session. */
const runAvg = { sumP: 0, nP: 0, sumC: 0, nC: 0, sumH: 0, nH: 0, sumS: 0, nS: 0 }
function resetAvg(): void {
  runAvg.sumP = runAvg.nP = runAvg.sumC = runAvg.nC = 0
  runAvg.sumH = runAvg.nH = runAvg.sumS = runAvg.nS = 0
}
function nextAvg(s: NormalizedSample): LiveAverages {
  if (s.powerW !== undefined) {
    runAvg.sumP += s.powerW
    runAvg.nP++
  }
  if (s.cadenceRpm !== undefined) {
    runAvg.sumC += s.cadenceRpm
    runAvg.nC++
  }
  if (s.bpm !== undefined) {
    runAvg.sumH += s.bpm
    runAvg.nH++
  }
  if (s.speedKmh !== undefined) {
    runAvg.sumS += s.speedKmh
    runAvg.nS++
  }
  const out: LiveAverages = {}
  if (runAvg.nP > 0) out.powerW = Math.round(runAvg.sumP / runAvg.nP)
  if (runAvg.nC > 0) out.cadenceRpm = Math.round(runAvg.sumC / runAvg.nC)
  if (runAvg.nH > 0) out.bpm = Math.round(runAvg.sumH / runAvg.nH)
  if (runAvg.nS > 0) out.speedKmh = Math.round((runAvg.sumS / runAvg.nS) * 10) / 10
  return out
}

/** Carry-forward merge so a sparse update (e.g. HR-only) doesn't blank other tiles. */
function mergeSample(prev: NormalizedSample, s: NormalizedSample): NormalizedSample {
  return {
    t: s.t,
    src: s.src,
    powerW: s.powerW ?? prev.powerW,
    cadenceRpm: s.cadenceRpm ?? prev.cadenceRpm,
    speedKmh: s.speedKmh ?? prev.speedKmh,
    bpm: s.bpm ?? prev.bpm,
    rrIntervalsMs: s.rrIntervalsMs ?? prev.rrIntervalsMs,
    resistance: s.resistance ?? prev.resistance,
    distanceKm: s.distanceKm ?? prev.distanceKm,
    energyKcal: s.energyKcal ?? prev.energyKcal,
    elapsedS: s.elapsedS ?? prev.elapsedS,
    extra: s.extra ? { ...prev.extra, ...s.extra } : prev.extra,
  }
}

export const useSessionStore = create<SessionState>()((set) => ({
  status: 'idle',
  recording: false,
  latest: EMPTY_SAMPLE,
  history: [],
  avg: {},

  setStatus: (status, error) => set(error === undefined ? { status } : { status, error }),

  setDevice: (device, protocol) => set({ device, protocol }),

  startSession: (sessionId, startedAtWall) => {
    resetAvg()
    set({
      sessionId,
      startedAtWall,
      recording: true,
      latest: EMPTY_SAMPLE,
      history: [],
      avg: {},
    })
  },

  stopSession: () => set({ recording: false }),

  pushSample: (s) =>
    set((state) => {
      const latest = mergeSample(state.latest, s)
      const point: HistoryPoint = {
        t: latest.t,
        powerW: latest.powerW,
        cadenceRpm: latest.cadenceRpm,
        bpm: latest.bpm,
        speedKmh: latest.speedKmh,
      }
      const history =
        state.history.length >= HISTORY_MAX
          ? [...state.history.slice(state.history.length - HISTORY_MAX + 1), point]
          : [...state.history, point]
      return { latest, history, avg: nextAvg(s) }
    }),

  reset: () => {
    resetAvg()
    set({
      status: 'idle',
      recording: false,
      latest: EMPTY_SAMPLE,
      history: [],
      avg: {},
      sessionId: undefined,
      device: undefined,
      protocol: undefined,
      error: undefined,
      startedAtWall: undefined,
    })
  },
}))

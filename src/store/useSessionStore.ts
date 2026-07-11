import { create } from 'zustand'
import type { DecodedMessage, DeviceInfo, NormalizedSample, SampleSource } from '../types'

/** Points kept in memory for the live graphs (full-resolution data lives in IndexedDB). */
const HISTORY_MAX = 1800
/** Recent decoded messages kept for the debug panel. */
const MESSAGES_MAX = 250

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
  frameCount: number

  // live
  latest: NormalizedSample
  history: HistoryPoint[]
  messages: DecodedMessage[]

  // actions
  setStatus: (status: ConnStatus, error?: string) => void
  setDevice: (device: DeviceInfo, protocol: SampleSource) => void
  startSession: (sessionId: string, startedAtWall: number) => void
  stopSession: () => void
  pushSample: (s: NormalizedSample) => void
  pushMessage: (m: DecodedMessage) => void
  countRaw: () => void
  reset: () => void
}

const EMPTY_SAMPLE: NormalizedSample = { t: 0, src: 'icg' }

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
  frameCount: 0,
  latest: EMPTY_SAMPLE,
  history: [],
  messages: [],

  setStatus: (status, error) => set(error === undefined ? { status } : { status, error }),

  setDevice: (device, protocol) => set({ device, protocol }),

  startSession: (sessionId, startedAtWall) =>
    set({
      sessionId,
      startedAtWall,
      recording: true,
      frameCount: 0,
      latest: EMPTY_SAMPLE,
      history: [],
      messages: [],
    }),

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
      return { latest, history }
    }),

  pushMessage: (m) =>
    set((state) => {
      const messages =
        state.messages.length >= MESSAGES_MAX
          ? [...state.messages.slice(state.messages.length - MESSAGES_MAX + 1), m]
          : [...state.messages, m]
      return { messages }
    }),

  countRaw: () => set((state) => ({ frameCount: state.frameCount + 1 })),

  reset: () =>
    set({
      status: 'idle',
      recording: false,
      frameCount: 0,
      latest: EMPTY_SAMPLE,
      history: [],
      messages: [],
      sessionId: undefined,
      device: undefined,
      protocol: undefined,
      error: undefined,
      startedAtWall: undefined,
    }),
}))

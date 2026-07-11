/**
 * Stacked live sparklines fed from the store's `history` buffer. Each series maps the history
 * points to a plain number[], dropping undefined samples (a sparse HR stream shouldn't punch
 * holes in its own trend line).
 */
import { useSessionStore } from '../store/useSessionStore'
import type { HistoryPoint } from '../store/useSessionStore'
import { Sparkline } from './Sparkline'

/** Pull one numeric field out of the history, keeping only points that actually have it. */
function series(history: HistoryPoint[], pick: (p: HistoryPoint) => number | undefined): number[] {
  const out: number[] = []
  for (const p of history) {
    const v = pick(p)
    if (v !== undefined) out.push(v)
  }
  return out
}

export function Graphs() {
  const history = useSessionStore((s) => s.history)

  const power = series(history, (p) => p.powerW)
  const bpm = series(history, (p) => p.bpm)
  const cadence = series(history, (p) => p.cadenceRpm)

  return (
    <section className="graphs" aria-label="Trends">
      <Sparkline points={power} color="var(--accent)" label="Power" unit="W" />
      <Sparkline points={bpm} color="var(--hr)" label="Heart rate" unit="bpm" />
      <Sparkline points={cadence} color="var(--cadence)" label="Cadence" unit="rpm" />
    </section>
  )
}

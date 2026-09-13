/**
 * Stacked live sparklines fed from the store's `history` buffer. Each series maps the history
 * points to a plain number[], dropping undefined samples (a sparse HR stream shouldn't punch
 * holes in its own trend line).
 */
import { useSessionStore } from '../store/useSessionStore'
import type { HistoryPoint } from '../store/useSessionStore'
import { Sparkline } from './Sparkline'
import { useT } from '../i18n/i18n'

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
  const t = useT()
  const history = useSessionStore((s) => s.history)

  const power = series(history, (p) => p.powerW)
  const bpm = series(history, (p) => p.bpm)
  const cadence = series(history, (p) => p.cadenceRpm)

  return (
    <section className="graphs" aria-label={t('graphs.label')}>
      <Sparkline
        points={power}
        color="var(--accent)"
        label={t('metric.power')}
        unit="W"
        ariaLabel={t('spark.trend', { name: t('metric.power') })}
      />
      <Sparkline
        points={bpm}
        color="var(--hr)"
        label={t('metric.hr')}
        unit="bpm"
        ariaLabel={t('spark.trend', { name: t('metric.hr') })}
      />
      <Sparkline
        points={cadence}
        color="var(--cadence)"
        label={t('metric.cadence')}
        unit="rpm"
        ariaLabel={t('spark.trend', { name: t('metric.cadence') })}
      />
    </section>
  )
}

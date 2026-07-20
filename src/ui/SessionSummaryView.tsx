/**
 * Presentational summary of a stored session: the stat grid (duration, avg/max power/HR/cadence,
 * distance, energy, and the bike's IF/TSS when present) plus sparklines rebuilt from the sample
 * series. Pure — takes the loaded session + samples; the detail page owns loading/actions.
 */
import type { StoredSession } from '../session/db'
import type { SessionSample } from '../types'
import { Sparkline } from './Sparkline'
import { formatDuration } from '../util/time'
import { useT } from '../i18n/i18n'

function series(samples: SessionSample[], f: (s: SessionSample) => number | undefined): number[] {
  const out: number[] = []
  for (const s of samples) {
    const v = f(s)
    if (v !== undefined) out.push(v)
  }
  return out
}

/** The aggregated snapshot stores number | number[]; pull a scalar or undefined. */
function num(v: number | number[] | undefined): number | undefined {
  return typeof v === 'number' ? v : undefined
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

export function SessionSummaryView({
  session,
  samples,
}: {
  session: StoredSession
  samples: SessionSample[]
}) {
  const t = useT()
  const summary = session.summary
  const agg = session.aggregated
  const fmt = (v: number | undefined, digits = 0, suffix = ''): string =>
    v === undefined ? '—' : `${v.toFixed(digits)}${suffix}`
  const iff = num(agg?.['intensityFactor'])
  const tss = num(agg?.['trainingStressScore'])

  return (
    <>
      <div className="stats">
        <Stat
          label={t('stat.duration')}
          value={summary ? formatDuration(summary.durationS) : '—'}
        />
        <Stat label={t('stat.avgPower')} value={fmt(summary?.avgPowerW, 0, ' W')} />
        <Stat label={t('stat.maxPower')} value={fmt(summary?.maxPowerW, 0, ' W')} />
        <Stat label={t('stat.avgHr')} value={fmt(summary?.avgBpm, 0, ' bpm')} />
        <Stat label={t('stat.maxHr')} value={fmt(summary?.maxBpm, 0, ' bpm')} />
        <Stat label={t('stat.avgCadence')} value={fmt(summary?.avgCadenceRpm, 0, ' rpm')} />
        <Stat label={t('stat.distance')} value={fmt(summary?.distanceKm, 2, ' km')} />
        <Stat label={t('stat.energy')} value={fmt(summary?.energyKcal, 0, ' kcal')} />
        {iff !== undefined && <Stat label={t('stat.if')} value={iff.toFixed(2)} />}
        {tss !== undefined && <Stat label={t('stat.tss')} value={tss.toFixed(0)} />}
      </div>

      <div className="review-graphs">
        <Sparkline
          points={series(samples, (s) => s.powerW)}
          color="var(--accent)"
          label={t('metric.power')}
          unit="W"
          ariaLabel={t('spark.trend', { name: t('metric.power') })}
        />
        <Sparkline
          points={series(samples, (s) => s.bpm)}
          color="var(--hr)"
          label={t('metric.hr')}
          unit="bpm"
          ariaLabel={t('spark.trend', { name: t('metric.hr') })}
        />
        <Sparkline
          points={series(samples, (s) => s.cadenceRpm)}
          color="var(--cadence)"
          label={t('metric.cadence')}
          unit="rpm"
          ariaLabel={t('spark.trend', { name: t('metric.cadence') })}
        />
      </div>
    </>
  )
}

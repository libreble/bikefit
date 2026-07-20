/**
 * Arm's-length-legible live readouts from `latest`, laid out by the rider's dashboard prefs: the
 * first visible metric is the hero tile (with its session average + an above/below-average trend
 * arrow), the next few fill the primary row, the rest the small row. Undefined metrics render as
 * "—" (never a fake 0 — important for HR, which must not read 0 when absent).
 */
import type { CSSProperties, ReactNode } from 'react'
import { useSessionStore } from '../store/useSessionStore'
import type { LiveAverages } from '../store/useSessionStore'
import type { NormalizedSample } from '../types'
import { METRICS, visibleMetrics, type DashboardPrefs, type MetricKey } from '../prefs/dashboard'
import { formatDuration } from '../util/time'

type Variant = 'hero' | 'primary' | 'small'

interface TileProps {
  label: string
  value: string
  unit?: string
  accent?: string
  variant: Variant
  sub?: ReactNode
}

function Tile({ label, value, unit, accent, variant, sub }: TileProps) {
  return (
    <div
      className={`tile tile-${variant}`}
      style={accent !== undefined ? ({ '--tile-accent': accent } as CSSProperties) : undefined}
    >
      <div className="tile-label">{label}</div>
      <div className="tile-value">
        <span className="tile-number">{value}</span>
        {unit !== undefined && <span className="tile-unit">{unit}</span>}
      </div>
      {sub !== undefined && <div className="tile-sub">{sub}</div>}
    </div>
  )
}

/** Above/below-average arrow with a small deadband so it doesn't flicker around the mean. */
function Trend({ value, avg }: { value?: number; avg?: number }) {
  if (value === undefined || avg === undefined) return null
  const band = Math.max(5, avg * 0.03)
  const dir = value > avg + band ? 'up' : value < avg - band ? 'down' : 'flat'
  const char = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '▪'
  const label = dir === 'up' ? 'above average' : dir === 'down' ? 'below average' : 'at average'
  return (
    <span className={`trend trend--${dir}`} aria-label={label}>
      {char}
    </span>
  )
}

/** Live value for a metric out of the merged `latest` sample. */
function valueOf(key: MetricKey, l: NormalizedSample): number | undefined {
  switch (key) {
    case 'power':
      return l.powerW
    case 'cadence':
      return l.cadenceRpm
    case 'hr':
      return l.bpm
    case 'speed':
      return l.speedKmh
    case 'resistance':
      return l.resistance
    case 'distance':
      return l.distanceKm
    case 'calories':
      return l.energyKcal
    case 'elapsed':
      return l.elapsedS
  }
}

/** Session average for a metric, when we track one (the instantaneous metrics only). */
function avgOf(key: MetricKey, a: LiveAverages): number | undefined {
  switch (key) {
    case 'power':
      return a.powerW
    case 'cadence':
      return a.cadenceRpm
    case 'hr':
      return a.bpm
    case 'speed':
      return a.speedKmh
    default:
      return undefined
  }
}

function fmt(key: MetricKey, v: number | undefined): string {
  if (v === undefined) return '—'
  if (METRICS[key].isTime) return formatDuration(v)
  return v.toFixed(METRICS[key].digits)
}

export function LiveTiles({ prefs }: { prefs: DashboardPrefs }) {
  const latest = useSessionStore((s) => s.latest)
  const avg = useSessionStore((s) => s.avg)

  const order = visibleMetrics(prefs)
  if (order.length === 0) return null
  const heroKey = order[0] as MetricKey
  const primary = order.slice(1, 4)
  const small = order.slice(4)

  const heroMeta = METRICS[heroKey]
  const heroValue = valueOf(heroKey, latest)
  const heroAvg = avgOf(heroKey, avg)
  const heroSub =
    heroAvg !== undefined ? (
      <>
        <span className="tile-avg">
          avg {fmt(heroKey, heroAvg)}
          {heroMeta.unit !== undefined && ` ${heroMeta.unit}`}
        </span>
        <Trend value={heroValue} avg={heroAvg} />
      </>
    ) : undefined

  return (
    <section className="tiles" aria-label="Live metrics">
      <Tile
        label={heroMeta.label}
        value={fmt(heroKey, heroValue)}
        unit={heroMeta.unit}
        accent={heroMeta.accent ?? 'var(--accent)'}
        variant="hero"
        sub={heroSub}
      />

      {primary.length > 0 && (
        <div className="tile-row tile-row-primary">
          {primary.map((key) => (
            <Tile
              key={key}
              label={METRICS[key].label}
              value={fmt(key, valueOf(key, latest))}
              unit={METRICS[key].unit}
              accent={METRICS[key].accent}
              variant="primary"
            />
          ))}
        </div>
      )}

      {small.length > 0 && (
        <div className="tile-row tile-row-small">
          {small.map((key) => (
            <Tile
              key={key}
              label={METRICS[key].label}
              value={fmt(key, valueOf(key, latest))}
              unit={METRICS[key].unit}
              variant="small"
            />
          ))}
        </div>
      )}
    </section>
  )
}

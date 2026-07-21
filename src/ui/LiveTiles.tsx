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
import { HR_ZONES, hrZoneIndex } from '../hr/zones'
import { formatDuration } from '../util/time'
import { useT, type TFunc } from '../i18n/i18n'

type Variant = 'hero' | 'primary' | 'small'

/** A coloured "Z3" chip pinned to a tile's label row (HR only, when a zone is known). */
interface ZoneBadge {
  text: string
  color: string
  ariaLabel: string
}

interface TileProps {
  label: string
  value: string
  unit?: string
  accent?: string
  variant: Variant
  sub?: ReactNode
  badge?: ZoneBadge
}

function Tile({ label, value, unit, accent, variant, sub, badge }: TileProps) {
  return (
    <div
      className={`tile tile-${variant}`}
      style={accent !== undefined ? ({ '--tile-accent': accent } as CSSProperties) : undefined}
    >
      <div className="tile-head">
        <span className="tile-label">{label}</span>
      </div>
      <div className="tile-value">
        <span className="tile-number">{value}</span>
        {(unit !== undefined || badge !== undefined) && (
          <span className="tile-meta">
            {unit !== undefined && <span className="tile-unit">{unit}</span>}
            {badge !== undefined && (
              <span
                className="tile-zone"
                style={{ '--zone-color': badge.color } as CSSProperties}
                aria-label={badge.ariaLabel}
              >
                {badge.text}
              </span>
            )}
          </span>
        )}
      </div>
      {sub !== undefined && <div className="tile-sub">{sub}</div>}
    </div>
  )
}

/** For the HR tile only: the current zone's colour (to tint the tile) and its "Zx" badge. `null`
 * for every other metric, or when HR/HRmax is unknown so nothing zone-related should show. */
function hrZone(
  key: MetricKey,
  latest: NormalizedSample,
  maxHr: number | undefined,
  t: TFunc,
): { color: string; badge: ZoneBadge } | null {
  if (key !== 'hr') return null
  const zi = hrZoneIndex(latest.bpm, maxHr)
  if (zi === null) return null
  const z = HR_ZONES[zi]!
  return {
    color: z.colorVar,
    badge: { text: `Z${z.z}`, color: z.colorVar, ariaLabel: t('hrzone.badgeAria', { z: z.z }) },
  }
}

/** Above/below-average arrow with a small deadband so it doesn't flicker around the mean. */
function Trend({ value, avg, t }: { value?: number; avg?: number; t: TFunc }) {
  if (value === undefined || avg === undefined) return null
  const band = Math.max(5, avg * 0.03)
  const dir = value > avg + band ? 'up' : value < avg - band ? 'down' : 'flat'
  const char = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '▪'
  const label =
    dir === 'up' ? t('tiles.aboveAvg') : dir === 'down' ? t('tiles.belowAvg') : t('tiles.atAvg')
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

export function LiveTiles({ prefs, maxHr }: { prefs: DashboardPrefs; maxHr?: number }) {
  const t = useT()
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
  const heroZone = hrZone(heroKey, latest, maxHr, t)
  const heroSub =
    heroAvg !== undefined ? (
      <>
        <span className="tile-avg">
          {t('tiles.avg')} {fmt(heroKey, heroAvg)}
          {heroMeta.unit !== undefined && ` ${heroMeta.unit}`}
        </span>
        <Trend value={heroValue} avg={heroAvg} t={t} />
      </>
    ) : undefined

  return (
    <section className="tiles" aria-label={t('tiles.label')}>
      <Tile
        label={t(heroMeta.labelKey)}
        value={fmt(heroKey, heroValue)}
        unit={heroMeta.unit}
        accent={heroZone?.color ?? heroMeta.accent ?? 'var(--accent)'}
        variant="hero"
        sub={heroSub}
        badge={heroZone?.badge}
      />

      {primary.length > 0 && (
        <div className="tile-row tile-row-primary">
          {primary.map((key) => {
            const zone = hrZone(key, latest, maxHr, t)
            return (
              <Tile
                key={key}
                label={t(METRICS[key].labelKey)}
                value={fmt(key, valueOf(key, latest))}
                unit={METRICS[key].unit}
                accent={zone?.color ?? METRICS[key].accent}
                variant="primary"
                badge={zone?.badge}
              />
            )
          })}
        </div>
      )}

      {small.length > 0 && (
        <div className="tile-row tile-row-small">
          {small.map((key) => {
            const zone = hrZone(key, latest, maxHr, t)
            return (
              <Tile
                key={key}
                label={t(METRICS[key].labelKey)}
                value={fmt(key, valueOf(key, latest))}
                unit={METRICS[key].unit}
                accent={zone?.color}
                variant="small"
                badge={zone?.badge}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

/**
 * Post-ride heart-rate zone breakdown: a stacked bar + legend showing how the ride's time split
 * across the five %HRmax zones. Computed from the stored bpm series against the rider's current
 * profile max HR (we don't snapshot HRmax per session — the breakdown reflects today's setting).
 * Renders nothing when there's no max HR to divide by, or no HR samples in the ride.
 */
import type { CSSProperties } from 'react'
import { HR_ZONES, hrZoneCounts } from '../hr/zones'
import { formatDuration } from '../util/time'
import { useT } from '../i18n/i18n'

interface Props {
  bpmSeries: number[]
  /** Rider's max HR (explicit or age-estimated). Undefined → the whole component hides. */
  maxHr?: number
  /** Session length, to turn each zone's share into minutes. Omitted → times are hidden. */
  durationS?: number
}

export function HrZoneBar({ bpmSeries, maxHr, durationS }: Props) {
  const t = useT()
  const { counts, total } = hrZoneCounts(bpmSeries, maxHr)
  if (maxHr === undefined || maxHr <= 0 || total === 0) return null

  return (
    <div className="hrzones">
      <div className="hrzones-head">
        <span className="hrzones-title">{t('hrzone.title')}</span>
        <span className="hrzones-max">{t('hrzone.maxHr', { hr: maxHr })}</span>
      </div>

      <div className="hrzones-bar" role="img" aria-label={t('hrzone.title')}>
        {HR_ZONES.map((z, i) => {
          const frac = counts[i]! / total
          if (frac === 0) return null
          return (
            <div
              key={z.z}
              className="hrzones-seg"
              style={{ width: `${frac * 100}%`, '--zone-color': z.colorVar } as CSSProperties}
            />
          )
        })}
      </div>

      <ul className="hrzones-legend">
        {HR_ZONES.map((z, i) => {
          const frac = counts[i]! / total
          return (
            <li key={z.z} className="hrzones-item">
              <span
                className="hrzones-swatch"
                style={{ '--zone-color': z.colorVar } as CSSProperties}
              />
              <span className="hrzones-z">Z{z.z}</span>
              <span className="hrzones-name">{t(z.labelKey)}</span>
              <span className="hrzones-pct">{Math.round(frac * 100)}%</span>
              {durationS !== undefined && (
                <span className="hrzones-time">{formatDuration(Math.round(frac * durationS))}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

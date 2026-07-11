/**
 * Arm's-length-legible live readouts from `latest`. Power is the hero tile. Undefined metrics
 * render as "—" (never a fake 0 — important for HR, which must not read 0 when absent).
 * Narrow per-field selectors so each tile only re-renders when its own value changes.
 */
import type { CSSProperties } from 'react'
import { useSessionStore } from '../store/useSessionStore'
import { formatDuration } from '../util/time'

type Variant = 'hero' | 'primary' | 'small'

interface TileProps {
  label: string
  value: string
  unit?: string
  accent?: string
  variant: Variant
}

function Tile({ label, value, unit, accent, variant }: TileProps) {
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
    </div>
  )
}

/** Format a metric, showing "—" for undefined (never a stand-in 0). */
function fmt(v: number | undefined, digits = 0): string {
  if (v === undefined) return '—'
  return v.toFixed(digits)
}

export function LiveTiles() {
  const powerW = useSessionStore((s) => s.latest.powerW)
  const cadenceRpm = useSessionStore((s) => s.latest.cadenceRpm)
  const bpm = useSessionStore((s) => s.latest.bpm)
  const speedKmh = useSessionStore((s) => s.latest.speedKmh)
  const resistance = useSessionStore((s) => s.latest.resistance)
  const distanceKm = useSessionStore((s) => s.latest.distanceKm)
  const energyKcal = useSessionStore((s) => s.latest.energyKcal)
  const elapsedS = useSessionStore((s) => s.latest.elapsedS)

  return (
    <section className="tiles" aria-label="Live metrics">
      <Tile label="Power" value={fmt(powerW)} unit="W" accent="var(--accent)" variant="hero" />

      <div className="tile-row tile-row-primary">
        <Tile
          label="Cadence"
          value={fmt(cadenceRpm)}
          unit="rpm"
          accent="var(--cadence)"
          variant="primary"
        />
        <Tile label="Heart rate" value={fmt(bpm)} unit="bpm" accent="var(--hr)" variant="primary" />
        <Tile
          label="Speed"
          value={fmt(speedKmh, 1)}
          unit="km/h"
          accent="var(--speed)"
          variant="primary"
        />
      </div>

      <div className="tile-row tile-row-small">
        <Tile label="Resistance" value={fmt(resistance)} variant="small" />
        <Tile label="Distance" value={fmt(distanceKm, 2)} unit="km" variant="small" />
        <Tile label="Calories" value={fmt(energyKcal)} unit="kcal" variant="small" />
        <Tile label="Elapsed" value={formatDuration(elapsedS ?? 0)} variant="small" />
      </div>
    </section>
  )
}

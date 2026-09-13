/**
 * Dependency-free inline-SVG time-series. Auto-scales to the data's min/max, stretches to its
 * container width via a viewBox + preserveAspectRatio="none", and keeps a crisp stroke with
 * vectorEffect="non-scaling-stroke". Handles empty and single-point series gracefully.
 */

interface SparklineProps {
  points: number[]
  width?: number
  height?: number
  color?: string
  label?: string
  unit?: string
  /** Accessible name for the chart. Callers pass a translated string; falls back to `label`. */
  ariaLabel?: string
}

function fmtValue(v: number | undefined): string {
  if (v === undefined) return '—'
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export function Sparkline({
  points,
  width = 320,
  height = 56,
  color = 'var(--accent)',
  label,
  unit,
  ariaLabel,
}: SparklineProps) {
  const pad = 2
  const n = points.length
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  let min = Infinity
  let max = -Infinity
  for (const v of points) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min || 1
  const denom = n > 1 ? n - 1 : 1
  const yOf = (v: number) => height - pad - ((v - min) / span) * innerH
  const xOf = (i: number) => pad + (i / denom) * innerW

  let line = ''
  let area = ''
  if (n === 1) {
    const y = yOf(min).toFixed(1)
    line = `${pad},${y} ${width - pad},${y}`
  } else if (n > 1) {
    const coords = points.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`)
    line = coords.join(' ')
    area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`
  }

  const last = points.at(-1)

  return (
    <div className="spark">
      {(label !== undefined || unit !== undefined) && (
        <div className="spark-head">
          {label !== undefined && <span className="spark-label">{label}</span>}
          <span className="spark-value" style={{ color }}>
            {fmtValue(last)}
            {unit !== undefined && <span className="spark-unit"> {unit}</span>}
          </span>
        </div>
      )}
      <svg
        className="spark-svg"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel ?? label ?? 'trend'}
      >
        {n === 0 ? (
          <line
            x1={pad}
            y1={height / 2}
            x2={width - pad}
            y2={height / 2}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <>
            {area !== '' && <polygon points={area} fill={color} opacity={0.12} />}
            <polyline
              points={line}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
    </div>
  )
}

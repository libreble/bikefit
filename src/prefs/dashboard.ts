/**
 * Dashboard layout preferences — which metrics show and in what priority. Device-local
 * (localStorage), like the rider profile. The model is one ordered list of every metric plus a
 * hidden set: the first non-hidden metric is the hero (big) tile, the next few fill the primary
 * row, the rest the small row. Reordering and show/hide both edit this one structure.
 */

import type { MessageKey } from '../i18n/messages'

export type MetricKey =
  'power' | 'cadence' | 'hr' | 'speed' | 'resistance' | 'distance' | 'calories' | 'elapsed'

export interface MetricMeta {
  /** i18n key for the metric's display name; render via the app's `t()`. */
  labelKey: MessageKey
  unit?: string
  digits: number
  accent?: string
  /** Rendered as h:mm:ss rather than a number (elapsed time). */
  isTime?: boolean
}

/** Static per-metric display metadata, shared by the dashboard and its settings panel. Labels are
 * i18n keys (not literals) so every metric name follows the selected language. */
export const METRICS: Record<MetricKey, MetricMeta> = {
  power: { labelKey: 'metric.power', unit: 'W', digits: 0, accent: 'var(--accent)' },
  cadence: { labelKey: 'metric.cadence', unit: 'rpm', digits: 0, accent: 'var(--cadence)' },
  hr: { labelKey: 'metric.hr', unit: 'bpm', digits: 0, accent: 'var(--hr)' },
  speed: { labelKey: 'metric.speed', unit: 'km/h', digits: 1, accent: 'var(--speed)' },
  resistance: { labelKey: 'metric.resistance', digits: 0 },
  distance: { labelKey: 'metric.distance', unit: 'km', digits: 2 },
  calories: { labelKey: 'metric.calories', unit: 'kcal', digits: 0 },
  elapsed: { labelKey: 'metric.elapsed', digits: 0, isTime: true },
}

/** Canonical order (also the default priority) — the source of truth for "all metrics". */
export const ALL_METRICS: MetricKey[] = [
  'power',
  'cadence',
  'hr',
  'speed',
  'resistance',
  'distance',
  'calories',
  'elapsed',
]

export interface DashboardPrefs {
  /** Every metric, in priority order (index 0 = hero when visible). */
  order: MetricKey[]
  /** Metrics currently hidden. */
  hidden: MetricKey[]
}

const KEY = 'bikefit.dashboard.v1'

export function defaultDashboard(): DashboardPrefs {
  return { order: [...ALL_METRICS], hidden: [] }
}

/** Repair a possibly-stale stored value: keep only known keys, append any metric the file predates. */
function normalize(p: Partial<DashboardPrefs> | null): DashboardPrefs {
  const known = new Set(ALL_METRICS)
  const order: MetricKey[] = []
  for (const k of p?.order ?? []) if (known.has(k) && !order.includes(k)) order.push(k)
  for (const k of ALL_METRICS) if (!order.includes(k)) order.push(k)
  const hidden = (p?.hidden ?? []).filter((k) => known.has(k))
  return { order, hidden: [...new Set(hidden)] }
}

export function loadDashboard(): DashboardPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultDashboard()
    return normalize(JSON.parse(raw) as Partial<DashboardPrefs>)
  } catch (e) {
    console.warn('[dashboard] load failed', e)
    return defaultDashboard()
  }
}

export function saveDashboard(p: DashboardPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function resetDashboard(): void {
  localStorage.removeItem(KEY)
}

/** The metrics to render, in order (hero first). */
export function visibleMetrics(p: DashboardPrefs): MetricKey[] {
  const hidden = new Set(p.hidden)
  return p.order.filter((k) => !hidden.has(k))
}

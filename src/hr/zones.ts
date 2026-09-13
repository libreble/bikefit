/**
 * Heart-rate training zones — a 5-zone %HRmax model, the only model we can build from the profile
 * data we hold (max HR, or an age estimate). Distinct from the bike's Coach-By-Color zones, which
 * are *power* zones off FTP; these are app-side and HR-based.
 *
 * Zone 1 is open-ended below (everything under 60% of HRmax) so every sample buckets cleanly with no
 * "below zone" edge case — the same shape the demo ride uses for power zones. Bands follow the common
 * Garmin/Polar-style %HRmax split: <60 / 60–70 / 70–80 / 80–90 / ≥90.
 */

import type { MessageKey } from '../i18n/messages'

/** The classic age formula. `220 − age`, the one on every gym HR-zone chart. */
export function estimateMaxHr(ageYears: number): number {
  return Math.round(220 - ageYears)
}

export interface HrZone {
  /** 1-based zone number, shown as "Z1"…"Z5". */
  z: 1 | 2 | 3 | 4 | 5
  /** Lower bound as % of HRmax (Z1 is open below, Z5 open above). */
  minPct: number
  /** i18n key for the descriptive name (Recovery, Endurance, …). */
  labelKey: MessageKey
  /** CSS custom-property reference for the zone colour. */
  colorVar: string
}

export const HR_ZONES: readonly HrZone[] = [
  { z: 1, minPct: 0, labelKey: 'hrzone.z1', colorVar: 'var(--z1)' },
  { z: 2, minPct: 60, labelKey: 'hrzone.z2', colorVar: 'var(--z2)' },
  { z: 3, minPct: 70, labelKey: 'hrzone.z3', colorVar: 'var(--z3)' },
  { z: 4, minPct: 80, labelKey: 'hrzone.z4', colorVar: 'var(--z4)' },
  { z: 5, minPct: 90, labelKey: 'hrzone.z5', colorVar: 'var(--z5)' },
]

/** Zone index (0–4) for a bpm at a given HRmax, or null when either is unknown/invalid. */
export function hrZoneIndex(bpm: number | undefined, maxHr: number | undefined): number | null {
  if (bpm === undefined || maxHr === undefined || maxHr <= 0) return null
  const pct = (bpm / maxHr) * 100
  if (pct < 60) return 0
  if (pct < 70) return 1
  if (pct < 80) return 2
  if (pct < 90) return 3
  return 4
}

/** Fraction of samples spent in each of the 5 zones (indices 0–4), plus the counted total.
 * Uses sample counts as the time proxy: the series is ~evenly sampled, and the caller turns the
 * fractions into minutes against the session's known duration. Samples without a bpm are skipped. */
export function hrZoneCounts(
  bpmSeries: readonly number[],
  maxHr: number | undefined,
): { counts: number[]; total: number } {
  const counts = [0, 0, 0, 0, 0]
  let total = 0
  for (const bpm of bpmSeries) {
    const zi = hrZoneIndex(bpm, maxHr)
    if (zi === null) continue
    counts[zi] = (counts[zi] ?? 0) + 1
    total++
  }
  return { counts, total }
}

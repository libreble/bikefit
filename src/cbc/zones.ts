/**
 * Coach-By-Color power zones — the bike's *own* 5-zone model (White · Blue · Green · Yellow · Red),
 * lit on its front indicator when CBC is active. Unlike the app's HR zones (%HRmax, computed here),
 * these are the bike's power zones off FTP and we do **not** compute them: the live stream carries
 * the current zone in every frame (`trainingZone`, PROTOCOL.md §4), so we simply mirror what the
 * bike's light is showing.
 *
 * The bike sends a 1-based index 1..5; `0` means "no zone" — CBC inactive (e.g. no FTP set), which
 * we treat as nothing to show. (A captured FTP-less session confirmed a flat `0` throughout.) The
 * 1..5 ordering is confirmed against the demo ride; a real CBC-on capture is still TBC, so the whole
 * mapping lives in this one table — a single edit if the bike turns out to be 0-based.
 */

import type { MessageKey } from '../i18n/messages'

export interface CbcZone {
  /** 1-based zone number 1..5 (matches the bike's `trainingZone` byte). */
  n: 1 | 2 | 3 | 4 | 5
  /** i18n key for the colour name (White, Blue, …) shown on the chip. */
  labelKey: MessageKey
  /** CSS custom-property for the true zone colour — the swatch dot. */
  colorVar: string
  /** CSS custom-property for the number tint. Same as the colour, except White falls back to the
   * default text colour so the value stays legible (a white number is invisible on light theme). */
  accentVar: string
}

export const CBC_ZONES: readonly CbcZone[] = [
  { n: 1, labelKey: 'cbczone.white', colorVar: 'var(--cbc-white)', accentVar: 'var(--text)' },
  { n: 2, labelKey: 'cbczone.blue', colorVar: 'var(--cbc-blue)', accentVar: 'var(--cbc-blue)' },
  { n: 3, labelKey: 'cbczone.green', colorVar: 'var(--cbc-green)', accentVar: 'var(--cbc-green)' },
  {
    n: 4,
    labelKey: 'cbczone.yellow',
    colorVar: 'var(--cbc-yellow)',
    accentVar: 'var(--cbc-yellow)',
  },
  { n: 5, labelKey: 'cbczone.red', colorVar: 'var(--cbc-red)', accentVar: 'var(--cbc-red)' },
]

/** Array index (0–4) into {@link CBC_ZONES} for the bike's raw `trainingZone` byte, or `null` when
 * it's absent, `0` (CBC inactive / no zone), or outside the 1..5 range. */
export function cbcZoneIndex(trainingZone: number | undefined): number | null {
  if (trainingZone === undefined || !Number.isInteger(trainingZone)) return null
  if (trainingZone < 1 || trainingZone > 5) return null
  return trainingZone - 1
}

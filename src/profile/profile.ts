/**
 * Local rider profile — the data we send back when the bike asks for the user
 * (`GET_ALL_USER_DATA`, PROTOCOL.md §8a). Kept in localStorage: it's small, synchronous config,
 * unlike session data (IndexedDB). Entirely **opt-in**: with no saved profile the adapter never
 * answers, so the bike keeps its own defaults (no Coach-By-Color, bike-default FTP) — we don't push
 * a feature the rider didn't ask for. "Delete profile" clears it and returns to that silent state.
 */

import type { IcgUserData } from '../decode/icgEncoder'

export interface UserProfile {
  /** Indoor FTP, watts — the one field that unlocks the bike's colour zones / IF / TSS. */
  ftpW?: number
  /** Body weight, kg — unlocks W/kg. */
  weightKg?: number
  /** Max heart rate, bpm — unlocks %HRmax. */
  maxHr?: number
  ageYears?: number
  /** Full name; only the initials are sent (shown on the bike console). */
  name?: string
  /** Coach-By-Color: light the bike's front indicator by training zone. Defaults on. */
  colorMode?: boolean
}

const KEY = 'bikefit.profile.v1'

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? (parsed as UserProfile) : null
  } catch (e) {
    console.warn('[profile] load failed', e)
    return null
  }
}

export function saveProfile(p: UserProfile): void {
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function clearProfile(): void {
  localStorage.removeItem(KEY)
}

export function hasProfile(): boolean {
  return localStorage.getItem(KEY) != null
}

/** Split a display name into first + surname initials for the bike console. */
function initials(name: string | undefined): { first: string; last: string } {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return {
    first: parts[0] ?? '',
    last: parts.length > 1 ? (parts[parts.length - 1] ?? '') : '',
  }
}

/** Map the app profile to the protocol payload, defaulting every unset field to 0 / off. */
export function profileToIcgUserData(p: UserProfile): IcgUserData {
  const { first, last } = initials(p.name)
  return {
    ftpIndoorW: p.ftpW ?? 0,
    weightKg: p.weightKg ?? 0,
    maxHr: p.maxHr ?? 0,
    ageYears: p.ageYears ?? 0,
    fitnessLevel: 0,
    gender: 0,
    firstInitial: first,
    lastInitial: last,
    colorMode: p.colorMode ?? true,
  }
}

/**
 * What the adapter calls when the bike sends `GET_ALL_USER_DATA`: the current profile as protocol
 * data, or `null` to stay silent. Reads localStorage fresh each time, so a mid-session edit takes
 * effect on the bike's next request.
 */
export function currentUserData(): IcgUserData | null {
  const p = loadProfile()
  return p ? profileToIcgUserData(p) : null
}

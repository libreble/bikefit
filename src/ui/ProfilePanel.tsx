/**
 * Rider profile / settings. Optional and device-local (localStorage) — see `profile/profile.ts`.
 * When saved, the values are sent to the bike on the next connect (in reply to GET_ALL_USER_DATA),
 * which is what lights up Coach-By-Color and makes the bike's FTP-based numbers (zones/IF/TSS)
 * accurate. "Delete profile" returns to the silent, bike-default state.
 */
import { useState, type FormEvent } from 'react'
import { loadProfile, saveProfile, clearProfile, type UserProfile } from '../profile/profile'

function numOrUndef(s: string): number | undefined {
  const t = s.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function str(v: number | undefined): string {
  return v === undefined ? '' : String(v)
}

interface Props {
  /** Close the dialog — called after a successful save (Save is the primary, dialog-closing action). */
  onClose?: () => void
  /** Notify the parent that the stored profile changed (save/delete), so the header label refreshes. */
  onChanged?: () => void
}

export function ProfilePanel({ onClose, onChanged }: Props) {
  const [saved, setSaved] = useState<UserProfile | null>(() => loadProfile())
  const [ftp, setFtp] = useState(() => str(saved?.ftpW))
  const [weight, setWeight] = useState(() => str(saved?.weightKg))
  const [maxHr, setMaxHr] = useState(() => str(saved?.maxHr))
  const [age, setAge] = useState(() => str(saved?.ageYears))
  const [name, setName] = useState(() => saved?.name ?? '')
  const [colorMode, setColorMode] = useState(() => saved?.colorMode ?? true)
  const [flash, setFlash] = useState<string | undefined>(undefined)

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    const p: UserProfile = { colorMode }
    const f = numOrUndef(ftp)
    if (f !== undefined) p.ftpW = f
    const w = numOrUndef(weight)
    if (w !== undefined) p.weightKg = w
    const h = numOrUndef(maxHr)
    if (h !== undefined) p.maxHr = h
    const a = numOrUndef(age)
    if (a !== undefined) p.ageYears = a
    const nm = name.trim()
    if (nm) p.name = nm
    saveProfile(p)
    onChanged?.()
    onClose?.()
  }

  const onDelete = () => {
    clearProfile()
    setSaved(null)
    setFtp('')
    setWeight('')
    setMaxHr('')
    setAge('')
    setName('')
    setColorMode(true)
    setFlash('Profile deleted.')
    onChanged?.()
  }

  return (
    <form className="profile-form" onSubmit={onSave}>
      <p className="profile-note">
        Optional, stored only on this device. When set it's sent to the bike so it can show your FTP
        zones (Coach-By-Color) and W/kg. Leave blank to keep the bike's own defaults.
      </p>

      <div className="profile-grid">
        <label className="field-row">
          <span>
            FTP <span className="field-unit">W</span>
          </span>
          <input
            inputMode="numeric"
            value={ftp}
            onChange={(e) => setFtp(e.target.value)}
            placeholder="e.g. 220"
          />
        </label>
        <label className="field-row">
          <span>
            Weight <span className="field-unit">kg</span>
          </span>
          <input
            inputMode="numeric"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 75"
          />
        </label>
        <label className="field-row">
          <span>
            Max HR <span className="field-unit">bpm</span>
          </span>
          <input
            inputMode="numeric"
            value={maxHr}
            onChange={(e) => setMaxHr(e.target.value)}
            placeholder="e.g. 185"
          />
        </label>
        <label className="field-row">
          <span>
            Age <span className="field-unit">yr</span>
          </span>
          <input
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="optional"
          />
        </label>
        <label className="field-row profile-name">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="shown on the bike (initials only)"
          />
        </label>
      </div>

      <label className="profile-check">
        <input
          type="checkbox"
          checked={colorMode}
          onChange={(e) => setColorMode(e.target.checked)}
        />
        <span>Enable Coach-By-Color on the bike (front zone light)</span>
      </label>

      {flash !== undefined && <div className="profile-flash">{flash}</div>}

      <div className="profile-actions">
        <button type="submit" className="btn btn-accent">
          Save
        </button>
      </div>

      {saved !== null && (
        <button type="button" className="profile-delete-link" onClick={onDelete}>
          Delete profile
        </button>
      )}
    </form>
  )
}

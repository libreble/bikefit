/**
 * Rider profile / settings. Optional and device-local (localStorage) — see `profile/profile.ts`.
 * When saved, the values are sent to the bike on the next connect (in reply to GET_ALL_USER_DATA),
 * which is what lights up Coach-By-Color and makes the bike's FTP-based numbers (zones/IF/TSS)
 * accurate. "Delete profile" returns to the silent, bike-default state.
 */
import { useState, type FormEvent } from 'react'
import { loadProfile, saveProfile, clearProfile, type UserProfile } from '../profile/profile'
import { estimateMaxHr } from '../hr/zones'
import { useT } from '../i18n/i18n'

/** A plausible adult age we're willing to turn into a 220 − age estimate. */
function ageForEstimate(s: string): number | undefined {
  const n = numOrUndef(s)
  return n !== undefined && n >= 1 && n <= 119 ? n : undefined
}

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
  const t = useT()
  const [saved, setSaved] = useState<UserProfile | null>(() => loadProfile())
  const [ftp, setFtp] = useState(() => str(saved?.ftpW))
  const [weight, setWeight] = useState(() => str(saved?.weightKg))
  const [age, setAge] = useState(() => str(saved?.ageYears))
  // Max HR seeds from a saved value, else a 220 − age estimate. `maxHrTouched` locks it: once the
  // rider types their own (or a saved value already exists), age no longer overwrites the field.
  const [maxHr, setMaxHr] = useState(() =>
    str(
      saved?.maxHr ?? (saved?.ageYears !== undefined ? estimateMaxHr(saved.ageYears) : undefined),
    ),
  )
  const [maxHrTouched, setMaxHrTouched] = useState(() => saved?.maxHr !== undefined)
  const [name, setName] = useState(() => saved?.name ?? '')
  const [colorMode, setColorMode] = useState(() => saved?.colorMode ?? true)
  const [flash, setFlash] = useState<string | undefined>(undefined)

  // While the rider hasn't set their own max HR, keep it tracking the age estimate.
  const onAgeChange = (v: string) => {
    setAge(v)
    if (maxHrTouched) return
    const a = ageForEstimate(v)
    setMaxHr(a !== undefined ? String(estimateMaxHr(a)) : '')
  }
  const onMaxHrChange = (v: string) => {
    setMaxHr(v)
    setMaxHrTouched(true)
  }
  const maxHrIsEstimate = !maxHrTouched && maxHr !== ''

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
    setSaved(p)
    setFlash(t('common.saved'))
    onChanged?.()
    onClose?.()
  }

  const onDelete = () => {
    clearProfile()
    setSaved(null)
    setFtp('')
    setWeight('')
    setMaxHr('')
    setMaxHrTouched(false)
    setAge('')
    setName('')
    setColorMode(true)
    setFlash(t('profile.deleted'))
    onChanged?.()
  }

  return (
    <form className="profile-form" onSubmit={onSave}>
      <p className="profile-note">{t('profile.note')}</p>

      <div className="profile-grid">
        <label className="field-row">
          <span>
            {t('profile.ftp')} <span className="field-unit">W</span>
          </span>
          <input
            inputMode="numeric"
            value={ftp}
            onChange={(e) => setFtp(e.target.value)}
            placeholder={t('profile.phFtp')}
          />
        </label>
        <label className="field-row">
          <span>
            {t('profile.weight')} <span className="field-unit">kg</span>
          </span>
          <input
            inputMode="numeric"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={t('profile.phWeight')}
          />
        </label>
        <label className="field-row">
          <span>
            {t('profile.maxHr')} <span className="field-unit">bpm</span>
          </span>
          <input
            inputMode="numeric"
            value={maxHr}
            onChange={(e) => onMaxHrChange(e.target.value)}
            placeholder={t('profile.phMaxHr')}
          />
          {maxHrIsEstimate && <small className="field-hint">{t('profile.maxHrHint')}</small>}
        </label>
        <label className="field-row">
          <span>
            {t('profile.age')} <span className="field-unit">{t('profile.unitYr')}</span>
          </span>
          <input
            inputMode="numeric"
            value={age}
            onChange={(e) => onAgeChange(e.target.value)}
            placeholder={t('profile.phAge')}
          />
        </label>
        <label className="field-row profile-name">
          <span>{t('profile.name')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('profile.phName')}
          />
        </label>
      </div>

      <label className="profile-check">
        <input
          type="checkbox"
          checked={colorMode}
          onChange={(e) => setColorMode(e.target.checked)}
        />
        <span>{t('profile.colorMode')}</span>
      </label>

      {flash !== undefined && <div className="profile-flash">{flash}</div>}

      <div className="profile-actions">
        <button type="submit" className="btn btn-accent">
          {t('common.save')}
        </button>
      </div>

      {saved !== null && (
        <button type="button" className="profile-delete-link" onClick={onDelete}>
          {t('profile.delete')}
        </button>
      )}
    </form>
  )
}

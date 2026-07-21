/**
 * Dashboard customization form. Reorder the metrics (the first shown becomes the hero tile) and
 * show/hide any of them. Edits a working copy; Save persists to localStorage and notifies the
 * parent so the live dashboard re-reads it. Rendered inline on the Settings page (previously a
 * modal — see git history); `onClose` is optional so it can also be dropped into a dialog shell.
 */
import { useState } from 'react'
import {
  METRICS,
  defaultDashboard,
  loadDashboard,
  saveDashboard,
  type DashboardPrefs,
  type MetricKey,
} from '../prefs/dashboard'
import { useT } from '../i18n/i18n'

interface Props {
  /** Called after Save persists, so the dashboard re-reads the stored prefs. */
  onChanged: () => void
  /** Optional: close a surrounding dialog after Save (unused when rendered as a page section). */
  onClose?: () => void
}

export function DashboardPanel({ onChanged, onClose }: Props) {
  const t = useT()
  const [prefs, setPrefs] = useState<DashboardPrefs>(() => loadDashboard())
  const [flash, setFlash] = useState<string | undefined>(undefined)

  const firstVisible = prefs.order.find((k) => !prefs.hidden.includes(k))

  const move = (i: number, dir: -1 | 1) =>
    setPrefs((p) => {
      const order = [...p.order]
      const j = i + dir
      const a = order[i]
      const b = order[j]
      if (a === undefined || b === undefined) return p
      order[i] = b
      order[j] = a
      return { ...p, order }
    })

  const toggle = (k: MetricKey) =>
    setPrefs((p) => ({
      ...p,
      hidden: p.hidden.includes(k) ? p.hidden.filter((x) => x !== k) : [...p.hidden, k],
    }))

  const onSave = () => {
    saveDashboard(prefs)
    onChanged()
    setFlash(t('common.saved'))
    onClose?.()
  }

  return (
    <div className="dash-panel">
      <p className="profile-note">{t('dash.note')}</p>

      <ul className="dash-list">
        {prefs.order.map((key, i) => {
          const visible = !prefs.hidden.includes(key)
          return (
            <li key={key} className={`dash-row${visible ? '' : ' dash-row--hidden'}`}>
              <label className="dash-toggle">
                <input type="checkbox" checked={visible} onChange={() => toggle(key)} />
                <span className="dash-name">{t(METRICS[key].labelKey)}</span>
              </label>
              {key === firstVisible && <span className="dash-hero-tag">{t('dash.hero')}</span>}
              <div className="dash-move">
                <button
                  type="button"
                  className="btn btn-ghost dash-arrow"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={t('dash.moveUp', { name: t(METRICS[key].labelKey) })}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-ghost dash-arrow"
                  onClick={() => move(i, 1)}
                  disabled={i === prefs.order.length - 1}
                  aria-label={t('dash.moveDown', { name: t(METRICS[key].labelKey) })}
                >
                  ↓
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {flash !== undefined && <div className="profile-flash">{flash}</div>}

      <div className="profile-actions">
        <button type="button" className="btn btn-accent" onClick={onSave}>
          {t('common.save')}
        </button>
      </div>
      <button
        type="button"
        className="profile-delete-link"
        onClick={() => {
          setPrefs(defaultDashboard())
          setFlash(undefined)
        }}
      >
        {t('dash.reset')}
      </button>
    </div>
  )
}

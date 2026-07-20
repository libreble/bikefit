/**
 * Dashboard customization as a modal popup (native <dialog>), opened from the header. Reorder the
 * metrics (the first shown becomes the hero tile) and show/hide any of them. Edits a working copy;
 * Save persists to localStorage and the dashboard re-reads it. Same shell/behaviour as ProfileDialog.
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react'
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
  open: boolean
  onClose: () => void
  /** Called after Save so the dashboard re-reads the stored prefs. */
  onChanged: () => void
}

export function DashboardDialog({ open, onClose, onChanged }: Props) {
  const t = useT()
  const ref = useRef<HTMLDialogElement>(null)
  const [prefs, setPrefs] = useState<DashboardPrefs>(() => loadDashboard())

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) {
      setPrefs(loadDashboard()) // fresh working copy each open
      dlg.showModal()
    } else if (!open && dlg.open) {
      dlg.close()
    }
  }, [open])

  const onDialogClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose()
  }

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
    onClose()
  }

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={t('dash.title')}
      onClose={onClose}
      onClick={onDialogClick}
    >
      {open && (
        <div className="modal-card">
          <div className="modal-head">
            <h2 className="modal-title">{t('dash.title')}</h2>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              ×
            </button>
          </div>

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

          <div className="profile-actions">
            <button type="button" className="btn btn-accent" onClick={onSave}>
              {t('common.save')}
            </button>
          </div>
          <button
            type="button"
            className="profile-delete-link"
            onClick={() => setPrefs(defaultDashboard())}
          >
            {t('dash.reset')}
          </button>
        </div>
      )}
    </dialog>
  )
}

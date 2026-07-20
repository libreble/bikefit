/**
 * Rider profile as a modal popup (native <dialog>), opened from the header — keeps settings off the
 * main dashboard, which reads better on a bike-mounted phone. Esc, the backdrop, and the × all
 * close it. The form itself lives in ProfilePanel; this only owns the dialog shell + open/close.
 */
import { useEffect, useRef, type MouseEvent } from 'react'
import { ProfilePanel } from './ProfilePanel'
import { useT } from '../i18n/i18n'

interface Props {
  open: boolean
  onClose: () => void
  /** Called after the stored profile changes (save/delete), so the header label can refresh. */
  onChanged?: () => void
}

export function ProfileDialog({ open, onClose, onChanged }: Props) {
  const t = useT()
  const ref = useRef<HTMLDialogElement>(null)

  // Drive the native modal from the `open` prop (showModal gives us backdrop + focus trap + Esc).
  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    else if (!open && dlg.open) dlg.close()
  }, [open])

  // A click landing on the dialog element itself (not its card) is a backdrop click → close.
  const onDialogClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose()
  }

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={t('profile.title')}
      onClose={onClose}
      onClick={onDialogClick}
    >
      {/* Mount the form only while open so it re-reads localStorage and resets transient state each time. */}
      {open && (
        <div className="modal-card">
          <div className="modal-head">
            <h2 className="modal-title">{t('profile.title')}</h2>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              ×
            </button>
          </div>
          <ProfilePanel onClose={onClose} onChanged={onChanged} />
        </div>
      )}
    </dialog>
  )
}

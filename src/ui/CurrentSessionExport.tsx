/** Export the current (active or just-finished) session, JSON or TCX. Lives on the live page; past
 * sessions are exported from their own detail page. */
import { useState } from 'react'
import * as controller from '../app/controller'
import { useT } from '../i18n/i18n'

export function CurrentSessionExport() {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(undefined)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <h3 className="panel-h">{t('export.currentTitle')}</h3>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => void run(controller.exportCurrentSession)}
          disabled={busy}
        >
          {t('export.json')}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void run(controller.exportCurrentSessionTcx)}
          disabled={busy}
        >
          {t('export.tcx')}
        </button>
      </div>
      {error !== undefined && (
        <div className="sessions-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}

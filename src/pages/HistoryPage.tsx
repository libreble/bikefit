/**
 * The session-history route (/sessions): the prominent, full list of stored rides. Header actions
 * seed a demo ride, import a session JSON, and refresh; each row links to its detail page and
 * carries quick export/delete actions.
 */
import { useState, type ChangeEvent } from 'react'
import * as controller from '../app/controller'
import { SessionList } from '../ui/SessionList'
import { useSessions } from '../ui/useSessions'

export function HistoryPage() {
  const { sessions, loading, error: listError, refresh } = useSessions()
  const [actionError, setActionError] = useState<string | undefined>(undefined)
  const [busyId, setBusyId] = useState<string | undefined>(undefined)
  const [seeding, setSeeding] = useState(false)

  const error = actionError ?? listError

  const onSeed = async () => {
    setSeeding(true)
    setActionError(undefined)
    try {
      await controller.seedDemoSession(45)
      await refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setSeeding(false)
    }
  }

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = '' // allow re-importing the same file
    if (!file) return
    setActionError(undefined)
    try {
      await controller.importSession(await file.text())
      await refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    setActionError(undefined)
    try {
      await fn()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(undefined)
    }
  }

  const onExport = (id: string) => void withBusy(id, () => controller.exportPastSession(id))
  const onExportTcx = (id: string) => void withBusy(id, () => controller.exportPastSessionTcx(id))
  const onDelete = (id: string) =>
    void withBusy(id, async () => {
      await controller.deletePastSession(id)
      await refresh()
    })

  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">Session history</h2>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void onSeed()}
            disabled={seeding}
          >
            {seeding ? 'Adding…' : 'Add demo session'}
          </button>
          <label className="btn btn-ghost import-btn">
            Import JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => void onImport(e)}
              hidden
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error !== undefined && (
        <div className="sessions-error" role="alert">
          {error}
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="sessions-empty">
          {loading ? 'Loading…' : 'No sessions yet. Ride the bike, or add a demo session.'}
        </div>
      ) : (
        <SessionList
          sessions={sessions}
          busyId={busyId}
          onExport={onExport}
          onExportTcx={onExportTcx}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

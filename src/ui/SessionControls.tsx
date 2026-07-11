/**
 * Export the current session, and manage past sessions: list them (on mount + Refresh), then
 * export or delete each. All persistence lives behind the controller; this component only holds
 * the fetched list + UI state.
 */
import { useCallback, useEffect, useState } from 'react'
import * as controller from '../app/controller'
import type { SessionMeta } from '../types'

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}

function startedLabel(startedAtWall: number): string {
  return new Date(startedAtWall).toLocaleString()
}

export function SessionControls() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [busyId, setBusyId] = useState<string | undefined>(undefined)
  const [exportingCurrent, setExportingCurrent] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      setSessions(await controller.listPastSessions())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onExportCurrent = async () => {
    setExportingCurrent(true)
    setError(undefined)
    try {
      await controller.exportCurrentSession()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExportingCurrent(false)
    }
  }

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    setError(undefined)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(undefined)
    }
  }

  const onExport = (id: string) => void withBusy(id, () => controller.exportPastSession(id))
  const onDelete = (id: string) =>
    void withBusy(id, async () => {
      await controller.deletePastSession(id)
      await refresh()
    })

  return (
    <section className="sessions" aria-label="Sessions">
      <div className="sessions-head">
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => void onExportCurrent()}
          disabled={exportingCurrent}
        >
          Export session (JSON)
        </button>
      </div>

      <div className="sessions-past">
        <div className="sessions-past-head">
          <h3>Past sessions</h3>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error !== undefined && (
          <div className="sessions-error" role="alert">
            {error}
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="sessions-empty">{loading ? 'Loading…' : 'No past sessions.'}</div>
        ) : (
          <ul className="sessions-list">
            {sessions.map((s) => (
              <li className="session-row" key={s.id}>
                <div className="session-meta">
                  <span className="session-time">{startedLabel(s.startedAtWall)}</span>
                  <span className="session-sub">
                    {s.protocol !== undefined && (
                      <span className="proto-badge">{s.protocol.toUpperCase()}</span>
                    )}
                    <span className="session-id">{shortId(s.id)}</span>
                  </span>
                </div>
                <div className="session-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onExport(s.id)}
                    disabled={busyId === s.id}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => onDelete(s.id)}
                    disabled={busyId === s.id}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

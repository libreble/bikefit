/**
 * Export the current session, seed a demo ride, and manage past sessions: list them (on mount +
 * Refresh), open one for review, export, or delete. All persistence lives behind the controller;
 * this component only holds the fetched list + UI state.
 */
import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import * as controller from '../app/controller'
import type { StoredSession } from '../session/db'
import { formatDuration } from '../util/time'
import { SessionReview } from './SessionReview'

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}

function startedLabel(startedAtWall: number): string {
  return new Date(startedAtWall).toLocaleString()
}

/** One-line summary for a session row: duration · avg power · distance (whatever's available). */
function summaryLine(s: StoredSession): string | null {
  const sm = s.summary
  if (!sm) return null
  const parts = [formatDuration(sm.durationS)]
  if (sm.avgPowerW !== undefined) parts.push(`${sm.avgPowerW} W avg`)
  if (sm.distanceKm !== undefined) parts.push(`${sm.distanceKm.toFixed(2)} km`)
  return parts.join(' · ')
}

export function SessionControls() {
  const [sessions, setSessions] = useState<StoredSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [busyId, setBusyId] = useState<string | undefined>(undefined)
  const [exportingCurrent, setExportingCurrent] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)

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

  const onExportCurrentTcx = async () => {
    setExportingCurrent(true)
    setError(undefined)
    try {
      await controller.exportCurrentSessionTcx()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExportingCurrent(false)
    }
  }

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = '' // allow re-importing the same file
    if (!file) return
    setError(undefined)
    try {
      await controller.importSession(await file.text())
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const onSeed = async () => {
    setSeeding(true)
    setError(undefined)
    try {
      await controller.seedDemoSession(45)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSeeding(false)
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
  const onExportTcx = (id: string) => void withBusy(id, () => controller.exportPastSessionTcx(id))
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
          Export JSON
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void onExportCurrentTcx()}
          disabled={exportingCurrent}
        >
          Export TCX
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
      </div>

      <div className="sessions-past">
        <div className="sessions-past-head">
          <h3>Past sessions</h3>
          <div className="sessions-head-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void onSeed()}
              disabled={seeding}
            >
              {seeding ? 'Adding…' : 'Add demo session'}
            </button>
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
          <div className="sessions-empty">{loading ? 'Loading…' : 'No past sessions.'}</div>
        ) : (
          <ul className="sessions-list">
            {sessions.map((s) => {
              const line = summaryLine(s)
              return (
                <li className="session-row" key={s.id}>
                  <button
                    type="button"
                    className="session-open"
                    onClick={() => setReviewId(s.id)}
                    aria-label={`Open session from ${startedLabel(s.startedAtWall)}`}
                  >
                    <span className="session-time">{startedLabel(s.startedAtWall)}</span>
                    <span className="session-sub">
                      {s.protocol !== undefined && (
                        <span className="proto-badge">{s.protocol.toUpperCase()}</span>
                      )}
                      <span className="session-summary">{line ?? shortId(s.id)}</span>
                    </span>
                  </button>
                  <div className="session-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => onExport(s.id)}
                      disabled={busyId === s.id}
                    >
                      JSON
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => onExportTcx(s.id)}
                      disabled={busyId === s.id}
                    >
                      TCX
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
              )
            })}
          </ul>
        )}
      </div>

      <SessionReview sessionId={reviewId} onClose={() => setReviewId(null)} />
    </section>
  )
}

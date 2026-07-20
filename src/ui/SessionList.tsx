/**
 * List of stored sessions. Each row links to its bookmarkable detail page (/sessions/:id); the
 * optional per-row actions (export JSON/TCX, delete) sit outside the link. Used both full (history
 * page) and compact (live page's "recent rides", no actions).
 */
import { Link } from 'react-router-dom'
import type { StoredSession } from '../session/db'
import { formatDuration } from '../util/time'

function startedLabel(startedAtWall: number): string {
  return new Date(startedAtWall).toLocaleString()
}

/** One-line summary: duration · avg power · distance (whatever's available), else the short id. */
function summaryLine(s: StoredSession): string {
  const sm = s.summary
  if (!sm) return s.id.slice(0, 8)
  const parts = [formatDuration(sm.durationS)]
  if (sm.avgPowerW !== undefined) parts.push(`${sm.avgPowerW} W avg`)
  if (sm.distanceKm !== undefined) parts.push(`${sm.distanceKm.toFixed(2)} km`)
  return parts.join(' · ')
}

interface Props {
  sessions: StoredSession[]
  /** Hide per-row actions (compact preview). */
  compact?: boolean
  busyId?: string | undefined
  onExport?: (id: string) => void
  onExportTcx?: (id: string) => void
  onDelete?: (id: string) => void
}

export function SessionList({
  sessions,
  compact = false,
  busyId,
  onExport,
  onExportTcx,
  onDelete,
}: Props) {
  const showActions = !compact && (onExport !== undefined || onDelete !== undefined)
  return (
    <ul className="sessions-list">
      {sessions.map((s) => (
        <li className="session-row" key={s.id}>
          <Link
            className="session-open"
            to={`/sessions/${s.id}`}
            aria-label={`Open session from ${startedLabel(s.startedAtWall)}`}
          >
            <span className="session-time">{startedLabel(s.startedAtWall)}</span>
            <span className="session-sub">
              {s.protocol !== undefined && (
                <span className="proto-badge">{s.protocol.toUpperCase()}</span>
              )}
              <span className="session-summary">{summaryLine(s)}</span>
            </span>
          </Link>
          {showActions && (
            <div className="session-actions">
              {onExport !== undefined && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onExport(s.id)}
                  disabled={busyId === s.id}
                >
                  JSON
                </button>
              )}
              {onExportTcx !== undefined && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onExportTcx(s.id)}
                  disabled={busyId === s.id}
                >
                  TCX
                </button>
              )}
              {onDelete !== undefined && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => onDelete(s.id)}
                  disabled={busyId === s.id}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

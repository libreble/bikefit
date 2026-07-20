/**
 * A single session's bookmarkable detail route (/sessions/:id): loads the meta + sample series,
 * renders the summary + sparklines (SessionSummaryView), and offers export/delete. Deleting returns
 * to the history list; an unknown id shows a not-found message.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as controller from '../app/controller'
import type { SessionDetail } from '../app/controller'
import { SessionSummaryView } from '../ui/SessionSummaryView'

export function SessionPage() {
  const { id } = useParams<'id'>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (id === undefined) return
    let cancelled = false
    setDetail(null)
    setError(undefined)
    controller
      .loadSessionDetail(id)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [id])

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

  const onDelete = () =>
    void run(async () => {
      if (id === undefined) return
      await controller.deletePastSession(id)
      navigate('/sessions')
    })

  const title =
    detail !== null ? new Date(detail.session.startedAtWall).toLocaleString() : 'Session'

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-main">
          <Link className="back-link" to="/sessions">
            ← History
          </Link>
          <h2 className="page-title">{title}</h2>
        </div>
        {detail !== null && id !== undefined && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void run(() => controller.exportPastSession(id))}
              disabled={busy}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void run(() => controller.exportPastSessionTcx(id))}
              disabled={busy}
            >
              Export TCX
            </button>
            <button type="button" className="btn btn-danger" onClick={onDelete} disabled={busy}>
              Delete
            </button>
          </div>
        )}
      </div>

      {error !== undefined && (
        <div className="sessions-error" role="alert">
          {error}
        </div>
      )}
      {detail === null && error === undefined && <div className="sessions-empty">Loading…</div>}
      {detail !== null && (
        <SessionSummaryView session={detail.session} samples={detail.samples} />
      )}
    </div>
  )
}

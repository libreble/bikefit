/**
 * Review a past session in a modal: its summary stats, the bike's final IF/TSS (when present), and
 * sparklines rebuilt from the stored sample series. Loads the detail (meta + samples) via the
 * controller when a `sessionId` is set; same <dialog> shell as the other modals.
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import * as controller from '../app/controller'
import type { SessionDetail } from '../app/controller'
import type { SessionSample } from '../types'
import { Sparkline } from './Sparkline'
import { formatDuration } from '../util/time'

function series(samples: SessionSample[], f: (s: SessionSample) => number | undefined): number[] {
  const out: number[] = []
  for (const s of samples) {
    const v = f(s)
    if (v !== undefined) out.push(v)
  }
  return out
}

/** The aggregated snapshot stores number | number[]; pull a scalar or undefined. */
function num(v: number | number[] | undefined): number | undefined {
  return typeof v === 'number' ? v : undefined
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

interface Props {
  sessionId: string | null
  onClose: () => void
}

export function SessionReview({ sessionId, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)
  const open = sessionId !== null

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    else if (!open && dlg.open) dlg.close()
  }, [open])

  useEffect(() => {
    if (sessionId === null) {
      setDetail(null)
      setError(undefined)
      return
    }
    let cancelled = false
    setDetail(null)
    setError(undefined)
    controller
      .loadSessionDetail(sessionId)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const onDialogClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose()
  }

  const summary = detail?.session.summary
  const agg = detail?.session.aggregated
  const samples = detail?.samples ?? []
  const fmt = (v: number | undefined, digits = 0, suffix = ''): string =>
    v === undefined ? '—' : `${v.toFixed(digits)}${suffix}`
  const iff = num(agg?.['intensityFactor'])
  const tss = num(agg?.['trainingStressScore'])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label="Session review"
      onClose={onClose}
      onClick={onDialogClick}
    >
      {open && (
        <div className="modal-card">
          <div className="modal-head">
            <h2 className="modal-title">
              {detail ? new Date(detail.session.startedAtWall).toLocaleString() : 'Session'}
            </h2>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          {error !== undefined && (
            <div className="sessions-error" role="alert">
              {error}
            </div>
          )}
          {detail === null && error === undefined && <div className="sessions-empty">Loading…</div>}

          {detail !== null && (
            <>
              <div className="stats">
                <Stat label="Duration" value={summary ? formatDuration(summary.durationS) : '—'} />
                <Stat label="Avg power" value={fmt(summary?.avgPowerW, 0, ' W')} />
                <Stat label="Max power" value={fmt(summary?.maxPowerW, 0, ' W')} />
                <Stat label="Avg HR" value={fmt(summary?.avgBpm, 0, ' bpm')} />
                <Stat label="Max HR" value={fmt(summary?.maxBpm, 0, ' bpm')} />
                <Stat label="Avg cadence" value={fmt(summary?.avgCadenceRpm, 0, ' rpm')} />
                <Stat label="Distance" value={fmt(summary?.distanceKm, 2, ' km')} />
                <Stat label="Energy" value={fmt(summary?.energyKcal, 0, ' kcal')} />
                {iff !== undefined && <Stat label="IF" value={iff.toFixed(2)} />}
                {tss !== undefined && <Stat label="TSS" value={tss.toFixed(0)} />}
              </div>

              <div className="review-graphs">
                <Sparkline
                  points={series(samples, (s) => s.powerW)}
                  color="var(--accent)"
                  label="Power"
                  unit="W"
                />
                <Sparkline
                  points={series(samples, (s) => s.bpm)}
                  color="var(--hr)"
                  label="Heart rate"
                  unit="bpm"
                />
                <Sparkline
                  points={series(samples, (s) => s.cadenceRpm)}
                  color="var(--cadence)"
                  label="Cadence"
                  unit="rpm"
                />
              </div>
            </>
          )}
        </div>
      )}
    </dialog>
  )
}

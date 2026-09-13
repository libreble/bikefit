/**
 * Connect / Disconnect control plus at-a-glance connection state: a colored status dot, the
 * device name, a small protocol badge, an optional battery readout, and the global error.
 */
import { useState } from 'react'
import * as controller from '../app/controller'
import { useSessionStore } from '../store/useSessionStore'
import type { ConnStatus } from '../store/useSessionStore'
import { useT } from '../i18n/i18n'
import type { MessageKey } from '../i18n/messages'
import { demoEnabled } from '../app/flags'

const STATUS_LABEL: Record<ConnStatus, MessageKey> = {
  idle: 'conn.status.idle',
  requesting: 'conn.status.requesting',
  connecting: 'conn.status.connecting',
  connected: 'conn.status.connected',
  reconnecting: 'conn.status.reconnecting',
  disconnected: 'conn.status.disconnected',
  error: 'conn.status.error',
}

export function ConnectionBar() {
  const t = useT()
  const status = useSessionStore((s) => s.status)
  const device = useSessionStore((s) => s.device)
  const protocol = useSessionStore((s) => s.protocol)
  const error = useSessionStore((s) => s.error)
  const battery = useSessionStore((s) => s.latest.extra?.['battery'])

  const [pending, setPending] = useState(false)
  const [localError, setLocalError] = useState<string | undefined>(undefined)

  const busy = status === 'requesting' || status === 'connecting' || status === 'reconnecting'
  const connected = status === 'connected'

  const run = async (fn: () => Promise<void>) => {
    setPending(true)
    setLocalError(undefined)
    try {
      await fn()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(false)
    }
  }

  const onClick = () => {
    if (connected || busy) void run(controller.disconnect)
    else void run(controller.connect)
  }

  const buttonLabel = connected ? t('conn.disconnect') : busy ? t('conn.cancel') : t('conn.connect')
  const deviceName = device?.name ?? t('conn.noDevice')
  const statusText = t(STATUS_LABEL[status])

  return (
    <div className="connbar">
      {/* Connect is the primary CTA (accent); once connected, Disconnect steps back to a quiet
          ghost that only turns danger-red on hover — it shouldn't shout during a ride. */}
      <button
        type="button"
        className={`btn conn-btn ${connected ? 'btn-ghost conn-disconnect' : 'btn-accent'}`}
        onClick={onClick}
        disabled={pending}
      >
        {buttonLabel}
      </button>

      {demoEnabled && !connected && !busy && (
        <button
          type="button"
          className="btn btn-ghost demo-btn"
          onClick={() => void run(controller.connectDemo)}
          disabled={pending}
          title={t('conn.demoTitle')}
        >
          {t('conn.demo')}
        </button>
      )}

      {/* When connected, the green dot + device name say it all, so the "Connected" word is dropped
          (the dot carries the accessible name instead). Other states keep the label — "Connecting…",
          "Error" etc. need the words. */}
      <div className="conn-state">
        {connected ? (
          <span className={`status-dot status-${status}`} role="img" aria-label={statusText} />
        ) : (
          <>
            <span className={`status-dot status-${status}`} aria-hidden="true" />
            <span className="status-label">{statusText}</span>
          </>
        )}
      </div>

      <div className="conn-device">
        <span className="device-name">{deviceName}</span>
        {protocol !== undefined && <span className="proto-badge">{protocol.toUpperCase()}</span>}
        {battery !== undefined && <span className="battery">{Math.round(battery)}%</span>}
      </div>

      {(error !== undefined || localError !== undefined) && (
        <div className="conn-error" role="alert">
          {error ?? localError}
        </div>
      )}
    </div>
  )
}

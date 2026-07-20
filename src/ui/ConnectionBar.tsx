/**
 * Connect / Disconnect control plus at-a-glance connection state: a colored status dot, the
 * device name, a small protocol badge, an optional battery readout, and the global error.
 */
import { useState } from 'react'
import * as controller from '../app/controller'
import { useSessionStore } from '../store/useSessionStore'
import type { ConnStatus } from '../store/useSessionStore'

const STATUS_LABEL: Record<ConnStatus, string> = {
  idle: 'Idle',
  requesting: 'Requesting…',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
  error: 'Error',
}

export function ConnectionBar() {
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

  const buttonLabel = connected ? 'Disconnect' : busy ? 'Cancel' : 'Connect'
  const deviceName = device?.name ?? 'No device'

  return (
    <div className="connbar">
      <button
        type="button"
        className={`btn conn-btn ${connected ? 'btn-danger' : 'btn-accent'}`}
        onClick={onClick}
        disabled={pending}
      >
        {buttonLabel}
      </button>

      {!connected && !busy && (
        <button
          type="button"
          className="btn btn-ghost demo-btn"
          onClick={() => void run(controller.connectDemo)}
          disabled={pending}
          title="Simulate a ride without a bike (for testing the UI)"
        >
          Demo
        </button>
      )}

      <div className="conn-state">
        <span className={`status-dot status-${status}`} aria-hidden="true" />
        <span className="status-label">{STATUS_LABEL[status]}</span>
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

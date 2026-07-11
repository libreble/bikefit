/**
 * The debug heart of the app. Shows the running frame count and a reverse-chronological list of
 * recent decoded messages. A non-empty `leftover` is our "wrong protocol guess" signal and is
 * rendered as a loud WARNING chip. Includes a manual hex-command sender (in case the bike needs a
 * trigger to start streaming) and an auto-scroll toggle. Deliberately dense and monospace.
 */
import { useEffect, useRef, useState } from 'react'
import * as controller from '../app/controller'
import { useSessionStore } from '../store/useSessionStore'
import type { DecodedMessage } from '../types'

function fmtField(v: number | number[]): string {
  return Array.isArray(v) ? v.join(', ') : String(v)
}

function Fields({ fields }: { fields: DecodedMessage['fields'] }) {
  if (fields === undefined) return null
  const entries = Object.entries(fields)
  if (entries.length === 0) return null
  return (
    <div className="msg-fields">
      {entries.map(([k, v]) => (
        <span className="field" key={k}>
          <span className="field-k">{k}</span>
          <span className="field-v">{fmtField(v)}</span>
        </span>
      ))}
    </div>
  )
}

function MessageRow({ m }: { m: DecodedMessage }) {
  const hasLeftover = typeof m.leftover === 'string' && m.leftover.length > 0
  return (
    <li className={`msg ${m.ok ? 'msg-ok' : 'msg-bad'}`}>
      <div className="msg-top">
        <span className={`msg-badge ${m.ok ? 'ok' : 'bad'}`}>{m.ok ? 'OK' : 'BAD'}</span>
        <span className="msg-id">{m.msgId !== undefined ? `#${m.msgId}` : '#—'}</span>
        <span className="msg-name">{m.name ?? 'unknown'}</span>
        <span className="msg-src">{m.src}</span>
        <span className="msg-t">{m.t.toFixed(0)}ms</span>
      </div>
      {hasLeftover && <div className="msg-warn">unparsed: {m.leftover}</div>}
      <Fields fields={m.fields} />
    </li>
  )
}

export function DebugLog() {
  const frameCount = useSessionStore((s) => s.frameCount)
  const messages = useSessionStore((s) => s.messages)

  const [autoScroll, setAutoScroll] = useState(true)
  const [hex, setHex] = useState('')
  const [sendError, setSendError] = useState<string | undefined>(undefined)
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)

  // Newest-first: keep the top (newest) in view when auto-scroll is on.
  useEffect(() => {
    if (autoScroll && listRef.current !== null) listRef.current.scrollTop = 0
  }, [messages, autoScroll])

  const onSend = async () => {
    const value = hex.trim()
    if (value === '') return
    setSending(true)
    setSendError(undefined)
    try {
      await controller.sendManualCommandHex(value)
      setHex('')
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="debug">
      <div className="debug-bar">
        <span className="debug-frames">
          frames <strong>{frameCount}</strong>
        </span>
        <span className="debug-count">
          messages <strong>{messages.length}</strong>
        </span>
        <label className="debug-autoscroll">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          auto-scroll
        </label>
      </div>

      <form
        className="debug-send"
        onSubmit={(e) => {
          e.preventDefault()
          void onSend()
        }}
      >
        <input
          className="debug-hex"
          type="text"
          inputMode="text"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="Send command (hex) e.g. ff 05 01"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
        />
        <button type="submit" className="btn btn-ghost" disabled={sending || hex.trim() === ''}>
          Send
        </button>
      </form>
      {sendError !== undefined && (
        <div className="debug-error" role="alert">
          {sendError}
        </div>
      )}

      <ul className="msg-list" ref={listRef}>
        {messages.length === 0 ? (
          <li className="msg-empty">No messages yet — connect to start decoding.</li>
        ) : (
          messages
            .slice()
            .reverse()
            .map((m, i) => <MessageRow key={`${m.t}-${m.msgId ?? 'x'}-${i}`} m={m} />)
        )}
      </ul>
    </div>
  )
}

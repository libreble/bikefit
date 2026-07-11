/**
 * One device's Web Bluetooth lifecycle: request (user gesture) → connect → resolve services,
 * with auto-reconnect (capped backoff) on `gattserverdisconnected` — no new gesture needed
 * within a session. Protocol-agnostic: it just hands a connected GATT server to `onReady`,
 * which (re)attaches an adapter. On reconnect the characteristic objects are new, so `onReady`
 * runs again to re-subscribe.
 */

import type { ConnStatus } from '../store/useSessionStore'
import { REQUEST_DEVICE_OPTIONS } from './constants'

interface BleConnectionOpts {
  onReady: (server: BluetoothRemoteGATTServer, device: BluetoothDevice) => Promise<void>
  onStatus: (status: ConnStatus, error?: string) => void
}

const BACKOFF_MIN = 250
const BACKOFF_MAX = 4000

export class BleConnection {
  private device: BluetoothDevice | null = null
  private shouldReconnect = false
  private backoff = BACKOFF_MIN
  private readonly opts: BleConnectionOpts

  constructor(opts: BleConnectionOpts) {
    this.opts = opts
  }

  /** Prompt for a device (must be called from a user gesture) and connect. */
  async connect(): Promise<void> {
    this.opts.onStatus('requesting')
    const device = await navigator.bluetooth.requestDevice(REQUEST_DEVICE_OPTIONS)
    this.device = device
    device.addEventListener('gattserverdisconnected', this.handleDisconnect)
    this.shouldReconnect = true
    await this.open()
  }

  private async open(): Promise<void> {
    const gatt = this.device?.gatt
    if (!this.device || !gatt) throw new Error('device has no GATT server')
    this.opts.onStatus('connecting')
    const server = await gatt.connect()
    this.backoff = BACKOFF_MIN
    this.opts.onStatus('connected')
    await this.opts.onReady(server, this.device)
  }

  private handleDisconnect = (): void => {
    if (!this.shouldReconnect) {
      this.opts.onStatus('disconnected')
      return
    }
    this.opts.onStatus('reconnecting')
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    const delay = this.backoff
    this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX)
    window.setTimeout(() => {
      if (!this.shouldReconnect) return
      this.open().catch((e) => {
        console.warn('[ble] reconnect failed, retrying', e)
        this.scheduleReconnect()
      })
    }, delay)
  }

  /** Intentional teardown — stops reconnect and drops the link. */
  disconnect(): void {
    this.shouldReconnect = false
    this.device?.removeEventListener('gattserverdisconnected', this.handleDisconnect)
    try {
      this.device?.gatt?.disconnect()
    } finally {
      this.opts.onStatus('disconnected')
    }
  }
}

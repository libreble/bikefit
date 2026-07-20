/**
 * Demo bike — a TrainerAdapter with no BLE behind it. On start() it drives a synthetic ride
 * ({@link DemoRide}) on a 1 Hz timer and, each tick, emits a paired LIVE + AGGREGATED frame exactly
 * as an IC-6 does (PROGRESS.md: the real bike pushes them paired at ~1 Hz). Frames are real ICG
 * bytes run through the same {@link decodeIcgMessage} path as hardware, so the whole downstream —
 * tiles, graphs, debug log, summary, export — exercises the production pipeline unchanged. Lets us
 * check UI without a bike. Reads the saved profile so FTP-relative numbers match the rider.
 */

import type { AdapterEvents, Clock, DeviceInfo, TrainerAdapter } from '../types'
import { ICG_MSG, decodeIcgMessage } from '../decode/icgMessages'
import { bytesToHex } from '../util/hex'
import { loadProfile } from '../profile/profile'
import { DemoRide } from './ride'
import { encodeAggPayload, encodeLivePayload } from './synthFrames'

const TICK_MS = 1000

export class DemoAdapter implements TrainerAdapter {
  readonly protocol = 'icg'

  private timer: ReturnType<typeof setInterval> | null = null
  private events: AdapterEvents | null = null
  private now: Clock = () => 0
  private readonly ride: DemoRide

  constructor() {
    const p = loadProfile()
    this.ride = new DemoRide(p?.ftpW ?? 200, p?.weightKg ?? 75, p?.maxHr ?? 185)
  }

  deviceInfo(): DeviceInfo {
    return { name: 'DEMO BIKE', id: 'demo', model: 'IC6 (demo)' }
  }

  async start(events: AdapterEvents, now: Clock): Promise<void> {
    this.events = events
    this.now = now
    this.tick() // emit an immediate first frame so tiles populate without a 1 s wait
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  async stop(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** A demo bike ignores commands; log it so the debug "send command" box doesn't error. */
  async sendCommand(bytes: Uint8Array): Promise<void> {
    console.info('[demo] ignored command', bytesToHex(bytes))
  }

  private tick(): void {
    const events = this.events
    if (!events) return
    const { live, agg } = this.ride.step(1)
    const t = this.now()
    this.emitFrame(events, ICG_MSG.LIVE_STREAM, encodeLivePayload(live), t)
    this.emitFrame(events, ICG_MSG.AGGREGATED_STREAM, encodeAggPayload(agg), t)
  }

  /** Mirror IcgUartAdapter's frame path: decode the payload, then emit message + sample. */
  private emitFrame(events: AdapterEvents, msgId: number, payload: Uint8Array, t: number): void {
    const { message, sample } = decodeIcgMessage(msgId, payload, t)
    events.onMessage(message)
    if (sample) events.onSample(sample)
  }
}

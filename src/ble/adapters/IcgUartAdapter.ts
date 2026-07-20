/**
 * ICG Nordic-UART adapter (our v1 target, IC-6). Subscribes to the TX characteristic, feeds
 * raw bytes to the framer, decodes each reassembled message, and emits raw + message + sample
 * events. Writes to RX for commands. See PROTOCOL.md.
 *
 * Open question (PROTOCOL.md §9): whether the bike streams on its own once notifications are
 * enabled, or needs a trigger. We rely on push, auto-answer the low-risk phone-name request,
 * and expose `sendCommand` so the debug panel can poke it manually at the bike.
 */

import type { AdapterEvents, Clock, DeviceInfo, TrainerAdapter } from '../../types'
import { ICG_RX_CHAR, ICG_SERVICE, ICG_TX_CHAR } from '../constants'
import { IcgFramer, type IcgFrame } from '../../decode/icgFramer'
import { decodeIcgMessage, ICG_MSG } from '../../decode/icgMessages'
import { encodeIcgFrame, encodeIcgAllUserData, type IcgUserData } from '../../decode/icgEncoder'
import { bytesToHex } from '../../util/hex'

export class IcgUartAdapter implements TrainerAdapter {
  readonly protocol = 'icg'

  private txChar: BluetoothRemoteGATTCharacteristic | null = null
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null
  private framer: IcgFramer | null = null
  private events: AdapterEvents | null = null
  private now: Clock = () => 0
  private readonly server: BluetoothRemoteGATTServer
  private readonly info: DeviceInfo
  /** Rider profile provider for the GET_ALL_USER_DATA reply; returns null → stay silent (opt-in). */
  private readonly getUserData: () => IcgUserData | null

  constructor(
    server: BluetoothRemoteGATTServer,
    device: BluetoothDevice,
    getUserData: () => IcgUserData | null = () => null,
  ) {
    this.server = server
    this.info = device.name ? { name: device.name, id: device.id } : { id: device.id }
    this.getUserData = getUserData
  }

  deviceInfo(): DeviceInfo {
    return this.info
  }

  async start(events: AdapterEvents, now: Clock): Promise<void> {
    this.events = events
    this.now = now
    this.framer = new IcgFramer(this.handleFrame, (reason) =>
      console.warn('[icg] framing error:', reason),
    )

    const service = await this.server.getPrimaryService(ICG_SERVICE)
    this.txChar = await service.getCharacteristic(ICG_TX_CHAR)
    this.rxChar = await service.getCharacteristic(ICG_RX_CHAR)

    this.txChar.addEventListener('characteristicvaluechanged', this.handleNotify)
    await this.txChar.startNotifications()
  }

  async stop(): Promise<void> {
    const tx = this.txChar
    if (!tx) return
    tx.removeEventListener('characteristicvaluechanged', this.handleNotify)
    try {
      await tx.stopNotifications()
    } catch (e) {
      console.warn('[icg] stopNotifications failed', e)
    }
  }

  async sendCommand(bytes: Uint8Array): Promise<void> {
    const rx = this.rxChar
    if (!rx) throw new Error('not connected')
    // The app writes without response (type "noResponse"); fall back if unsupported.
    if (rx.writeValueWithoutResponse) await rx.writeValueWithoutResponse(bytes as BufferSource)
    else await rx.writeValue(bytes as BufferSource)
  }

  private handleNotify = (event: Event): void => {
    const char = event.target as BluetoothRemoteGATTCharacteristic
    const value = char.value
    if (!value || !this.events || !this.framer) return
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    this.events.onRaw(bytesToHex(bytes))
    this.framer.push(bytes)
  }

  private handleFrame = (frame: IcgFrame): void => {
    if (!this.events) return
    const { message, sample } = decodeIcgMessage(frame.msgId, frame.data, this.now())
    this.events.onMessage(message)
    if (sample) this.events.onSample(sample)
    this.autoRespond(frame.msgId)
  }

  /** Mirror the official app's handshake replies (PROTOCOL.md §8a). Nothing that could wedge the bike. */
  private autoRespond(msgId: number): void {
    if (msgId === ICG_MSG.GET_PHONE_NAME) {
      const name = new TextEncoder().encode('Bikefit')
      void this.sendCommand(encodeIcgFrame(ICG_MSG.SET_PHONE_NAME, name)).catch((e) =>
        console.warn('[icg] phone-name reply failed', e),
      )
      return
    }
    if (msgId === ICG_MSG.GET_ALL_USER_DATA) {
      // Opt-in: only answer if the rider saved a profile. No profile → stay silent and the bike
      // keeps its own defaults (no Coach-By-Color, bike-default FTP).
      const user = this.getUserData()
      if (!user) return
      void this.sendCommand(encodeIcgAllUserData(user)).catch((e) =>
        console.warn('[icg] user-data reply failed', e),
      )
    }
  }
}

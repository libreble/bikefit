/**
 * Protocol detection: after connecting, inspect the device's actual primary services and pick
 * an adapter, preferring the richest native protocol. Web Bluetooth can't probe an unpicked
 * device, so this runs post-connect. Only ICG is wired in v1; FTMS/CPS are the next adapters
 * and slot in here without touching anything downstream.
 */

import type { TrainerAdapter } from '../types'
import { ICG_SERVICE } from './constants'
import { IcgUartAdapter } from './adapters/IcgUartAdapter'

export interface DetectResult {
  adapter: TrainerAdapter
  /** The device's primary service UUIDs actually present (diagnostic; helps confirm/tighten the filter). */
  services: string[]
}

export async function detect(
  server: BluetoothRemoteGATTServer,
  device: BluetoothDevice,
): Promise<DetectResult> {
  const services = await server.getPrimaryServices()
  const uuids = services.map((s) => s.uuid)
  const has = (uuid: string | number): boolean => uuids.includes(BluetoothUUID.getService(uuid))

  // Priority: ICG-UART > (future) FTMS > (future) CPS.
  if (has(ICG_SERVICE)) return { adapter: new IcgUartAdapter(server, device), services: uuids }

  throw new Error('No supported trainer service found. Present: ' + uuids.join(', ') + '.')
}

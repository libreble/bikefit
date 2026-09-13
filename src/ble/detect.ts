/**
 * Protocol detection: after connecting, inspect the device's actual primary services and pick
 * an adapter, preferring the richest native protocol. Web Bluetooth can't probe an unpicked
 * device, so this runs post-connect. Only ICG is wired in v1; FTMS/CPS are the next adapters
 * and slot in here without touching anything downstream.
 */

import type { TrainerAdapter } from '../types'
import type { IcgUserData } from '../decode/icgEncoder'
import { t } from '../i18n/i18n'
import { ICG_SERVICE } from './constants'
import { IcgUartAdapter } from './adapters/IcgUartAdapter'

export interface DetectResult {
  adapter: TrainerAdapter
  /** The device's primary service UUIDs actually present (diagnostic; helps confirm/tighten the filter). */
  services: string[]
}

export interface DetectOptions {
  /** Provider for the rider profile to answer GET_ALL_USER_DATA; returns null to stay silent. */
  getUserData?: () => IcgUserData | null
}

export async function detect(
  server: BluetoothRemoteGATTServer,
  device: BluetoothDevice,
  opts: DetectOptions = {},
): Promise<DetectResult> {
  const services = await server.getPrimaryServices()
  const uuids = services.map((s) => s.uuid)
  const has = (uuid: string | number): boolean => uuids.includes(BluetoothUUID.getService(uuid))

  // Priority: ICG-UART > (future) FTMS > (future) CPS.
  if (has(ICG_SERVICE)) {
    return { adapter: new IcgUartAdapter(server, device, opts.getUserData), services: uuids }
  }

  throw new Error(t('error.noTrainerService', { present: uuids.join(', ') }))
}

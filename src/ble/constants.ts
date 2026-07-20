/**
 * BLE UUIDs. ICG (our v1 target) speaks a proprietary framed protocol over the Nordic UART
 * Service — see PROTOCOL.md. The standard fitness services are listed so `requestDevice` can
 * surface FTMS/CPS bikes too and future adapters can read them; only ICG is wired in v1.
 */

/** Nordic UART Service — the ICG proprietary channel. */
export const ICG_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
/** Write commands here (app → bike). */
export const ICG_RX_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
/** Notifications arrive here (bike → app). */
export const ICG_TX_CHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'

/** Standard 16-bit services (numbers are valid Web Bluetooth UUIDs). */
export const FTMS_SERVICE = 0x1826
export const FTMS_INDOOR_BIKE_DATA = 0x2ad2
export const FTMS_CONTROL_POINT = 0x2ad9
export const CPS_SERVICE = 0x1818
export const CSC_SERVICE = 0x1816
export const HR_SERVICE = 0x180d
export const HR_MEASUREMENT = 0x2a37
export const DEVICE_INFO_SERVICE = 0x180a
export const FIRMWARE_REV_CHAR = 0x2a26
export const BATTERY_SERVICE = 0x180f
export const BATTERY_LEVEL_CHAR = 0x2a19
export const TX_POWER_SERVICE = 0x1804
export const GAP_SERVICE = 0x1800

/**
 * `requestDevice` options — a narrow net, mirroring how the official ICG app finds devices.
 *
 * We match on EITHER of two OR'd filters (a device shows if it satisfies either):
 *   1. `namePrefix: 'BIKE'` — the IC-6 broadcasts as "BIKE <number>" (field-confirmed, e.g.
 *      "BIKE 42"). This is the app's *production* strategy: its native scanner scans wide and then
 *      keeps devices whose name matches a known set (`isOneOfKnownDevices` → `indexOf("BIKE")`,
 *      "CBC-RWR", "IC5 UPDATE", …). It filters by NAME, not by service UUID — presumably because
 *      the 128-bit UART UUID isn't reliably in the advertisement. This is the route we trust.
 *   2. `services: [ICG_SERVICE]` — the app's *browser* fallback filters on exactly this UUID
 *      (`connectBrowserAPI`). A useful backstop if a unit's name differs but it does advertise the
 *      service. Harmless if the UUID isn't advertised (this clause simply won't match).
 *
 * We opened this to `acceptAllDevices` for the first gym session so an inaccurate filter couldn't
 * hide the bike; the ride confirmed the "BIKE ##" name and that `ICG_SERVICE` is present after
 * connect, so we can safely narrow. (We never captured `advertisedUuids` — watchAdvertisements is
 * unsupported in the gym browser — hence keeping the name filter as the primary, proven route.)
 *
 * `optionalServices` is what matters post-connect: Web Bluetooth blocks access to any service not
 * declared here (and this grant is independent of what was advertised or filtered on). It lists
 * everything any adapter might read; `detect.ts` picks the adapter from the services actually present.
 */
export const REQUEST_DEVICE_OPTIONS: RequestDeviceOptions = {
  filters: [{ namePrefix: 'BIKE' }, { services: [ICG_SERVICE] }],
  optionalServices: [
    ICG_SERVICE,
    FTMS_SERVICE,
    CPS_SERVICE,
    CSC_SERVICE,
    HR_SERVICE,
    DEVICE_INFO_SERVICE,
    BATTERY_SERVICE,
    TX_POWER_SERVICE,
    GAP_SERVICE,
  ],
}

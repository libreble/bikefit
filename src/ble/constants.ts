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
 * `requestDevice` options — deliberately a WIDE net.
 *
 * We use `acceptAllDevices` (show every nearby BLE device in the chooser) instead of `filters`.
 * Why: Web Bluetooth `filters` match only what a device puts in its *advertisement* packet, which
 * is size-limited — 128-bit UUIDs (like our Nordic-UART service) are often dropped from it. We
 * have not yet confirmed the IC-6 advertises that UUID, nor what name it broadcasts, so any filter
 * risks hiding the bike entirely ("walled"). A wide net can never do that; the price is a busier
 * chooser (you pick the bike by name). We tighten to a filter once we've seen, at the bike, what
 * it actually advertises.
 *
 * `optionalServices` is what matters post-connect: Web Bluetooth blocks access to any service not
 * declared here, and this grant is independent of what was advertised. It lists everything any
 * adapter reads; `detect.ts` then chooses the adapter from the services actually present.
 *
 * For reference, the official ICG app filters on ONLY `ICG_SERVICE` and lists these same services
 * in optionalServices (PROTOCOL.md §1) — so it relies on the bike advertising the UART UUID.
 */
export const REQUEST_DEVICE_OPTIONS: RequestDeviceOptions = {
  acceptAllDevices: true,
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

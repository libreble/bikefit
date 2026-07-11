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
 * `requestDevice` options. Filters (OR) surface ICG + FTMS + CPS bikes and Domyos-style names;
 * optionalServices lists everything any adapter may later read (Web Bluetooth blocks access to
 * services not declared here). Mirrors the ICG app's own Web Bluetooth call (PROTOCOL.md §1).
 */
export const REQUEST_DEVICE_OPTIONS: RequestDeviceOptions = {
  filters: [
    { services: [ICG_SERVICE] },
    { services: [FTMS_SERVICE] },
    { services: [CPS_SERVICE] },
    { namePrefix: 'CBC-' },
    { namePrefix: 'Domyos' },
  ],
  optionalServices: [
    ICG_SERVICE,
    ICG_RX_CHAR,
    ICG_TX_CHAR,
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

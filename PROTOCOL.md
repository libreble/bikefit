# ICG BLE Protocol — reverse-engineered from the official app

Source: **ICG Training** app `com.icg.teamicgapp` v4.1.1 (Life Fitness Europe GmbH),
an Angular + Capacitor app. All BLE logic is in the JS bundle
(`assets/public/main.*.js`, class `BluetoothService` / `BluetoothDataHandler`).
Because it's a web bundle, this is essentially the app's *source* for BLE — not guesses.

> **Headline:** the bike is **not** driven over the standard BLE fitness profiles.
> The app talks to it over a **proprietary framed protocol tunnelled through the
> Nordic UART Service**. Standard Cycling Power / Heart Rate / FTMS are **never used**
> by the app. PLAN.md's "default BLE fitness standard" assumption is wrong for the
> primary data path.

---

## 1. GATT services the app uses

Discovery filter (`navigator.bluetooth.requestDevice`, the app's own Web Bluetooth path):

```js
filters:        [{ services: ["6e400001-b5a3-f393-e0a9-e50e24dcca9e"] }]   // Nordic UART
optionalServices: [
  "00001804-…", "00002a07-…",   // Tx Power service + level
  "00002a26-…",                 // Firmware Revision String
  "0000180a-…",                 // Device Information
  "6e400001-…", "6e400002-…",   // Nordic UART service + RX char
  6144, 6168, 6166              // = 0x1800 GAP, 0x1818 Cycling Power, 0x1816 CSC
]
```

| UUID | Role in the app |
|---|---|
| `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | **Nordic UART Service** — the private ICG channel |
| `6e400002-…` (`RX_CHAR`) | **App → bike** commands. `writeValue`, type `noResponse` |
| `6e400003-…` (`TX_CHAR`) | **Bike → app** stream. `startNotifications` → `characteristicvaluechanged` |
| `00002902` | CCCD (enable notifications) |
| `0000180a` / `2a26` | Device Info / firmware string |
| `edef8ba9-79d6-4ace-a3c8-27dcd51d21ed` | Nordic **DFU** (firmware update) — not needed for logging |

**Note on 0x1818 / 0x1816:** the standard Cycling Power (`0x1818`) and Cycling Speed &
Cadence (`0x1816`) UUIDs appear in `optionalServices` (as decimals `6168`/`6166`) but
the app **never reads a characteristic from them**. Either leftover, or the bike also
advertises them for third-party apps (Zwift etc.). **Unconfirmed** — worth probing at the
bike; if they carry live data, they'd be a much simpler path than this protocol. FTMS
(`0x1826`) is **entirely absent** from the app.

Devices advertise the Nordic UART service; names are prefixed `CBC-` (Coach-By-Color;
the app maps `CBC-RWR` → "ROWER"). The app filters by **service**, not name.

---

## 2. Frame format (the "RxPatterns" codec)

Every message, both directions, is byte-framed and reassembled from the 20-byte UART
notification chunks by a state machine (`decodeRxData`). Multi-byte fields are **big-endian**.

```
┌──────┬──────┬────────┬─────────────┬──────────┬──────┐
│ SOF  │ LEN  │ MSG_ID │  DATA[N]    │ CHECKSUM │ EOF  │
│ 0xFF │      │        │             │          │ 0x55 │
└──────┴──────┴────────┴─────────────┴──────────┴──────┘
```

- `SOF` = `0xFF` (255), `EOF` = `0x55` (85).
- `LEN` = `N + 2`  (counts MSG_ID + the N data bytes + CHECKSUM). So `N = LEN - 2`.
- `CHECKSUM` = XOR of every byte from `LEN` through the last DATA byte
  (i.e. `LEN ^ MSG_ID ^ DATA[0] ^ … ^ DATA[N-1]`). **It's a plain XOR, not a real CRC**,
  despite the field being called `crc`.
- Bad checksum or wrong EOF → frame dropped, resync on next `0xFF`.

Reference decoder (matches the app, ready for the `decode/` layer):

```ts
const SOF = 0xff, EOF = 0x55;

/** Feed raw notification bytes; yields complete {msgId, data} frames. Stateful. */
export function makeIcgFramer(onFrame: (msgId: number, data: Uint8Array) => void) {
  let st = 0, len = 0, idx = 0, chk = 0, msgId = 0, buf = new Uint8Array(256);
  return (chunk: Uint8Array) => {
    for (const b of chunk) {
      switch (st) {
        case 0: if (b === SOF) { st = 1; len = idx = chk = 0; } break;      // wait SOF
        case 1: // LEN
          if (b !== 0 && b <= 256) { len = b; chk = b; st = 2; } else st = 0; break;
        case 2: msgId = b; chk ^= b; len -= 2;                               // MSG_ID (len now = N)
          if (len === 0) st = 4; else { idx = 0; st = 3; } break;
        case 3: buf[idx++] = b; chk ^= b; if (--len === 0) st = 4; break;    // DATA
        case 4: st = (b === chk) ? 5 : 0; break;                            // CHECKSUM
        case 5: if (b === EOF) onFrame(msgId, buf.slice(0, idx)); st = 0; break; // EOF
      }
    }
  };
}
```

---

## 3. Message IDs (`BLE_MSG_ID_*`)

The ones that matter for logging are **12** (live) and **13** (aggregated); **37** is IC8-only.

| id | name | direction | meaning |
|---:|---|---|---|
| 0 | NULL | — | no-op |
| 1 / 2 | GET/SET_ALL_USER_DATA | ↔ | bike asks app for user (weight, FTP, maxHR…); app replies |
| 3 | GENERAL_STREAM_DATA | → | (not implemented in app) |
| 4 / 5 | GET/SET_PHONE_NAME | ↔ | |
| 6–11 | WLAN SSID / PW / IP | ↔ | console Wi-Fi config |
| **12** | **SEND_ICG_LIVE_STREAM_DATA** | **bike → app** | **live telemetry, see §4** |
| **13** | **SEND_ICG_AGGREGATED_STREAM_DATA** | bike → app | rolling session aggregates, see §5 |
| 14 / 15 | GET/SET_FTP_TEST_RESULT | ↔ | FTP test |
| 16 | REQUEST_DISCONNECT | → | bike asks app to disconnect |
| 17–26 | ENTER_PROGRAM_MODE / FLASH_PAGE_* / CALL_APPLICATION / UPD_*_CHECKSUM | ↔ | **bootloader / firmware flashing** |
| 27 | SEND_ICG_POWER_TEST_STREAM_DATA | → | live data during FTP test (see §6) |
| 28 | REQUEST_WIFI_RESTART | → | |
| 33 | FIRMWARE_VERSIONS | → | firmware version strings |
| 34 / 35 | SET/GET_BIKE_ID | ↔ | |
| **37** | **SEND_IC8_PEDALLING_SYMMETRY_DATA** | bike → app | **IC8-only** left/right balance (see §7) |
| 38 / 39 | GET/SET_SERIAL_NUMBER | ↔ | |
| 40 / 41 | GET/SET_TRAINING_MODE | ↔ | |
| 42 / 43 | GET/SET_BIKE_TYPE | ↔ | 1 byte identifying model |
| 44 | SET_UPDATE_URL | ← | |
| 45 / 46 | GET/SET_HALO_SERVER | ↔ | |
| 47 / 48 | GET/SET_FILE_SIZE | ↔ | |
| 49 | GET_BOOTLOADER_VERSION_NO | → | |

The bike appears to **push** msg 12/13 once notifications are enabled; the app is mostly
reactive (it answers GET_ALL_USER_DATA / GET_PHONE_NAME). **Unconfirmed whether streaming
auto-starts or needs a kick** (e.g. SET_TRAINING_MODE / SET_ALL_USER_DATA) — test at the bike.

---

## 4. Live telemetry — msg id 12 (`decodeIcgLiveStreamData`)

Big-endian. `DATA` payload is ~29 bytes. This is the core frame to log.

| off | type | field | scaling / units |
|---:|---|---|---|
| 0  | int16 | `power` | watts |
| 2  | int16 | `ftpPercent` | % of FTP (scaling TBC) |
| 4  | uint8 | `trainingZone` | Coach-By-Color zone index |
| 5  | uint8 | `heartRate` | bpm (0 = none) — **HR is relayed by the bike** |
| 6  | uint8 | `hrPercentOfMax` | % |
| 7  | uint8 | `powerToHrRatio` | byte / 10 |
| 8  | uint8 | `powerToWeightRatio` | byte / 10 (W/kg) |
| 9  | uint8 | `cadence` | rpm |
| 10 | int16 | `speed` | value / 10 (km/h) |
| 12 | uint8 | `brakeLevel` | **resistance / gear** (0–?) |
| 13 | uint8 | `currentLap` | |
| 14 | int32 | `currentLapTime` | (s or ms — TBC) |
| 18 | int16 | `currentLapDistance` | value / 10 |
| 20 | uint8 | `totalLaps` | |
| 21 | int32 | `workoutTime` | elapsed (s — TBC) |
| 25 | int16 | `distance` | value / 10 (km) |
| 27 | int16 | `calories` | kcal |

```ts
const be16 = (d: DataView, o: number) => d.getInt16(o, false);
const be32 = (d: DataView, o: number) => d.getInt32(o, false);

export function decodeIcgLive(data: Uint8Array) {
  const d = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    power: be16(d, 0),
    ftpPercent: be16(d, 2),
    trainingZone: data[4],
    heartRate: data[5],
    hrPercentOfMax: data[6],
    powerToHrRatio: data[7] / 10,
    powerToWeightRatio: data[8] / 10,
    cadence: data[9],
    speedKmh: be16(d, 10) / 10,
    brakeLevel: data[12],
    currentLap: data[13],
    currentLapTime: be32(d, 14),
    currentLapDistance: be16(d, 18) / 10,
    totalLaps: data[20],
    workoutTime: be32(d, 21),
    distanceKm: be16(d, 25) / 10,
    calories: be16(d, 27),
  };
}
```

---

## 5. Aggregated session data — msg id 13 (`decodeIcgAggregatedData`)

Bike-computed session summary (the app also recomputes its own). Fields:
`powerAvg, powerMax, powerToHrAvg, powerToWeightAvg, calories, hrAvg, hrMax, cadenceAvg,
cadenceMax, distance, speedAvg, speedMax, intensityFactor, trainingStressScore,
timeInZone[5], percentInZone[5], distanceInZone[5], caloriesInZone[5], timeInAllZones[10], ep`.

- **Coach-By-Color = 5 zones** (White, Blue, Green, Yellow, Red) → the `*InZone[5]` arrays.
  `timeInAllZones[10]` is a finer 10-bucket split the app folds into the 5 colors.
- **IF and TSS are provided by the bike** (`intensityFactor`, `trainingStressScore`), and
  `ep` = "effort points". So PLAN.md §8's IF/TSS can be taken from the bike or recomputed.

Byte offsets (big-endian; `/10` = `rescaleWordToFloat`, `byte/10` = `rescaleByteToFloat`):
`powerAvg int16@0, powerMax int16@2, powerToHrAvg b@4/10, powerToWeightAvg b@5/10,
calories int16@6, hrAvg b@8, hrMax b@9, cadenceAvg b@10, cadenceMax b@11,
distance @12/10, speedAvg @14/10, speedMax @16/10, intensityFactor @18/10,
trainingStressScore @20/10, timeInZone[5]=int16@22,24,26,28,30,
percentInZone[5]=b@32..36, distanceInZone[5]=(@37,39,41,43,45)/10,
caloriesInZone[5]=int16@47,49,51,53,55, ep=int16@57/10`.

---

## 6. FTP-test stream — msg id 27 (`decodeIcgPowerTestStreamData`)

Fields: `powerAvg int16@0, power int16@2, cadence b@4, brakeLevel b@5, currentRamp b@6,
heartRate b@7`. (If `power==0` but `powerAvg!=0`, app substitutes avg.)

## 7. Pedalling symmetry — msg id 37 (`decodeIcgPedallingData`) — **IC8 only**

4 bytes → left/right power percentages (`leftPowerPercentageAvg`, `rightPowerPercentageAvg`).
The message name is literally `SEND_IC8_PEDALLING_SYMMETRY_DATA`. **This is gated to the
IC8** and is a *separate* message — it is **not** in the IC6 live stream. So an IC6 will
almost certainly give you **no left/right balance**.

---

## 8. Answers to PLAN.md §11 open questions

1. **Standard CPS 0x1818 / cadence?** The app doesn't use standard CPS at all. **Cadence
   is available** — via the proprietary live stream (byte 9, rpm). Whether the bike *also*
   exposes a real `0x1818` is unconfirmed (listed but unused); probe at the bike.
2. **Pedal power balance on IC6?** No. Balance is an **IC8-only** message (id 37). IC6/IC7
   don't send it. (Plan guessed IC7 — it's actually IC8.)
3. **HR ownership / rebroadcast?** The **bike relays HR** inside the live stream (bytes 5–6).
   The app never opens a standard `0x180d` connection. So the PWA can get HR "for free" from
   the bike stream (strap paired to the console), *or* connect a strap directly over standard
   HRS — but if the console has claimed the strap, a direct second connection may conflict.
4. **Private ICG service?** **Yes — this whole protocol.** Nordic UART `6e400001…` carries a
   framed command/telemetry protocol (§2–§7), plus Nordic DFU for firmware.
5. **FTMS 0x1826 absent?** Absent from the app. Consistent with the manual-brake assumption.
   Still worth a scan at the bike in case it advertises FTMS independently for 3rd-party apps.

---

## 9. Impact on the plan

- The **core decoder is the ICG UART framer + `decodeIcgLive`** (§2, §4), *not* CPS/HR
  flag-walkers. Keep the "raw hex + parsed" persistence idea — even more valuable here.
- One connection to the bike yields power, cadence, HR, speed, resistance, distance,
  calories, laps, zone, IF/TSS — richer than the standard-profile plan assumed.
- Web Bluetooth works: the app itself uses `navigator.bluetooth` with the Nordic UART
  service in `filters`. The PWA must list `6e400001-b5a3-f393-e0a9-e50e24dcca9e` (and the
  optional services above) in `requestDevice`.
- **Still to confirm at the bike:** does streaming auto-start or need a trigger message;
  exact units for lapTime/workoutTime/ftpPercent/brakeLevel; whether standard 0x1818/0x1816
  are also live. Everything else here is read straight from the app.

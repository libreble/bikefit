# ICG IC-6 BLE Protocol

How the ICG IC-6 indoor bike (Life Fitness / ICG) exposes live and session data over Bluetooth
Low Energy, written so you can build your own client without the vendor app or an account.

> **Status / scope.** Documented from observed traffic with a real IC-6 and validated on
> hardware: connect, live stream, aggregated totals, the user-data handshake and the
> Coach-By-Color activation all work as described. Anything not yet checked on a real bike is
> marked **unconfirmed**. IC-8-specific messages are noted but not tested. Treat this as a
> field guide, not a vendor spec — corrections welcome.

> **Headline:** the bike is **not** driven over the standard BLE fitness profiles. It speaks a
> **proprietary framed protocol tunnelled through the Nordic UART Service**. Standard Cycling
> Power / Heart Rate / FTMS play no part in the primary data path.

This repo's reference implementation: [`src/decode/icgFramer.ts`](./src/decode/icgFramer.ts)
(framing), [`src/decode/icgMessages.ts`](./src/decode/icgMessages.ts) (message ids + decoders),
[`src/decode/icgEncoder.ts`](./src/decode/icgEncoder.ts) (outbound frames),
[`src/ble/adapters/IcgUartAdapter.ts`](./src/ble/adapters/IcgUartAdapter.ts) (transport +
handshake).

---

## 1. GATT layer

**Advertising / discovery.** The IC-6 advertises as **`BIKE <number>`** (field-confirmed, e.g.
"BIKE 42"). Other ICG products use other prefixes (e.g. `CBC-…`). The 128-bit UART service UUID
is **not reliably present in the advertisement**, so a name filter is the proven route and a
service filter only a backstop:

```js
navigator.bluetooth.requestDevice({
  filters: [{ namePrefix: 'BIKE' }, { services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] }],
  optionalServices: [
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART — everything below
    0x180a, 0x1804, 0x1800,                  // Device Info, Tx Power, GAP
    0x1818, 0x1816,                          // Cycling Power / CSC — see note
  ],
})
```

| UUID | Role |
|---|---|
| `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | **Nordic UART Service** — the private ICG channel |
| `6e400002-…` (RX) | **client → bike** commands. `writeValue` without response |
| `6e400003-…` (TX) | **bike → client** stream. `startNotifications` → `characteristicvaluechanged` |
| `00002902` | CCCD (enable notifications) |
| `0000180a` / `2a26` | Device Information / Firmware Revision String |
| `edef8ba9-79d6-4ace-a3c8-27dcd51d21ed` | Nordic **DFU** (firmware update) — not needed for logging |

**Note on 0x1818 / 0x1816.** Whether the bike also serves real Cycling Power (`0x1818`) or
Cycling Speed & Cadence (`0x1816`) characteristics for third-party apps is **unconfirmed**; they
are not needed — everything is in the UART stream. FTMS (`0x1826`) has not been observed.

**Streaming auto-starts.** Once notifications on TX are enabled the bike pushes live data with
no trigger command (field-confirmed). It also sends a `GET_ALL_USER_DATA` request at ~0.3 s
after connect that you should answer (§8) — otherwise the bike's zone features stay off.

---

## 2. Frame format

Every message, both directions, is byte-framed and must be reassembled from the 20-byte UART
notification chunks (a frame can span chunks, and a chunk can hold parts of two frames).
Multi-byte fields are **big-endian**.

```
┌──────┬──────┬────────┬─────────────┬──────────┬──────┐
│ SOF  │ LEN  │ MSG_ID │  DATA[N]    │ CHECKSUM │ EOF  │
│ 0xFF │      │        │             │          │ 0x55 │
└──────┴──────┴────────┴─────────────┴──────────┴──────┘
```

- `SOF` = `0xFF`, `EOF` = `0x55`.
- `LEN` = `N + 2` (counts MSG_ID + the N data bytes + CHECKSUM). So `N = LEN − 2`.
- `CHECKSUM` = XOR of every byte from `LEN` through the last DATA byte
  (`LEN ^ MSG_ID ^ DATA[0] ^ … ^ DATA[N−1]`). A plain XOR, not a CRC.
- Bad checksum or wrong EOF → drop the frame and resync on the next `0xFF`.

Reference reassembler (the one in `src/decode/icgFramer.ts`, condensed):

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

Validated against a full gym ride: 524 raw notifications → 176 messages, zero checksum
failures, only msg ids 12, 13 and 1 seen.

---

## 3. Message IDs

The ones that matter for logging are **12** (live) and **13** (aggregated); **37** is IC-8 only.
Names follow `ICG_MSG` in `src/decode/icgMessages.ts`.

| id | name | direction | meaning |
|---:|---|---|---|
| 0 | NULL | — | no-op |
| 1 / 2 | GET/SET_ALL_USER_DATA | ↔ | bike asks for the rider profile (weight, FTP, max HR…); client replies — §8 |
| 3 | GENERAL_STREAM_DATA | → | unused |
| 4 / 5 | GET/SET_PHONE_NAME | ↔ | bike asks for a client name; reply with any short string |
| 6–11 | WLAN SSID / PW / IP | ↔ | console Wi-Fi config |
| **12** | **LIVE_STREAM** | **bike → client** | **live telemetry, §4** |
| **13** | **AGGREGATED_STREAM** | bike → client | rolling session totals, §5 |
| 14 / 15 | GET/SET_FTP_TEST_RESULT | ↔ | FTP test |
| 16 | REQUEST_DISCONNECT | → | bike asks the client to disconnect |
| 17–26 | ENTER_PROGRAM_MODE / FLASH_PAGE_* / CALL_APPLICATION / UPD_*_CHECKSUM | ↔ | **bootloader / firmware flashing — never send** |
| 27 | POWER_TEST_STREAM | → | live data during an FTP test, §6 |
| 28 | REQUEST_WIFI_RESTART | → | |
| 33 | FIRMWARE_VERSIONS | → | firmware version strings |
| 34 / 35 | SET/GET_BIKE_ID | ↔ | |
| **37** | **IC8_PEDALLING_SYMMETRY** | bike → client | **IC-8 only** left/right balance, §7 |
| 38 / 39 | GET/SET_SERIAL_NUMBER | ↔ | |
| 40 / 41 | GET/SET_TRAINING_MODE | ↔ | |
| 42 / 43 | GET/SET_BIKE_TYPE | ↔ | 1 byte identifying the model |
| 44 | SET_UPDATE_URL | ← | |
| 45 / 46 | GET/SET_HALO_SERVER | ↔ | |
| 47 / 48 | GET/SET_FILE_SIZE | ↔ | |
| 49 | GET_BOOTLOADER_VERSION_NO | → | |

The bike **pushes msg 12 and 13 as a pair about once per second** while pedalling (field-
confirmed); the client is otherwise reactive (answer msg 1 and msg 4 when they arrive).

---

## 4. Live telemetry — msg 12 (`decodeIcgLive`)

Big-endian, 29-byte payload. This is the core frame to log.

| off | type | field | scaling / units |
|---:|---|---|---|
| 0  | int16 | `power` | watts |
| 2  | int16 | `ftpPercent` | integer % of the FTP the bike holds (`round(power / FTP × 100)`) — confirmed |
| 4  | uint8 | `trainingZone` | Coach-By-Color zone index |
| 5  | uint8 | `heartRate` | bpm, 0 = no strap — **HR is relayed by the bike** from a strap paired to the console |
| 6  | uint8 | `hrPercentOfMax` | % |
| 7  | uint8 | `powerToHrRatio` | byte / 10 |
| 8  | uint8 | `powerToWeightRatio` | byte / 10 (W/kg) |
| 9  | uint8 | `cadence` | rpm |
| 10 | int16 | `speed` | value / 10 (km/h) |
| 12 | uint8 | `brakeLevel` | **resistance / gear** — observed 0–35 on an IC-6 |
| 13 | uint8 | `currentLap` | |
| 14 | int32 | `currentLapTime` | seconds (unconfirmed vs ms) |
| 18 | int16 | `currentLapDistance` | value / 10 |
| 20 | uint8 | `totalLaps` | |
| 21 | int32 | `workoutTime` | **active pedalling seconds, not wall time** (confirmed: 54 min over a 58 min ride) |
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

**Session state lives on the bike.** Totals keep accumulating across client disconnects and
reconnects (confirmed: a fresh connection resumed at 3344 s / 33.4 km / 743 kcal). A logger
that reconnects mid-ride sees the same running counters, not a reset.

---

## 5. Aggregated session data — msg 13 (`decodeIcgAggregated`)

Bike-computed running summary, 59-byte payload, big-endian. Fields:
`powerAvg, powerMax, powerToHrAvg, powerToWeightAvg, calories, hrAvg, hrMax, cadenceAvg,
cadenceMax, distance, speedAvg, speedMax, intensityFactor, trainingStressScore,
timeInZone[5], percentInZone[5], distanceInZone[5], caloriesInZone[5], ep`.

- **Coach-By-Color = 5 zones** (White, Blue, Green, Yellow, Red) → the `*InZone[5]` arrays.
- **IF and TSS are provided by the bike** (`intensityFactor`, `trainingStressScore`), plus
  `ep` = "effort points". They are computed from the **FTP the bike holds** (§8) — if you never
  send an FTP, the bike uses a default and IF/TSS come out inflated (observed: IF 1.3 / TSS 164
  with a ~160 W default against a stronger rider). Send the real FTP, or recompute from the
  logged power series.

Byte offsets (`/10` = int16 ÷ 10, `b/10` = byte ÷ 10):
`powerAvg int16@0, powerMax int16@2, powerToHrAvg b@4/10, powerToWeightAvg b@5/10,
calories int16@6, hrAvg b@8, hrMax b@9, cadenceAvg b@10, cadenceMax b@11,
distance @12/10, speedAvg @14/10, speedMax @16/10, intensityFactor @18/10,
trainingStressScore @20/10, timeInZone[5]=int16@22,24,26,28,30,
percentInZone[5]=b@32..36, distanceInZone[5]=(@37,39,41,43,45)/10,
caloriesInZone[5]=int16@47,49,51,53,55, ep=int16@57/10`.

---

## 6. FTP-test stream — msg 27

Fields: `powerAvg int16@0, power int16@2, cadence b@4, brakeLevel b@5, currentRamp b@6,
heartRate b@7`. (If `power == 0` but `powerAvg != 0`, treat `powerAvg` as the current value.)
Unconfirmed on hardware — no FTP test has been run through this client.

## 7. Pedalling symmetry — msg 37 — **IC-8 only**

4 bytes → left and right power-percentage averages.
This is a **separate, IC-8-only message** — it is not part of the IC-6 live stream, so an IC-6
gives you **no left/right balance**. Unconfirmed (no IC-8 tested).

---

## 8. User-data handshake — msg 1 / 2 — how to activate the bike

This is what makes the bike's **Coach-By-Color** front light and its FTP-based metrics work.

**Trigger (reactive).** About 0.3 s after connect the bike sends **`GET_ALL_USER_DATA`
(msg 1)**. Answer it with `SET_ALL_USER_DATA` (msg 2). If you never answer, the bike never
receives FTP/weight → **Coach-By-Color never activates** even though the live stream (msg 12)
keeps flowing — msg 12 is FTP-independent. *Confirmed on hardware: with msg 1 ignored the
on-bike zones stayed dark; answering it lit them.*

**`SET_ALL_USER_DATA` (msg 2) payload — fixed 10 bytes**, big-endian:

| off | field | type | notes |
|---:|---|---|---|
| 0 | gender | u8 bit0 | cosmetic |
| 1 | age (years) | u8 | cosmetic; send 0 if unknown |
| 2 | weight | u8 (kg) | enables W/kg |
| 3 | fitness_level | u8 | cosmetic |
| 4–5 | **ftp_indoor** | **u16 BE (W)** | **the field that drives zones / IF / TSS** |
| 6 | heart_max_rate | u8 (bpm) | enables %HRmax |
| 7 | **colorMode** | u8 bit0 | 1 = enable Coach-By-Color (front light zones) |
| 8 | first-name initial | u8 | first char code; cosmetic (bike display) |
| 9 | surname initial | u8 | first char code; cosmetic |

Framed by §2: `FF 0C 02 <10 bytes> CHK 55` (LEN = 10 + 2 = 0x0C, msgId = 2, CHK = XOR of
LEN..last data byte). Implemented in `src/decode/icgEncoder.ts › encodeIcgAllUserData`.

**Without a login.** Only **ftp_indoor (4–5)** is needed for zones; weight → W/kg, maxHR →
%HRmax; the rest is cosmetic and can be 0. Set **colorMode (7) = 1** to light up the bike.

**Bonus:** the bike computes its aggregated IF/TSS/zones (§5) from *this* FTP, so answering
msg 1 with a correct FTP also makes msg 13 meaningful in real time. This client additionally
stores the power series so FTP can be corrected after the ride — something the bike's own
totals can't do.

**`GET_PHONE_NAME` (msg 4)** arrives alongside; reply with `SET_PHONE_NAME` (msg 5) carrying any
short ASCII string. Harmless to ignore, but answering keeps the console happy.

---

## 9. Open items (confirm on hardware)

- `currentLapTime` units (s vs ms) — only `workoutTime` (seconds, active pedalling) is confirmed.
- Whether standard `0x1818` / `0x1816` characteristics carry live data alongside the UART stream.
- Msg 27 (FTP test) and msg 37 (IC-8 symmetry) layouts — not exercised.
- HR relay (bytes 5–6) with a strap paired to the console — decodes cleanly but was 0 in every
  capture so far (no strap was paired).

---

*Unofficial and not affiliated with ICG or Life Fitness. Documented from observed traffic for
interoperability; no vendor code is included.*

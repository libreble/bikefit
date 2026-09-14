# Bikefit

**Open the app: <https://libreble.github.io/bikefit/>** — installable, works offline. Needs Chrome on
Android or Chrome/Edge on desktop (Web Bluetooth). No account, no cloud.

Part of [libreble](https://libreble.github.io) — your devices, set free.

Offline, account-less BLE fitness logger + live workout dashboard. **Target device: ICG IC-6.**
Local-first: no accounts, no cloud, no network calls at runtime — everything lives in the
browser (IndexedDB). Talks to the bike over the ICG proprietary Nordic-UART protocol
(documented in [`PROTOCOL.md`](./PROTOCOL.md)).

## Run it

Requires a Chromium browser (Web Bluetooth): desktop Chrome/Edge, or Android Chrome. **Not
iOS Safari.**

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

Web Bluetooth needs a *secure context*. `localhost` counts, so `pnpm dev` works offline with no
certificates. For a production-ish local build:

```bash
pnpm build          # -> dist/ (static files, relative paths)
pnpm preview        # serves dist/ on localhost
```

### Using it at the gym (no cloud)

- **Laptop with Bluetooth (simplest):** `pnpm dev` (or serve `dist/`), open `http://localhost`,
  tap **Connect**, pick the bike.
- **Android phone:** run the static `dist/` from a local server on the phone (e.g. Termux
  `python3 -m http.server`) so it's `localhost`, **or** whitelist a laptop's LAN URL in
  `chrome://flags#unsafely-treat-insecure-origin-as-secure`.

## What it does (v1)

- **Connect + auto-detect** the protocol (ICG wired; FTMS/CPS are the next adapters).
- **Live dashboard**: power / cadence / HR / speed tiles + sparkline graphs.
- **Debug logging** (the reason v1 exists): every raw BLE notification is captured to IndexedDB
  as hex, decoded best-effort, with an "unparsed bytes" flag when a guess looks wrong.
- **Save / export**: write a self-contained `SessionFile` JSON (metadata + raw frames + decoded
  + summary) to disk for later analysis; re-export past sessions from IndexedDB.

## Scripts

| script | does |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm build` | typecheck (`tsc -b`) + production build to `dist/` |
| `pnpm preview` | serve the built `dist/` |
| `pnpm typecheck` | types only |
| `pnpm lint` | oxlint |
| `pnpm format` | prettier write |

## Support

The app is free and stays that way. If you'd like to support the work anyway: a coffee on
[Ko-fi](https://ko-fi.com/mannes), or — honestly more useful — hardware. A device on the desk is
how it gets an app; if you have one you'd like liberated, say so in a
[device request](https://github.com/libreble/libreble.github.io/issues/new?template=device-request.yml).

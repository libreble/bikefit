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

## Self-host

The hosted app above is the easiest way. If you'd rather run your own copy, it's a static site —
nothing to configure, no backend, no database.

**Docker** — a prebuilt image (linux/amd64 + arm64) is published to the GitHub Container Registry:

```bash
docker run -d --name bikefit -p 8080:8080 --restart unless-stopped ghcr.io/libreble/bikefit
# → http://localhost:8080/
```

```yaml
# compose.yaml
services:
  bikefit:
    image: ghcr.io/libreble/bikefit:latest
    ports: ["8080:8080"]
    restart: unless-stopped
```

The image serves the app at `/`. To serve it under a subpath behind your own proxy, build it
yourself: `docker build --build-arg BASE_PATH=/bikefit/ -t bikefit .`

**Build and host it yourself** — any static web server works:

```bash
pnpm install --frozen-lockfile
pnpm build          # → dist/
# upload dist/ to nginx, Caddy, Netlify, Cloudflare Pages, a bucket, …
```

The build uses relative paths, so `dist/` works from any path as is. Serve `index.html` and
`sw.js` with `Cache-Control: no-cache` so updates reach installed copies.
[`docker/nginx.conf.template`](docker/nginx.conf.template) is a working nginx example.

> **HTTPS is required.** Web Bluetooth only works in a secure context. `http://localhost` counts,
> so the app works on the machine running it — but `http://192.168.x.x:8080` from your phone
> will load and then refuse to connect. For phones, put it behind TLS: a reverse proxy with a
> real certificate (Caddy does this automatically for a domain), or `tailscale serve`.

Self-hosted copies keep their `<link rel="canonical">` pointing at libreble.github.io, so
search engines don't treat them as duplicates.

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

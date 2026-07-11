# Progress log

Running status so anyone (incl. future me) can pick this up. Newest first.

## 2026-07-11 (overnight build, offline)

**Goal for this session:** first working version — a live workout dashboard (tiles + graphs)
for the ICG IC-6, plus the debug **logging** feature: capture every raw BLE notification and
save/export a session for later analysis even when we can't decode it live.

**Stack decision:** buildless dependency-free PWA (see DECISIONS.md). Runs offline, deploys to
GitHub Pages as static files.

### Status
- [x] Repo init (local, no remote — no GitHub by design)
- [x] Decision log + progress log + task list
- [x] Scaffold — **Vite + React 19 + TS** (stack pivot, see DECISIONS): build-time net is fine,
      "offline" = runtime/local-first. pnpm. No service worker in v1 (localhost serving).
- [x] Shared contract (types, BLE constants, zustand store, hex/time utils)
- [x] ICG protocol core (framer, messages, encoder) — **passed offline smoke-test**
      (reassembly across BLE chunks, field decode, checksum reject, short-frame)
- [x] Session capture (IndexedDB + recorder + exporter)
- [x] BLE layer (BleConnection + detect + IcgUartAdapter + wake lock)
- [x] Controller (connect → detect → adapter → recorder orchestration)
- [x] Dashboard UI + graphs + debug log panel (built by a subagent; reviewed — clean)
- [x] Controller recreated after a subagent race deleted it (its stub-cleanup `rm`'d my
      uncommitted `src/app/controller.ts`; lesson: commit hand-written files before fanning out
      agents that touch the same dir)
- [x] Integration green: `pnpm typecheck`, `pnpm lint` (oxlint), `pnpm build` all pass;
      `dist/` builds (~220 kB js / 9 kB css)

### Verification done / pending
- DONE offline: protocol core smoke-test (synthetic frame round-trips), typecheck, lint, build.
- PENDING (needs a browser / the bike): visual render check (browser extension was offline at
  build time) and the real BLE session on the IC-6 — the point of the whole exercise. When you
  run `pnpm dev` and open localhost, watch the browser console; then at the gym, tap Connect and
  watch the Debug/Log panel fill with frames.

### Notes / things to verify at the bike (IC-6)
- Does the live stream (msg id 12) auto-start on connect, or does it need a trigger written to
  RX? The adapter auto-responds to known bike requests and exposes a manual "send command" box
  in the debug panel as a fallback.
- Confirm units live: brakeLevel range, lapTime/workoutTime (s vs ms), ftpPercent scaling.
- Confirm the device shows up under the Nordic-UART service filter and the name prefix.

### How to run (once files exist)
Any static server over https/localhost, e.g. `python3 -m http.server 8000` then open
`http://localhost:8000/`. For the gym, deploy to GitHub Pages (HTTPS) — Web Bluetooth needs it.

# Progress log

Running status so anyone (incl. future me) can pick this up. Newest first.

## 2026-07-11 (overnight build, offline)

**Goal for this session:** first working version — a live workout dashboard (tiles + graphs)
for the ICG IC-6, plus the debug **logging** feature: capture every raw BLE notification and
save/export a session for later analysis even when we can't decode it live.

**Stack decision:** buildless dependency-free PWA (see DECISIONS.md). Runs offline, deploys to
GitHub Pages as static files.

### Status
- [x] Repo init (local, no remote yet — user adds remote tomorrow)
- [x] Decision log + progress log + task list
- [ ] Scaffold (index.html, manifest, sw)
- [ ] Shared contract (constants, types, store, utils)
- [ ] ICG protocol core (framer, messages, encoder) + node smoke-test
- [ ] Session capture (IndexedDB + recorder + exporter)
- [ ] BLE layer (connection + detect + ICG adapter + wake lock)
- [ ] Dashboard UI + graphs + debug log panel
- [ ] Integration + syntax check

### Notes / things to verify at the bike (IC-6)
- Does the live stream (msg id 12) auto-start on connect, or does it need a trigger written to
  RX? The adapter auto-responds to known bike requests and exposes a manual "send command" box
  in the debug panel as a fallback.
- Confirm units live: brakeLevel range, lapTime/workoutTime (s vs ms), ftpPercent scaling.
- Confirm the device shows up under the Nordic-UART service filter and the name prefix.

### How to run (once files exist)
Any static server over https/localhost, e.g. `python3 -m http.server 8000` then open
`http://localhost:8000/`. For the gym, deploy to GitHub Pages (HTTPS) — Web Bluetooth needs it.

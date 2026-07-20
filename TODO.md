# TODO — backlog

Lightweight, actionable queue. Deeper architecture lives in [`PLAN.md`](./PLAN.md), rationale in
[`DECISIONS.md`](./DECISIONS.md), the running log in [`PROGRESS.md`](./PROGRESS.md). Newest
priorities on top. Effort tags: **S** ≈ an hour, **M** ≈ a session, **L** ≈ multi-session.

---

## Top of queue (added 2026-07-21)

### 1. Streamline data storage + gate the big debug store — **M**
Two coupled problems in `src/session/recorder.ts`:

- **Redundant aggregated logging.** The bike pushes a *full* AGGREGATED_STREAM (msg 13) totals
  frame ~1×/s; we persist every one (`onRaw` → `addFrame`, `onMessage` → `addMessage`). An hour ride
  = ~3600 near-identical totals rows. Keep only the **latest** aggregated totals on the session
  record (or a low-rate sample), not the full repeated history. LIVE (msg 12) is the genuinely
  changing stream and can stay per-frame.
- **The lossless raw store should be opt-in.** Persisting every raw notification to IndexedDB is a
  *debug/RE* feature (the re-parse safety net, PLAN §1). For a normal ride we only need: live UI +
  the app-computed summary + (streamlined) totals. Only populate the full `frames`/`messages` stores
  when **debug/logging is enabled** (couples to #2). Default off → tiny sessions; on → today's
  lossless capture for protocol work.

Notes: the app-computed summary (`Accumulator` in recorder.ts) is derived from LIVE samples and is
independent of the bike's totals — that stays. See the storage explainer in this session / the
`SessionMeta.summary` vs repeated msg-13 distinction. Watch the export path (`exporter.ts`) and
`SessionFile` shape when raw frames may be absent.

### 2. Debug panel: move under "Advanced" (or remove) — **S** — *decision first*
Right now `DebugLog` is a top-level panel (`App.tsx`). Options: (a) tuck it behind an "Advanced"
disclosure, off by default; (b) remove from the shipped UI entirely. **Recommend (a)** — it's
invaluable for protocol work and the demo, just not for a normal rider. The "Advanced/debug on"
toggle is the same switch that gates the raw store in #1. If enabling it mid-session, decide whether
capture starts from that point or is all-or-nothing per session.

### 3. UI: average watts + above/below-average arrow — **S**
On the POWER hero tile (`LiveTiles.tsx`):
- Show **avg power** alongside the instantaneous number. Source: the bike's `powerAvg` in the
  AGGREGATED frame (already decoded, in `latest.extra`? — currently AGG doesn't emit a sample, so
  either surface it, or use our own running avg from `Accumulator`). Pick one source and be
  consistent.
- A **▲/▼ arrow** next to the power meter: current vs. average (▲ above, ▼ below, — within a small
  deadband). Cheap, high signal for pacing.

### 4. UI: customizable dashboard (pick what matters most) — **M/L**
Let the rider choose their priority metric(s) — power / HR / cadence / speed — and lay the dashboard
out around that (hero tile = chosen metric; reorder/show-hide secondary tiles). Persist the choice
to localStorage, same pattern as the rider profile (`src/profile/`). Likely a small `layout`/`prefs`
module + a settings surface (reuse the profile dialog, or a new one). Keep sensible defaults so it
works untouched.

### 5. Session history + seed — **M**
Partly exists: `controller.listPastSessions / exportPastSession / deletePastSession` + the "Past
sessions" panel (list, Refresh, export, delete). Flesh out into real history:
- **Open/review a past session** (summary + the graphs, replaying stored samples). Re-parse from
  stored frames where available.
- **Seed** sample sessions for development/testing — generate a few finished rides into IndexedDB
  (reuse `DemoRide` to synthesize a full ride fast, then write it as a session) so the history and
  its UI have content without needing real rides. *(Assumed meaning of "seed" — confirm.)*

### 6. Import / export to other apps (Strava et al.) — **L** — *decision first*
Today we export a self-contained JSON. To reach Strava / Golden Cheetah we need a standard format:
- **Export FIT (or TCX)** — indoor ride, no GPS, so FIT with power/HR/cadence/time is the right
  target (TCX also works; GPX is GPS-oriented, weaker fit). Reads from the same stored frames as the
  JSON exporter (`exporter.ts`). Listed in PLAN §10 Round 3.
- **Import** a previously-exported `SessionFile` JSON back into IndexedDB (round-trips our own data;
  also useful with the seed work in #5).
- **Decision:** file export the rider uploads themselves **vs.** Strava API OAuth upload. The
  offline/account-less north star (PLAN §North star) argues for **file export**, no accounts, no
  cloud. Note if we ever want direct upload it breaks that principle.

---

## Open decisions
- **#2** Debug panel: hide under Advanced (recommended) or remove?
- **#5** Does "seed" mean generating demo sessions into history? (assumed yes)
- **#6** Strava: standards-based file export (recommended, stays offline) or API upload?

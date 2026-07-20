# TODO — backlog

Lightweight, actionable queue. Deeper architecture lives in [`PLAN.md`](./PLAN.md), rationale in
[`DECISIONS.md`](./DECISIONS.md), the running log in [`PROGRESS.md`](./PROGRESS.md). Newest
priorities on top. Effort tags: **S** ≈ an hour, **M** ≈ a session, **L** ≈ multi-session.

---

## Top of queue (added 2026-07-21)

### ~~1. Streamline data storage + gate the big debug store~~ — **DONE 2026-07-21**
Went further than "gate": **removed** raw-frame capture entirely. IndexedDB v2 stores the decoded
LIVE time series (`samples`) + one AGGREGATED totals snapshot on the session record; `frames`/
`messages` stores dropped. Export is `SessionFile` v2. See DECISIONS.md (2026-07-21).

### ~~2. Debug panel: move under "Advanced" (or remove)~~ — **DONE 2026-07-21 (removed)**
Removed the Debug/Log panel + manual command sender + `onRaw` from the adapter contract and the
dead CSS. Decision was **remove**, not hide.

### ~~3. UI: average watts + above/below-average arrow~~ — **DONE 2026-07-21**
Hero tile shows the session average of its metric + a ▲/▼/▪ trend arrow (deadband). Generalized to
all instantaneous metrics via `store.avg` (power/cadence/hr/speed).

### ~~4. UI: customizable dashboard (pick what matters most)~~ — **DONE 2026-07-21**
`src/prefs/dashboard.ts` (localStorage) + a "Customize" dialog (`DashboardDialog`) to reorder metrics
(first shown = hero) and show/hide them; `LiveTiles` renders from the prefs.

### ~~5. Session history + seed~~ — **DONE 2026-07-21**
Clickable past-session rows open a review modal (`SessionReview`: summary stats + IF/TSS + sparklines
from stored samples). "Add demo session" seeds a finished 45-min ride into IndexedDB
(`src/demo/seed.ts`). "Seed" was confirmed as generating demo sessions into history.

### ~~6. Import / export to other apps (Strava et al.)~~ — **DONE 2026-07-21**
Chose standards-based **TCX** file export (offline, no Strava API) — `src/session/tcx.ts`, imports
into Strava / intervals.icu / TrainingPeaks / Golden Cheetah. Plus JSON import
(`src/session/importer.ts`, v2). **FIT export not done** — TCX covers the same apps; FIT is a later
"do it properly" option if a target needs it.

### ~~7. Routing: session history as bookmarkable pages~~ — **DONE 2026-07-21**
`react-router-dom` (HashRouter) → `/` live, `/sessions` history, `/sessions/:id` bookmarkable detail;
Live/History nav in the header. See DECISIONS.md (2026-07-21).

---

## Next up
- **FIT export** (binary, richer than TCX) — only if a target app needs it; TCX already reaches the
  main ones.
- **Live FTP-based zones / historical FTP recompute** — now unblocked (the stored sample series
  landed with the storage pivot); see DECISIONS.md (2026-07-12) "no live recompute".
- **Service-worker / true offline PWA** and tightening the device picker to a service filter
  (needs a real-bike confirmation first).

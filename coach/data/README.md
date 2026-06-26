# `data/` — the contract between automation, the web apps, and the coach agent

Everything here is plain files. The **fetcher** writes health/activity data, the
**gym-logger** writes gym sessions, and the **coach agent** reads all of it and
writes the plan + analysis. No database — these files *are* the database.

All writes are atomic (temp file + rename), so a reader never sees a half-written
file. Schemas live in [`lib/src/schema.ts`](../lib/src/schema.ts).

## Files

### `health/daily.csv` — written by fetcher
One row per `(date, source)`. Columns:

| column | meaning |
|---|---|
| `date` | `YYYY-MM-DD` |
| `source` | tracker name, e.g. `polar`, `garmin`, `ultrahuman` |
| `sleep_h` | hours of sleep |
| `sleep_score` | source's sleep score (0–100) |
| `hrv` | heart-rate variability (ms) |
| `resting_hr` | resting heart rate (bpm) |
| `recovery` | source recovery score |
| `readiness` | source readiness/body-battery score |
| `steps` | step count |
| `calories` | total calories |
| `weight_kg` | body weight |
| `notes` | free text |

Empty cell = not reported. Numbers are plain (no units).

### `activities/activities.csv` — written by fetcher
One row per workout, keyed by `id` (stable per source).

`id, date, start_time, sport, source, duration_min, distance_km, avg_hr, max_hr, calories, load, notes`

`sport` examples: `floorball`, `cycling`, `running`, `strength`. `load` is a
training-load / TRIMP value if the source provides one.

### `gym/sessions/<YYYY-MM-DD>.json` — written by gym-logger
Source of truth for a logged gym session (exercises → sets). See `GymSessionSchema`.

### `gym/log.csv` — derived from sessions (do not hand-edit)
Flat one-row-per-completed-set log, rebuilt automatically whenever a session is
saved: `date, session_id, exercise, set_no, reps, weight, rpe`.

### `plan/current.json` + `plan/current.md` — **written by the coach agent**
The current weekly plan. `current.json` is the machine-readable contract (see
`PlanSchema`); `current.md` is an optional human-readable mirror. The gym-logger
reads the gym sessions for "today" from here; the dashboard renders the week.

### `analysis/latest.md` — **written by the coach agent**
Free-form Markdown: the coach's latest analysis, observations and rationale for
plan changes. Rendered verbatim on the dashboard.

### `state/last_sync.json` — written by fetcher
Per-source bookkeeping: last run time, ok/error status, record counts. Powers the
dashboard's "sync status" widget.

### `raw/<source>/<YYYY-MM-DD>.json` — written by fetcher
Untouched MCP responses, kept as an audit trail so normalized data can be
re-derived if a mapper changes.

## For the coach agent

- **Read** `health/daily.csv`, `activities/activities.csv`, `gym/log.csv`,
  `gym/sessions/*.json` to understand training & recovery.
- **Write** `plan/current.json` (and optionally `plan/current.md`) to set the plan,
  and `analysis/latest.md` to explain it.
- After writing a plan, run `npm run validate-plan` to confirm it matches the schema.
- See [`AGENT.md`](../AGENT.md) for the full workflow.

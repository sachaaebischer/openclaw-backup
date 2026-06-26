# `data/` — the contract between automation, the web app, and the coach agent

Everything here is plain files. The **fetcher** writes health/activity data, the
**gym-logger** writes gym sessions, and the **coach agent** reads all of it and
writes the plan + analysis. No database — these files *are* the database.

All writes are atomic (temp file + rename), so a reader never sees a half-written
file. Schemas live in [`lib/src/schema.ts`](../../../../coach/lib/src/schema.ts).

## Files

### `health/daily.csv` — written by fetcher
One row per `(date, source)`. Multiple rows per date are normal (one per tracker).
The web dashboard merges them, preferring non-null values across sources.

| column | type | meaning |
|---|---|---|
| `date` | YYYY-MM-DD | calendar date |
| `source` | string | tracker name: `ultrahuman`, `polar`, `garmin`, `withings` |
| `sleep_h` | float | hours of sleep |
| `sleep_score` | 0–100 | source's sleep quality score |
| `hrv` | float (ms) | heart-rate variability |
| `resting_hr` | int (bpm) | resting heart rate |
| `recovery` | 0–100 | recovery / readiness score |
| `readiness` | 0–100 | alternative readiness (Ultrahuman) |
| `steps` | int | step count |
| `calories` | int | total calories burned |
| `active_minutes` | int | active minutes |
| `vo2_max` | float | VO2 max estimate (ml/kg/min) |
| `weight_kg` | float | body weight (from Withings scale) |
| `notes` | string | free text |

Empty cell = not reported by that source. Numbers have no unit suffix.

### `activities/activities.csv` — written by fetcher
One row per workout, keyed by `id` (stable per source — never duplicated).

| column | type | meaning |
|---|---|---|
| `id` | string | `source:unique_id`, e.g. `polar:abc123` |
| `date` | YYYY-MM-DD | workout date |
| `start_time` | HH:MM | local start time |
| `sport` | string | `floorball`, `cycling`, `running`, `gym`, `tennis`, `other` |
| `source` | string | tracker: `polar`, `garmin` |
| `duration_min` | int | duration in minutes |
| `distance_km` | float | distance (if applicable) |
| `avg_hr` | int (bpm) | average heart rate |
| `max_hr` | int (bpm) | max heart rate |
| `calories` | int | calories burned |
| `load` | float | training load / TRIMP score |
| `notes` | string | sport detail from tracker |

### `gym/sessions/<YYYY-MM-DD>.json` — written by gym-logger web app
One file per session. Schema: `GymSessionSchema` in `lib/src/schema.ts`.

```json
{
  "id": "2026-06-23-gym",
  "date": "2026-06-23",
  "name": "Gym — Upper",
  "started_at": "2026-06-23T09:14:00.000Z",
  "finished_at": "2026-06-23T10:32:00.000Z",
  "notes": "felt strong",
  "exercises": [
    {
      "name": "Bench Press Dumbbells",
      "target_sets": 4,
      "target_reps": "6",
      "notes": "seat flat, grip shoulder-width",
      "sets": [
        { "set_no": 1, "reps": 6, "weight": 32, "rpe": 6, "done": true },
        { "set_no": 2, "reps": 6, "weight": 34, "rpe": 7, "done": true }
      ]
    }
  ]
}
```

### `gym/log.csv` — rebuilt by gym-logger after every save
Flat per-set log aggregated from all session files. One row per completed set.

`date, session_id, exercise, set_no, reps, weight, rpe`

Used by the coach agent for progressive overload analysis.

### `gym/catalog.json` — written by /gym/exercises page in the web app
User's personal exercise library. Schema: `ExerciseCatalogSchema`.

```json
{
  "exercises": [
    {
      "name": "Bench Press Dumbbells",
      "notes": "4×6 @ 32kg. RPE 6-7. Rest 3min. Flat bench.",
      "default_sets": 4,
      "default_reps": "6",
      "default_weight": 32
    }
  ]
}
```

The gym logger reads this to pre-fill new sessions and show setup notes.

### `plan/current.json` — written by coach agent
The current weekly training plan. Schema: `PlanSchema` in `lib/src/schema.ts`.

```json
{
  "week_start": "2026-06-23",
  "generated_at": "2026-06-22T17:05:00Z",
  "notes": "Reintroduction week after 2-week break.",
  "days": [
    {
      "date": "2026-06-23",
      "weekday": "Monday",
      "sessions": [
        {
          "type": "gym",
          "title": "Gym — Upper (light)",
          "planned_at": "09:00",
          "duration_min": 60,
          "intensity": "moderate",
          "details": "5×3 @ 70% 1RM. Focus on form. Rest 3 min.",
          "exercises": [
            { "name": "Bench Press Dumbbells", "target_sets": 4, "target_reps": "6", "target_weight": 32, "notes": "" }
          ]
        }
      ]
    }
  ]
}
```

`type` values: `gym`, `floorball`, `bike`, `run`, `rest`, `other`.
`intensity` values: `easy`, `moderate`, `hard`.
`details` is shown in the dashboard when tapping a session card.

### `plan/current.md` — written by coach agent
Human-readable version of the plan. Shown in the dashboard's "Coach analysis" panel.

### `plan/constraints/<YYYY-MM-DD>.json` — written by /plan page in the web app
Fixed events the user has committed to for a given week. Week key = Monday's date.

```json
{
  "week_start": "2026-06-23",
  "fixed_events": [
    { "date": "2026-06-24", "type": "floorball", "title": "Floorball training", "time": "20:00", "notes": "" }
  ]
}
```

The coach agent reads this before planning and does not schedule conflicting sessions.

### `analysis/latest.md` — written by coach agent
Free-form analysis of current fitness state, trends, and recommendations.
Displayed verbatim in the dashboard.

### `state/last_sync.json` — written by fetcher after every run
Tracks sync status per source.

```json
{
  "last_run_at": "2026-06-26T06:30:00Z",
  "sources": {
    "ultrahuman": { "last_run_at": "...", "status": "ok", "error": "", "health_records": 5, "activity_records": 0 }
  }
}
```

### `state/summary.json` — written by fetcher's summarize step
Pre-computed 7-day and 28-day rollups (averages, total load, tonnage, volume).
The coach agent reads this for quick situational awareness.

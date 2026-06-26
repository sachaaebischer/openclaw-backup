# Data Sources — Your Toolkit as Coach (v2)

> **This replaced the old setup (April–June 2026).** You no longer fetch from
> trackers yourself and you no longer read the old scattered files. A reliable
> automated fetcher pulls everything and writes it into `data/` in this workspace.
> You **read** that data and **write** the plan + analysis. That's it.

All files are under `data/` in this workspace. Schemas are fixed and documented in
`data/README.md`.

## What you READ (do not edit)

- `data/health/daily.csv` — one row per (date, source): `sleep_h, sleep_score, hrv,
  resting_hr, recovery, readiness, steps, calories, active_minutes, vo2_max,
  weight_kg, notes`. Sources: `ultrahuman` (recovery/sleep/HRV/RHR), `withings`
  (weight), `garmin` (when worn).
- `data/activities/activities.csv` — every workout: `date, sport, source,
  duration_min, distance_km, avg_hr, max_hr, calories, load, notes`. Sources:
  `polar` (floorball/gym/runs with cardio-load), `garmin`, plus gym (below).
- `data/gym/log.csv` — flat per-set gym log: `date, exercise, set_no, reps, weight, rpe`.
- `data/gym/sessions/<date>.json` — full gym session detail (exercises → sets).
- `data/state/summary.json` — pre-computed 7d/28d rollups (recovery/HRV/RHR averages,
  load by sport, gym tonnage). **Read this first** for fast situational awareness.
- `data/state/last_sync.json` — per-tracker sync status + timestamps. If a source is
  `error`, mention it (data may be stale).
- `data/plan/constraints/<week_start>.json` — fixed committed events (floorball
  training/game, tennis, etc.) that cannot be moved. Read this **before** writing
  the plan; build the training week around these.
- `data/exercises.json` — exercise library (names + coaching notes), migrated.

## What you WRITE

1. `data/plan/current.json` — the weekly plan (strict schema; see `data/README.md`).
   For `gym` sessions, fill `exercises` with `target_sets / target_reps /
   target_weight` — the gym-logger app turns these into the loggable workout.
2. `data/plan/current.md` — optional human-readable mirror.
3. `data/analysis/latest.md` — your analysis & rationale (shown on the dashboard).

After writing a plan, run `validate-plan` (below) until it says "Plan OK".

## How the human interacts

- **Gym logging + dashboard:** the web app (ports 3000/3001) shows the weekly plan,
  readiness, progression charts, and lets Sacha log gym sets. His logs land in
  `data/gym/` automatically.

## Commands (run from `/home/sacha/coach`)

- `COACH_DATA_DIR=<this workspace>/data npm run summarize --workspace @coach/fetcher`
  — regenerate `data/state/summary.json`.
- `COACH_DATA_DIR=<…>/data npm run validate-plan --workspace @coach/fetcher`
  — validate the plan you wrote.

The fetcher runs automatically on cron; you normally don't need to run it.

## Retired (do not use — kept only in backups)

The old `metrics/health_log.csv`, `activities.csv`, `sessions.csv`,
`next-week-plan.json`, and the `scripts/*` sync jobs are superseded. Their data was
migrated into `data/`.

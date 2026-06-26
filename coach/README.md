# Coach — personal fitness coaching system

A self-hosted fitness coach that connects all your trackers, logs your gym sessions, and uses an AI agent to plan your training week automatically.

## What it does

- **Pulls data** from Ultrahuman, Polar, Garmin, and Withings automatically three times a day
- **Dashboard** shows today's health metrics (HRV, sleep, recovery, resting HR, weight) with 21-day trend charts
- **Week plan** is written by the AI coach agent every Sunday and updated whenever you save constraints
- **Gym logger** lets you log every set, weight, and RPE, with a rest timer and per-exercise history
- **Constraints** let you lock in fixed events (floorball training, games, tennis, rest days) so the coach plans around them
- **Telegram notifications** from the fitness bot for daily summaries and weekly planning

## Architecture

```
Fitness devices / APIs
    ↓  (cron 06:30, 12:30, 18:30)
apps/fetcher  ←── direct REST adapters (Ultrahuman, Polar, Withings)
              ←── Garmin Connect MCP (stdio)
    ↓
data/health/daily.csv          ← merged health metrics
data/activities/activities.csv ← all workouts
data/gym/sessions/<date>.json  ← logged gym sessions
data/gym/log.csv               ← flat per-set gym log
data/state/summary.json        ← 7d/28d rollups
    ↓
OpenClaw fitness agent  ←── reads all of data/
    ↓ writes
data/plan/current.json   ← weekly plan (exercises, intensity, details)
data/analysis/latest.md ← coach analysis text
    ↓
apps/web (Next.js, port 3000)  ← shows everything to you
```

## Pages

### `/` — Dashboard
- **Readiness strip**: sleep hours, HRV, resting HR, recovery score — with delta vs. yesterday
- **Week plan**: all sessions with intensity badges; tap a session to see the full workout definition; gym sessions link directly to the logger
- **21-day charts**: sleep + HRV overlay, training load bar chart
- **Recent activities**: last 8 workouts from all sources
- **Coach analysis**: the agent's free-form assessment
- **Sync status**: last run time and record count per tracker

### `/gym` — Gym index
- Quick link to today's session (or start an ad-hoc one)
- Date picker to open any session (past or future)
- This week's planned gym days
- Recent session history

### `/gym/<date>` — Gym logger
- Session name (editable inline)
- Per exercise:
  - Target sets × reps (from plan)
  - Last performance (weight × reps from most recent session)
  - **📝 Notes** button — toggles a textarea for setup cues (seat position, grip, etc.)
  - **📊 History** button — inline panel showing all previous sessions for that exercise
  - **✕ Remove** exercise from this session
- Per set: kg / reps / RPE inputs + ✓ done + ✕ remove
- **+ Add set** and **+ Add exercise** buttons
- Rest timer (90s / 120s / 180s) auto-starts when you mark a set done
- Sticky save bar — saves to `data/gym/sessions/<date>.json`

### `/gym/exercises` — Exercise catalog
- Personal exercise library with name, setup notes, and default sets/reps/weight
- Exercises from past sessions not yet in the catalog appear separately
- Changes reflected immediately in the gym logger

### `/plan` — Weekly constraints
- Navigate week by week (past weeks locked, future weeks editable)
- Add fixed events per day: type (floorball training/game, tennis, bike, run, rest, other), time, notes
- **Save & replan**: saves constraints and triggers the AI coach to immediately re-plan the rest of the week

## Data storage

Everything is plain files — no database. See [`data/README.md`](data/README.md) for the full schema of every file.

Key locations (all relative to `COACH_DATA_DIR`):

| Path | Written by | Contains |
|------|-----------|---------|
| `health/daily.csv` | fetcher | sleep, HRV, weight, recovery per source per day |
| `activities/activities.csv` | fetcher | all workouts (floorball, cycling, running, gym, …) |
| `gym/sessions/<date>.json` | gym logger | full session with all sets |
| `gym/log.csv` | gym logger (auto) | flat per-set log rebuilt from sessions |
| `gym/catalog.json` | /gym/exercises page | exercise library with notes and defaults |
| `plan/current.json` | coach agent | weekly plan (structured, rendered in dashboard) |
| `plan/constraints/<date>.json` | /plan page | user's fixed weekly events |
| `analysis/latest.md` | coach agent | free-form fitness assessment |
| `state/last_sync.json` | fetcher | sync status per source |
| `state/summary.json` | fetcher | 7d/28d rollups for agent |

## Running locally / on the server

```bash
# Build shared lib first (always required before building apps)
npm run build --workspace @coach/lib

# Run the fetcher manually
COACH_DATA_DIR=/path/to/data npm run sync --workspace @coach/fetcher

# Start the web app in dev mode
cd apps/web && npm run dev

# Rebuild and restart production
cd apps/web && npm run build
~/.npm-global/bin/pm2 restart coach-3000 coach-3001
```

## Trackers

| Tracker | Data provided | Sync method |
|---------|--------------|-------------|
| Ultrahuman Ring | HRV, sleep, recovery, readiness, steps | REST API (JWT token) |
| Polar | Activities (workouts, sport type, HR, load) | Polar AccessLink REST |
| Garmin | Activities, sleep, HRV, steps, VO2max | Garmin Connect MCP (stdio) |
| Withings | Body weight, composition | OAuth2 REST; tokens at `~/.openclaw/withings_tokens.json` |

## AI coach (OpenClaw fitness agent)

The coach agent runs inside [OpenClaw](https://openclaw.dev) as the `fitness` agent.
It reads everything in `data/` and writes the weekly plan + analysis.

**Every Sunday at 17:00 CET** it automatically:
1. Reads constraints for next week
2. Reviews health trends and training load
3. Checks the mesocycle plan (`data/plan/mesocycle.json`) for periodization context
4. Writes a new `plan/current.json` and `plan/current.md`

**Every day at 07:30 CET** it sends a Telegram summary.

**Mid-week replanning**: saving constraints on `/plan` injects a one-shot cron job that triggers an immediate replan within ~60 seconds.

## Backup

Code is backed up to `github.com/sachaaebischer/openclaw-backup` via `~/coach/scripts/push-backup.sh` (runs every Sunday at 03:00 and after every significant code change). Health data is not committed.

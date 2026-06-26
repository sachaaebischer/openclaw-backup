# CLAUDE.md — OpenClaw Coach Agent

This is Sacha's personal fitness/health coaching system running on a home server VM at 192.168.0.52.
SSH: `ssh sacha@192.168.0.52` (key at `~/.ssh/id_ed25519` from the dev machine).

## What this project is

A TypeScript monorepo with three parts that work together:

```
devices/APIs → fetcher → data/ → web dashboard (read + write gym logs)
                               → coach agent (reads everything, writes plan/analysis)
```

### `lib/` — shared library
Zod schemas are the **single source of truth** for all data shapes. Never hardcode
field names outside lib. Always rebuild (`npm run build --workspace @coach/lib`)
before building the apps.

Key files:
- `lib/src/schema.ts` — all Zod schemas (`HealthDailySchema`, `ActivitySchema`, `GymSessionSchema`, `GymExerciseSchema`, `PlannedSessionSchema`, `PlanSchema`, `WeekConstraintsSchema`, `ExerciseCatalogSchema`, …)
- `lib/src/paths.ts` — all file paths (edit here when adding new data files)
- `lib/src/store.ts` — typed read/write helpers for every data file
- `lib/src/index.ts` — re-exports everything; import only from `@coach/lib`

### `apps/fetcher/` — data sync daemon
Runs `src/sync.ts` which calls each source adapter in parallel.

**Important:** `config/sources.json` is a legacy placeholder — it is NOT read by
`sync.ts` at runtime. All adapters are hardcoded in `sync.ts` as direct REST/MCP
adapters. Credentials come from `~/.openclaw/openclaw.json` (mcp.servers section).

Adapters (`src/adapters/`):
| Adapter | Method | Data |
|---------|--------|------|
| `ultrahuman.ts` | REST API with JWT token | HRV, sleep, recovery, readiness |
| `polar.ts` | Polar AccessLink REST API | Activities (workouts) |
| `withings.ts` | OAuth2 REST; tokens at `~/.openclaw/withings_tokens.json` | Weight |
| `garmin.ts` | MCP stdio (`@nicolasvegam/garmin-connect-mcp`) | Activities, sleep, HRV |

Scripts:
- `npm run sync` — run full sync (last 4 days)
- `npm run summarize` — compute 7d/28d rollups into `state/summary.json`

### `apps/web/` — Next.js 14 dashboard (App Router)
Served on port 3000 by pm2 (`coach-3000` and `coach-3001` for redundancy).

Routes:
| Route | Type | What it does |
|-------|------|--------------|
| `/` | Server | Dashboard: health stats, week plan, charts, recent activities, analysis |
| `/gym` | Server | Gym index: today's session, date picker, recent sessions |
| `/gym/[date]` | Server | Gym logger for a specific date |
| `/gym/exercises` | Client | Exercise catalog: create/edit/delete exercises with notes |
| `/plan` | Client | Weekly constraints: lock in fixed events (floorball, tennis, etc.) |

Key client components:
- `GymLogger.tsx` — full gym session logger with sets/reps/weight, rest timer, add/remove exercises, exercise notes, history panel, save
- `PlanSessionCard.tsx` — clickable session card that expands to show `details`
- `DateSessionPicker.tsx` — date input for opening any session
- `ExerciseHistory.tsx` (inline in GymLogger) — per-exercise history panel

Key API routes:
- `POST /api/gym/[date]` — save a gym session
- `GET/POST /api/gym/catalog` — read/write exercise catalog
- `PUT/DELETE /api/gym/catalog/[name]` — update/delete catalog item
- `GET /api/gym/history?exercise=X` — all historical sets for an exercise
- `GET/POST /api/plan/constraints` — read/write weekly constraints; POST also injects a replan OpenClaw job

### `agent/` — context files read by the OpenClaw fitness agent
- `AGENT.md` — main instructions (also at `~/coach/AGENT.md`, same file)
- `agent/DATA_SOURCES.md` — data file paths and formats
- `agent/TOOLS.md` — available tools

## Data directory

Production data lives at:
`/home/sacha/.openclaw/agents/fitness/workspace/data/`

Set via `COACH_DATA_DIR` env var. During development without that var, falls back to
`lib/../../data/` (i.e. `~/coach/data/`).

See `data/README.md` for the complete schema of every file.

## Running things

```bash
# SSH to server
ssh sacha@192.168.0.52

# Build lib (always first)
cd ~/coach && npm run build --workspace @coach/lib

# Manual data sync
COACH_DATA_DIR=/home/sacha/.openclaw/agents/fitness/workspace/data \
  npm run sync --workspace @coach/fetcher

# Run summarize (updates state/summary.json for agent)
COACH_DATA_DIR=/home/sacha/.openclaw/agents/fitness/workspace/data \
  npm run summarize --workspace @coach/fetcher

# Build and restart web
cd ~/coach/apps/web && npm run build
~/.npm-global/bin/pm2 restart coach-3000 coach-3001

# Check pm2 logs
~/.npm-global/bin/pm2 logs coach-3000 --lines 50

# Push backup to GitHub
bash ~/coach/scripts/push-backup.sh
```

## Automation schedule

| What | When | How |
|------|------|-----|
| Data sync (fetcher) | 06:30, 12:30, 18:30 daily | crontab |
| GitHub backup | Sunday 03:00 | crontab |
| Daily Summary (coach) | 07:30 daily | OpenClaw cron |
| Weekly Plan (coach) | Sunday 17:00 | OpenClaw cron |
| Constraints Reminder | Sunday 15:00 | OpenClaw cron |
| PM2 resurrect on boot | @reboot | crontab |

OpenClaw cron jobs live in `~/.openclaw/cron/jobs.json`.
Crontab: `crontab -l` on the server.

## OpenClaw integration

- Gateway: `http://localhost:18789`
- Fitness agent ID: `fitness`
- Agent workspace: `~/.openclaw/agents/fitness/workspace/`
- Telegram bot (fitness): bot ID `8357659123`, user ID `7789196354`

To trigger an immediate replan: `POST /api/plan/constraints` automatically injects
a one-shot job into `~/.openclaw/cron/jobs.json` with `deleteAfterRun: true` and
`wakeMode: "now"`. OpenClaw picks it up within ~60 seconds.

## GitHub backup

Repo: `https://github.com/sachaaebischer/openclaw-backup` (private)
PAT stored at: `~/.openclaw/github_pat`
Script: `~/coach/scripts/push-backup.sh`

What's backed up:
- `coach/` — full source code (no node_modules, no health data)
- `openclaw-config/` — cron jobs, redacted OpenClaw config, pm2 dump

What's NOT backed up (secrets/live data):
- `~/.openclaw/openclaw.json` — has all API keys (Anthropic, Garmin, Polar, Withings, Ultrahuman, Telegram, OpenRouter, Brave)
- `~/.openclaw/withings_tokens.json` — OAuth tokens
- All CSV/JSON data files in the data directory

## Important conventions

- **Dates always use local timezone**: `new Date().toLocaleDateString('sv')` not `.toISOString().slice(0,10)`
- **Atomic writes everywhere**: write to `.tmp`, then `fs.renameSync` to final path
- **Zod schemas first**: add field to `lib/src/schema.ts` → rebuild lib → use in app
- **Path helpers**: add new paths to `lib/src/paths.ts`, never hardcode paths in app code
- **RSC/client boundary**: never import plain values (objects, constants) from `'use client'` modules into server components — only React components can cross that boundary

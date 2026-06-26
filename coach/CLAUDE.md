# CLAUDE.md — OpenClaw Coach Agent

This is Sacha's personal fitness/health coaching system. It runs on a home server (VM) and combines multiple fitness data sources into a single coach agent powered by OpenClaw AI.

## What this project is

- **`lib/`** — Shared TypeScript library. Zod schemas are the single source of truth for all data shapes. `paths.ts` centralises all file paths. `store.ts` has typed read/write helpers. Always `npm run build --workspace @coach/lib` before building the apps.
- **`apps/fetcher/`** — Data sync daemon. `npm run fetch` runs `sync.ts`, which reads `config/sources.json` and calls each enabled source via MCP (`stdio` or `http`) or direct REST adapters (Withings uses its own OAuth flow).
- **`apps/web/`** — Next.js 14 (App Router) dashboard. Served on port 3000 by pm2 processes `coach-3000` / `coach-3001`. Routes: `/` dashboard, `/gym` gym logger, `/plan` weekly constraints.
- **`agent/`** — Markdown files the OpenClaw fitness agent reads as its context (DATA_SOURCES.md, TOOLS.md). The main agent prompt file is `AGENT.md`.
- **`config/sources.json`** — Describes each data source. Keep secrets out of here; they live in env vars passed via MCP `env` blocks or directly by adapters (e.g. Withings tokens at `~/.openclaw/withings_tokens.json`).
- **`data/`** — CSV and JSON data files written by the fetcher and read by the web/agent. **NOT committed to git** (real health data). Lives at `/home/sacha/.openclaw/agents/fitness/workspace/data/` in production (symlinked or set via `COACH_DATA_DIR`).

## Data flow

```
Fitness devices/APIs
    → apps/fetcher (MCP / REST adapters, ~every hour via pm2)
    → data/raw/<source>/<date>.json  (raw)
    → data/health/<date>.csv         (normalised health daily)
    → data/activities/<date>.csv     (workouts)
    → data/gym/sessions/<date>.json  (gym logs from web UI)
    → data/plan/weekly/<date>.json   (coach's weekly plan)
    → data/plan/constraints/<date>.json  (user's fixed-session constraints)
```

## Key paths (all under COACH_DATA_DIR)

| Path | Description |
|------|-------------|
| `data/health/` | Daily health CSVs (sleep, HRV, steps, weight, …) |
| `data/activities/` | Workout activity CSVs |
| `data/gym/sessions/` | Gym session JSON logs |
| `data/plan/weekly/<YYYY-MM-DD>.json` | Coach's weekly training plan |
| `data/plan/constraints/<YYYY-MM-DD>.json` | User's fixed-event constraints for a week |
| `data/state/sync_state.json` | Last-fetched timestamps per source |

## Process management (pm2)

```bash
pm2 list                    # see coach-3000, coach-3001 (web), fetcher processes
pm2 restart coach-3000      # restart web
pm2 logs coach-3000         # tail logs
```

## Build & run (local development)

```bash
# 1. Build shared lib first (always required before apps)
npm run build --workspace @coach/lib

# 2. Build/run web
cd apps/web && npm run build && npm start   # or npm run dev

# 3. Run fetcher once
COACH_DATA_DIR=/home/sacha/.openclaw/agents/fitness/workspace/data \
  npm run fetch --workspace @coach/fetcher

# 4. Summarise data for agent
COACH_DATA_DIR=/home/sacha/.openclaw/agents/fitness/workspace/data \
  npm run summarize --workspace @coach/fetcher
```

## OpenClaw integration

- OpenClaw runs at `http://localhost:18789`
- Cron jobs live in `~/.openclaw/cron/jobs.json`
- The fitness agent ID is `fitness`
- The agent's workspace is `~/.openclaw/agents/fitness/workspace/`
- To trigger an immediate replan: inject a job with `deleteAfterRun: true`, `wakeMode: "now"`, cron `* * * * *`. The web API endpoint `POST /api/plan/constraints` does this automatically after saving constraints.
- Jobs state (running/completed) is tracked in `~/.openclaw/cron/jobs-state.json`

## Weekly constraints system

Users fill in fixed events (floorball training/game, tennis, rest days, etc.) at `/plan` in the web UI. Constraints are saved per week (Monday = week key) to `data/plan/constraints/<YYYY-MM-DD>.json`. On save, the web app injects a one-shot replan job into OpenClaw so the coach immediately re-plans the rest of the week around those constraints.

Past days are locked (read-only) in the UI. The UI defaults to the current week.

On Sunday at 15:00 CET, an OpenClaw cron job checks if next week's constraints exist; if not, it sends a Telegram reminder.

## Data sources

| Source | Adapter | What it provides |
|--------|---------|-----------------|
| Garmin | MCP (stdio, garmin-connect-mcp) | Activities, sleep, HRV, steps, VO2max |
| Ultrahuman | REST adapter | HRV, recovery, readiness, sleep score |
| Polar | MCP (http, running on :18790) | Activities, heart rate |
| Withings | REST adapter (OAuth2) | Weight, body composition; tokens at `~/.openclaw/withings_tokens.json` |

## Important conventions

- **All dates use local timezone** (`new Date().toLocaleDateString('sv')` not `.toISOString().slice(0,10)`)
- **Atomic writes** everywhere: write to `.tmp`, then `fs.renameSync` to final path
- **Zod schemas first**: add to `lib/src/schema.ts`, export from `lib/src/index.ts`, rebuild lib before using
- **Path helpers**: add new paths to `lib/src/paths.ts`, don't hardcode paths in app code
- **config/sources.json** controls which sources are active. Set `"enabled": false` on mock/test sources in production.

## Telegram

Fitness Telegram bot token is in the OpenClaw agent config (not in this repo). The user's Telegram ID is `7789196354`. Notifications go through OpenClaw's `delivery` system.

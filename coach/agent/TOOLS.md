# TOOLS.md — Environment & Infrastructure (v2, 2026-06-23)

## Server

- **Host:** the OpenClaw VM (`openclaw`). SSH from Sacha's laptop: `ssh coach-vm` (Tailscale).
- New training system lives in `/home/sacha/coach` (Node monorepo).

## Web App (unified: dashboard + gym logger)

| What | Where |
|---|---|
| Dashboard | `/` (readiness, weekly plan, progression, analysis) |
| Gym logger | `/gym` and `/gym/<date>` (log sets/reps/weight) |
| Ports | **3000 and 3001** (same app on both) |
| Process | pm2 `coach-3000`, `coach-3001` (autostart via `@reboot pm2 resurrect`) |
| Data dir | `COACH_DATA_DIR=/home/sacha/.openclaw/agents/fitness/workspace/data` |
| Restart | `~/.npm-global/bin/pm2 restart coach-3000 coach-3001` |

The old separate `fitness-dashboard` / `gym-logger` (server.js) apps and `watchdog.sh`
are retired.

## Data layer (the contract — see DATA_SOURCES.md)

Everything is under `data/` in this workspace. The fetcher writes health/activities/gym;
you (Coach) write the plan + analysis. No scripts to run for data.

## Fetcher (automated)

- Location: `/home/sacha/coach`. Command: `npm run sync --workspace @coach/fetcher`.
- Cron: 06:30 and 12:30 daily (logs to `/home/sacha/coach/sync.log`).
- Sources: Ultrahuman / Polar / Withings via direct REST; Garmin via its MCP.
- Helpers you can run (from `/home/sacha/coach`, with `COACH_DATA_DIR` set):
  - `npm run summarize --workspace @coach/fetcher` → refresh `data/state/summary.json`
  - `npm run validate-plan --workspace @coach/fetcher` → validate `data/plan/current.json`

## Retired scripts (do not use)

`scripts/sync-*.js`, `generate-week-plan.js`, `daily-briefing.js`, `sync-all-activities.js`,
`Projects/watchdog.sh`, `Projects/*/health-check.sh`. Superseded by the fetcher + pm2.

## Telegram

- Sacha's Telegram ID: `7789196354` (messages via OpenClaw Telegram plugin).

## Model Config

- Managed via OpenClaw web UI (SSH tunnel: `ssh -L 18789:localhost:18789 coach-vm`, then http://localhost:18789).

# Coach — automated training system

Automates the data side of your training coach so the AI only does what it's good
at (analysis & planning), not fragile fetching/bookkeeping.

- **Fetcher** (`apps/fetcher`) — deterministic scheduler that drives your existing
  tracker **MCP servers** (Polar, Garmin, Ultrahuman, …) on a cron and writes
  normalized files to `data/`. No AI in the data path.
- **Web** (`apps/web`) — a **dashboard** (health, weekly plan, progression,
  analysis) and a mobile **gym-logger** (log sets/reps/weight/RPE).
- **`data/`** — plain files (CSV/JSON/MD) that are the contract the OpenClaw coach
  agent reads from and writes its plan + analysis back to. See [`data/README.md`](data/README.md).
- **`lib/`** — shared schemas + file IO used by everything.

The coach agent's instructions live in [`AGENT.md`](AGENT.md).

## Quick start (local)

```bash
npm install
npm run build --workspace @coach/lib   # compile shared lib once

# Pull data using the built-in mock tracker, then view it:
npm run fetch -- --source mock
npm run dev                            # http://localhost:3000
```

## Wiring your real trackers

Edit [`config/sources.json`](config/sources.json). Each source connects to one MCP
server (stdio command or http URL) and lists which tools to call and whether each
returns `health` or `activities` data. Set `enabled: true` and fill in the
transport + tool names. Then:

```bash
npm run fetch -- --source polar        # test one source
```

Inspect `data/raw/<source>/` to see the raw output. The generic normalizer
(`apps/fetcher/src/normalizers/generic.ts`) maps common field names automatically;
if a tracker needs custom mapping, add an entry in `apps/fetcher/src/normalizers/index.ts`.

## Commands

| command | what it does |
|---|---|
| `npm run fetch [-- --source a,b]` | one-shot fetch (all enabled, or named sources) |
| `npm run scheduler` | long-running cron scheduler (the production process) |
| `npm run summarize` | regenerate `data/state/summary.json` rollups |
| `npm run validate-plan` | validate `data/plan/current.json` against the schema |
| `npm run dev` / `npm run build` | the web app |
| `npm run typecheck` | type-check lib + fetcher |

## Deploy (Docker, alongside OpenClaw)

```bash
# Point the data dir at the agent's directory so the coach shares the files:
COACH_DATA_DIR=/opt/openclaw/agents/coach/data docker compose up -d --build
```

This starts `web` (port 3000) and `fetcher` (scheduler). See `docker-compose.yml`.

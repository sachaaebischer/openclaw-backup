import {
  readSyncState,
  upsertActivities,
  upsertHealth,
  writeRaw,
  writeSyncState,
} from "@coach/lib";
import { fetchUltrahuman } from "./adapters/ultrahuman.js";
import { fetchPolar } from "./adapters/polar.js";
import { fetchWithings } from "./adapters/withings.js";
import { fetchGarmin } from "./adapters/garmin.js";
import { AdapterResult, RunOpts } from "./adapters/types.js";
import { writeSummary } from "./summarize.js";
import { runAll } from "./run.js";
import { loadConfig } from "./config.js";

/**
 * Production fetcher — "mix per tracker":
 *   ultrahuman / polar / withings  → direct vendor REST APIs (adapters/)
 *   garmin (+ any others)          → MCP servers configured in config/sources.json
 *
 * Usage:
 *   npm run sync                       # default window (last 4 days) all sources
 *   npm run sync -- --since 2026-05-01 # custom start
 *   npm run sync -- --source polar,ultrahuman
 */
const ADAPTERS: Record<string, (o: RunOpts) => Promise<AdapterResult>> = {
  ultrahuman: fetchUltrahuman,
  polar: fetchPolar,
  withings: fetchWithings,
  garmin: fetchGarmin,
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function minusDays(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return iso(d);
}

async function recordState(name: string, r: { ok: boolean; health: number; activities: number; error?: string }) {
  const state = await readSyncState();
  const now = new Date().toISOString();
  state.last_run_at = now;
  state.sources[name] = {
    last_run_at: now,
    status: r.ok ? "ok" : "error",
    error: r.error ?? "",
    health_records: r.health,
    activity_records: r.activities,
  };
  await writeSyncState(state);
}

async function main() {
  const args = process.argv.slice(2);
  let since: string | undefined;
  let until = iso(new Date());
  let only: string[] | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--since") since = args[++i];
    else if (args[i] === "--until") until = args[++i];
    else if (args[i] === "--source" || args[i] === "-s")
      only = (args[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }
  since = since ?? minusDays(4);
  const opts: RunOpts = { since, until };

  const want = Object.keys(ADAPTERS).filter((n) => (only ? only.includes(n) : true));
  console.error(`[sync] window ${since}..${until}`);

  for (const name of want) {
    try {
      const result = await ADAPTERS[name](opts);
      await writeRaw(name, iso(new Date()), result);
      if (result.health.length) await upsertHealth(result.health);
      if (result.activities.length) await upsertActivities(result.activities);
      await recordState(name, { ok: true, health: result.health.length, activities: result.activities.length });
      console.error(`[sync] ${name}: ${result.health.length} health, ${result.activities.length} activities`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordState(name, { ok: false, health: 0, activities: 0, error: message });
      console.error(`[sync] ${name} FAILED: ${message}`);
    }
  }

  // MCP sources (e.g. garmin) defined and enabled in config/sources.json.
  try {
    const cfg = await loadConfig();
    const mcpNames = cfg.sources
      .filter((s) => s.enabled && s.name !== "mock")
      .filter((s) => (only ? only.includes(s.name) : true))
      .map((s) => s.name);
    if (mcpNames.length) {
      console.error(`[sync] MCP sources: ${mcpNames.join(", ")}`);
      await runAll({ only: mcpNames, config: cfg });
    }
  } catch (err) {
    console.error(`[sync] MCP stage skipped: ${err instanceof Error ? err.message : err}`);
  }

  await writeSummary().catch(() => {});
  const state = await readSyncState();
  process.stdout.write(JSON.stringify(state.sources, null, 2) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

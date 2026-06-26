import {
  Activity,
  HealthDaily,
  readSyncState,
  upsertActivities,
  upsertHealth,
  writeRaw,
  writeSyncState,
} from "@coach/lib";
import { CoachConfig, SourceConfig, loadConfig } from "./config.js";
import { McpSource } from "./mcpClient.js";
import { getNormalizer } from "./normalizers/index.js";
import { writeSummary } from "./summarize.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SourceResult {
  source: string;
  ok: boolean;
  health: number;
  activities: number;
  error?: string;
}

/** Connects to one source, runs all its fetches, normalizes and persists. */
export async function runSource(source: SourceConfig): Promise<SourceResult> {
  const normalizer = getNormalizer(source.name);
  const mcp = new McpSource(source);
  const rawByTool: Record<string, unknown> = {};
  let health: HealthDaily[] = [];
  let activities: Activity[] = [];

  try {
    await mcp.connect();
    for (const f of source.fetches) {
      const data = await mcp.call(f.tool, f.args);
      rawByTool[f.tool] = data;
      if (f.kind === "health") {
        health = health.concat(normalizer.health(data, source.name));
      } else {
        activities = activities.concat(normalizer.activities(data, source.name));
      }
    }
  } catch (err) {
    await mcp.close().catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    await recordState(source.name, { ok: false, health: 0, activities: 0, error: message });
    return { source: source.name, ok: false, health: 0, activities: 0, error: message };
  }

  await mcp.close().catch(() => {});

  // Persist raw audit trail + normalized data.
  await writeRaw(source.name, today(), rawByTool);
  if (health.length) await upsertHealth(health);
  if (activities.length) await upsertActivities(activities);

  // Keep the agent-facing rollups fresh after every successful fetch.
  await writeSummary().catch(() => {});

  await recordState(source.name, {
    ok: true,
    health: health.length,
    activities: activities.length,
  });
  return { source: source.name, ok: true, health: health.length, activities: activities.length };
}

async function recordState(
  name: string,
  r: { ok: boolean; health: number; activities: number; error?: string },
): Promise<void> {
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

/** Runs every enabled source (or a named subset). */
export async function runAll(opts: { only?: string[]; config?: CoachConfig } = {}): Promise<
  SourceResult[]
> {
  const config = opts.config ?? (await loadConfig());
  const sources = config.sources.filter((s) => {
    if (opts.only && opts.only.length) return opts.only.includes(s.name);
    return s.enabled;
  });

  const results: SourceResult[] = [];
  for (const s of sources) {
    process.stderr.write(`[fetcher] running source "${s.name}"...\n`);
    const r = await runSource(s);
    if (r.ok) {
      process.stderr.write(
        `[fetcher] ${s.name}: ${r.health} health, ${r.activities} activities\n`,
      );
    } else {
      process.stderr.write(`[fetcher] ${s.name} FAILED: ${r.error}\n`);
    }
    results.push(r);
  }
  return results;
}

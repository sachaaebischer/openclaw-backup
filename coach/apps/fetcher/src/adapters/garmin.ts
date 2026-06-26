import type { Activity, HealthDaily } from "@coach/lib";
import { trackerServer } from "../credentials.js";
import { McpSource } from "../mcpClient.js";
import type { SourceConfig } from "../config.js";
import { AdapterResult, RunOpts, dateRangeList, emptyHealth } from "./types.js";

/**
 * Garmin — via its MCP server (its Connect auth is OAuth1, impractical to
 * reimplement). Tolerant of empty responses (Garmin is dormant unless a device
 * is actively syncing). Raw payloads are kept by the caller for the agent.
 */
export async function fetchGarmin(opts: RunOpts): Promise<AdapterResult> {
  const server = trackerServer("garmin");
  if (!server) throw new Error("no garmin server in openclaw.json");

  const cfg: SourceConfig = {
    name: "garmin",
    enabled: true,
    schedule: "",
    transport: { type: "stdio", command: server.command, args: server.args, env: server.env },
    fetches: [],
  };
  const mcp = new McpSource(cfg);
  await mcp.connect();
  try {
    const activities = mapActivities(await safe(mcp, "get_activities_by_date", {
      startDate: opts.since,
      endDate: opts.until,
    }));

    const health: HealthDaily[] = [];
    for (const date of dateRangeList(opts.since, opts.until)) {
      const row = emptyHealth(date, "garmin");
      const sleep = await safe(mcp, "get_sleep_data", { date });
      const sd = (sleep as any)?.dailySleepDTO;
      if (sd?.sleepTimeSeconds) row.sleep_h = Math.round((sd.sleepTimeSeconds / 3600) * 100) / 100;
      if (sd?.sleepScores?.overall?.value != null) row.sleep_score = sd.sleepScores.overall.value;

      const rhr = await safe(mcp, "get_resting_heart_rate", { date });
      const rhrArr = (rhr as any)?.allMetrics?.metricsMap?.WELLNESS_RESTING_HEART_RATE;
      if (Array.isArray(rhrArr) && rhrArr[0]?.value != null) row.resting_hr = rhrArr[0].value;

      const hrv = await safe(mcp, "get_hrv", { date });
      const hv = (hrv as any)?.hrvSummary?.lastNightAvg;
      if (hv != null) row.hrv = hv;

      const tr = await safe(mcp, "get_training_readiness", { date });
      const trItem = Array.isArray(tr) ? tr[0] : tr;
      if ((trItem as any)?.score != null) row.readiness = (trItem as any).score;

      const steps = await safe(mcp, "get_steps", { date });
      if ((steps as any)?.totalSteps != null) row.steps = (steps as any).totalSteps;
      if ((steps as any)?.totalKilocalories != null) row.calories = (steps as any).totalKilocalories;

      const vo2 = await safe(mcp, "get_vo2max", { date });
      const vo2v = Array.isArray(vo2) ? (vo2[0] as any)?.generic?.vo2MaxValue : (vo2 as any)?.generic?.vo2MaxValue;
      if (vo2v != null) row.vo2_max = vo2v;

      const has = [row.sleep_h, row.hrv, row.resting_hr, row.readiness, row.steps, row.vo2_max].some(
        (v) => v !== null,
      );
      if (has) health.push(row);
    }

    return { health, activities };
  } finally {
    await mcp.close().catch(() => {});
  }
}

async function safe(mcp: McpSource, tool: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    return await mcp.call(tool, args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write("[garmin] " + tool + ": " + msg + "\n");
    return null;
  }
}

function mapActivities(raw: unknown): Activity[] {
  const list: any[] = Array.isArray(raw) ? raw : (raw as any)?.activities ?? [];
  const out: Activity[] = [];
  for (const a of list) {
    const start = new Date(a.startTimeGMT || a.startTimeLocal || a.startTime);
    if (isNaN(+start)) continue;
    const date = start.toISOString().slice(0, 10);
    out.push({
      id: `garmin:${a.activityId ?? `${date}-${a.activityType?.typeKey ?? "activity"}`}`,
      date,
      start_time: start.toISOString().slice(11, 16),
      sport: (a.activityType?.typeKey ?? "unknown").toLowerCase(),
      source: "garmin",
      duration_min: a.duration ? Math.round((a.duration / 60) * 10) / 10 : null,
      distance_km: a.distance ? Math.round((a.distance / 1000) * 100) / 100 : null,
      avg_hr: a.averageHR ?? null,
      max_hr: a.maxHR ?? null,
      calories: a.calories ?? null,
      load: a.activityTrainingLoad ?? null,
      notes: a.activityName ?? "",
    });
  }
  return out;
}

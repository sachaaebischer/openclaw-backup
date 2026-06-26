import type { HealthDaily } from "@coach/lib";
import { trackerEnv } from "../credentials.js";
import { AdapterResult, RunOpts, dateRangeList, emptyHealth } from "./types.js";

/**
 * Ultrahuman Ring — direct partner API (one call per day).
 * Ported from the working legacy sync-health-log.js.
 */
export async function fetchUltrahuman(opts: RunOpts): Promise<AdapterResult> {
  const env = trackerEnv("ultrahuman");
  const token = env.ULTRAHUMAN_AUTH_TOKEN || process.env.ULTRAHUMAN_AUTH_TOKEN;
  const email = env.ULTRAHUMAN_USER_EMAIL || "sacha.aebischer@gmail.com";
  if (!token) throw new Error("missing ULTRAHUMAN_AUTH_TOKEN");

  const health: HealthDaily[] = [];
  for (const date of dateRangeList(opts.since, opts.until)) {
    const url = `https://partner.ultrahuman.com/api/v1/metrics?email=${encodeURIComponent(email)}&date=${date}`;
    const res = await fetch(url, { headers: { Authorization: token, "Content-Type": "application/json" } });
    if (!res.ok) {
      if (res.status === 404) continue; // no data for that day yet
      throw new Error(`Ultrahuman HTTP ${res.status}`);
    }
    const body: any = await res.json();
    const row = extract(body, date);
    if (row) health.push(row);
  }
  return { health, activities: [] };
}

function extract(data: any, date: string): HealthDaily | null {
  const metrics = data?.data?.metric_data;
  if (!Array.isArray(metrics)) return null;
  const get = (type: string) => metrics.find((m: any) => m.type === type)?.object;

  const recovery = get("recovery_index");
  const sleepObj = get("Sleep");
  const hrv = get("avg_sleep_hrv");
  const nightRhr = get("night_rhr");
  const vo2 = get("vo2_max");
  const movement = get("movement_index");
  const activeMin = get("active_minutes");

  // Skip stale ring data (more than a day behind the target date).
  const dayStartTs = recovery?.day_start_timestamp;
  if (dayStartTs) {
    const dataDate = new Date(dayStartTs * 1000).toISOString().slice(0, 10);
    const daysDiff = (+new Date(date) - +new Date(dataDate)) / 86400000;
    if (daysDiff > 1) return null;
  }

  const qm: Record<string, number> = {};
  (sleepObj?.quick_metrics || []).forEach((m: any) => (qm[m.type] = m.value));
  const rhrValues = (nightRhr?.values || []).filter((v: any) => v.value !== null);
  const rhr = rhrValues.length ? rhrValues[rhrValues.length - 1].value : null;

  const row = emptyHealth(date, "ultrahuman");
  row.recovery = recovery?.value ?? null;
  row.hrv = hrv?.value ?? qm.avg_hrv ?? null;
  row.resting_hr = rhr;
  row.sleep_score = qm.sleep_efic ?? null;
  row.sleep_h = qm.total_sleep ? Math.round((qm.total_sleep / 3600) * 100) / 100 : null;
  row.vo2_max = vo2?.value ?? null;
  row.active_minutes = activeMin?.value ?? null;
  // Only keep the row if it carries at least one real metric.
  const has = [row.recovery, row.hrv, row.resting_hr, row.sleep_h].some((v) => v !== null);
  return has ? row : null;
}

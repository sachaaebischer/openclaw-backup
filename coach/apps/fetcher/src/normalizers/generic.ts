import { Activity, HealthDaily } from "@coach/lib";

/**
 * Best-effort mapping from arbitrary MCP tool output into the canonical schema.
 * It handles the common field-name variants used by tracker APIs. When you wire a
 * real source and see its raw output in data/raw/<source>/, add a dedicated
 * normalizer in this folder if the generic mapping misses fields.
 */

function asArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["data", "items", "records", "days", "activities", "exercises", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as any[];
    }
    // A single record object.
    return [obj];
  }
  return [];
}

function pick(obj: any, keys: string[]): unknown {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null && obj?.[k] !== "") return obj[k];
  }
  return undefined;
}

function n(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function normDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function normalizeHealth(raw: unknown, source: string): HealthDaily[] {
  const out: HealthDaily[] = [];
  for (const row of asArray(raw)) {
    const date = normDate(pick(row, ["date", "day", "calendarDate", "summaryDate", "timestamp"]));
    if (!date) continue;

    let sleepH = n(pick(row, ["sleep_h", "sleepHours", "sleep_hours"]));
    if (sleepH === null) {
      const secs = n(pick(row, ["sleepSeconds", "totalSleepSeconds", "sleep_duration_seconds"]));
      if (secs !== null) sleepH = Math.round((secs / 3600) * 100) / 100;
      const mins = n(pick(row, ["sleepMinutes", "total_sleep_minutes"]));
      if (sleepH === null && mins !== null) sleepH = Math.round((mins / 60) * 100) / 100;
    }

    out.push({
      date,
      source,
      sleep_h: sleepH,
      sleep_score: n(pick(row, ["sleep_score", "sleepScore"])),
      hrv: n(pick(row, ["hrv", "hrvAvg", "avgHrv", "rmssd", "hrv_rmssd"])),
      resting_hr: n(pick(row, ["resting_hr", "restingHeartRate", "rhr", "resting_heart_rate"])),
      recovery: n(pick(row, ["recovery", "recoveryScore", "recovery_index"])),
      readiness: n(pick(row, ["readiness", "readinessScore", "bodyBattery", "body_battery"])),
      steps: n(pick(row, ["steps", "stepCount"])),
      calories: n(pick(row, ["calories", "kcal", "totalCalories", "total_calories"])),
      active_minutes: n(pick(row, ["active_minutes", "activeMinutes", "active_min"])),
      vo2_max: n(pick(row, ["vo2_max", "vo2Max", "vo2max"])),
      weight_kg: n(pick(row, ["weight_kg", "weight", "bodyWeight"])),
      notes: "",
    });
  }
  return out;
}

export function normalizeActivities(raw: unknown, source: string): Activity[] {
  const out: Activity[] = [];
  let idx = 0;
  for (const row of asArray(raw)) {
    const date = normDate(
      pick(row, ["date", "startDate", "startTime", "start_time", "calendarDate", "start"]),
    );
    if (!date) continue;
    idx++;

    let durMin = n(pick(row, ["duration_min", "durationMinutes"]));
    if (durMin === null) {
      const secs = n(pick(row, ["duration", "durationSeconds", "elapsedTime", "movingTime"]));
      if (secs !== null) durMin = Math.round((secs / 60) * 10) / 10;
    }

    let distKm = n(pick(row, ["distance_km", "distanceKm"]));
    if (distKm === null) {
      const m = n(pick(row, ["distance", "distanceMeters", "distance_m"]));
      if (m !== null) distKm = Math.round((m / 1000) * 100) / 100;
    }

    const sport = String(
      pick(row, ["sport", "type", "activityType", "sport_type", "detailedSportType"]) ?? "unknown",
    ).toLowerCase();

    const rawId = pick(row, ["id", "activityId", "external_id", "exerciseId", "uuid"]);
    const id = rawId ? `${source}:${rawId}` : `${source}:${date}:${sport}:${idx}`;

    out.push({
      id,
      date,
      start_time: String(pick(row, ["start_time", "startTime", "startTimeLocal"]) ?? ""),
      sport,
      source,
      duration_min: durMin,
      distance_km: distKm,
      avg_hr: n(pick(row, ["avg_hr", "averageHr", "avgHeartRate", "heartRateAvg", "average_heart_rate"])),
      max_hr: n(pick(row, ["max_hr", "maxHr", "maxHeartRate", "max_heart_rate"])),
      calories: n(pick(row, ["calories", "kcal"])),
      load: n(pick(row, ["load", "trainingLoad", "trimp", "training_load"])),
      notes: "",
    });
  }
  return out;
}

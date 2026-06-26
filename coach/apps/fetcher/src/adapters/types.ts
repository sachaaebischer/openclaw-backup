import type { Activity, HealthDaily } from "@coach/lib";

export interface AdapterResult {
  health: HealthDaily[];
  activities: Activity[];
}

export interface RunOpts {
  since: string; // YYYY-MM-DD inclusive
  until: string; // YYYY-MM-DD inclusive
}

export const emptyHealth = (date: string, source: string): HealthDaily => ({
  date,
  source,
  sleep_h: null,
  sleep_score: null,
  hrv: null,
  resting_hr: null,
  recovery: null,
  readiness: null,
  steps: null,
  calories: null,
  active_minutes: null,
  vo2_max: null,
  weight_kg: null,
  notes: "",
});

export function dateRangeList(since: string, until: string): string[] {
  const out: string[] = [];
  const d = new Date(since + "T00:00:00Z");
  const end = new Date(until + "T00:00:00Z");
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

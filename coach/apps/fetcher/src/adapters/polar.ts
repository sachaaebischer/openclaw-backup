import type { Activity } from "@coach/lib";
import { trackerEnv } from "../credentials.js";
import { AdapterResult, RunOpts } from "./types.js";

/**
 * Polar — direct AccessLink REST API.
 * Ported from legacy sync-mcp-activities.js (fetchPolarExercises).
 */
export async function fetchPolar(opts: RunOpts): Promise<AdapterResult> {
  const env = trackerEnv("polar");
  const token = env.POLAR_ACCESS_TOKEN || process.env.POLAR_ACCESS_TOKEN;
  const userId = env.POLAR_USER_ID || process.env.POLAR_USER_ID;
  if (!token || !userId) throw new Error("missing POLAR_ACCESS_TOKEN / POLAR_USER_ID");

  // Non-transactional training-data endpoint (the /users/{id}/exercises form is gone).
  void userId;
  const res = await fetch(`https://www.polaraccesslink.com/v3/exercises`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Polar HTTP ${res.status}`);
  const data: any = await res.json();
  const exercises: any[] = Array.isArray(data) ? data : data.items || [];

  const activities: Activity[] = [];
  for (const ex of exercises) {
    const start = new Date(ex.start_time);
    if (isNaN(+start)) continue;
    const date = start.toISOString().slice(0, 10);
    if (date < opts.since || date > opts.until) continue;
    activities.push({
      id: `polar:${ex.id ?? `${date}-${ex.detailed_sport_info ?? ex.sport}`}`,
      date,
      start_time: start.toISOString().slice(11, 16),
      sport: mapSport(ex),
      source: "polar",
      duration_min: ex.duration ? Math.round(parsePT(ex.duration) / 60) : null,
      distance_km: ex.distance ? Math.round((ex.distance / 1000) * 100) / 100 : null,
      avg_hr: ex.heart_rate?.average ?? null,
      max_hr: ex.heart_rate?.maximum ?? null,
      calories: ex.calories ?? null,
      load: ex.training_load_pro?.["cardio-load"] ?? null,
      notes: ex.detailed_sport_info ?? "",
    });
  }
  return { health: [], activities };
}

function mapSport(ex: any): string {
  const d = (ex.detailed_sport_info || "").toUpperCase();
  const s = (ex.sport || "").toUpperCase();
  if (d === "FLOORBALL") return "floorball";
  if (d.includes("RUNNING")) return "running";
  if (s === "CYCLING") return "cycling";
  if (s === "STRENGTH_TRAINING" || d.includes("STRENGTH")) return "gym";
  return (ex.sport || "unknown").toLowerCase();
}

function parsePT(pt: string): number {
  const m = String(pt).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!m) return 0;
  return Math.round(+(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + parseFloat(m[3] || "0"));
}

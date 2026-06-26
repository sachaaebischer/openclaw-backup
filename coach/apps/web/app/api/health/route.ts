import { NextResponse } from "next/server";
import { readHealth } from "@coach/lib";

export const dynamic = "force-dynamic";

/**
 * Back-compat endpoint for the old dashboard API shape, so the existing OpenClaw
 * "morning briefing" cron keeps working — but served from the NEW data.
 * Returns { latest, trend } with the legacy field names.
 */
export async function GET() {
  const rows = [...(await readHealth())].sort((a, b) => a.date.localeCompare(b.date));
  const toOld = (r: (typeof rows)[number]) => ({
    date: r.date,
    recovery_index: r.recovery,
    hrv_avg: r.hrv,
    resting_hr: r.resting_hr,
    sleep_score: r.sleep_score,
    sleep_duration_min: r.sleep_h === null ? null : Math.round(r.sleep_h * 60),
    sleep_efficiency_pct: r.sleep_score,
    vo2_max: r.vo2_max,
    active_minutes: r.active_minutes,
    weight_kg: r.weight_kg,
  });
  return NextResponse.json({
    latest: rows.length ? toOld(rows[rows.length - 1]) : null,
    trend: rows.slice(-30).map(toOld),
  });
}

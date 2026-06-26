import path from "node:path";
import {
  Activity,
  HealthDaily,
  dataDir,
  readActivities,
  readGymSessions,
  readHealth,
  writeJsonAtomic,
} from "@coach/lib";

/**
 * Deterministic rollups the coach agent can read instead of recomputing by hand.
 * Writes data/state/summary.json. Run via `npm run summarize`.
 */

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('sv');
}

function avg(vals: (number | null)[]): number | null {
  const xs = vals.filter((v): v is number => v !== null);
  if (!xs.length) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;
}

function healthWindow(health: HealthDaily[], since: string) {
  const rows = health.filter((h) => h.date >= since);
  return {
    days: new Set(rows.map((r) => r.date)).size,
    sleep_h: avg(rows.map((r) => r.sleep_h)),
    hrv: avg(rows.map((r) => r.hrv)),
    resting_hr: avg(rows.map((r) => r.resting_hr)),
    recovery: avg(rows.map((r) => r.recovery)),
    readiness: avg(rows.map((r) => r.readiness)),
  };
}

function activityWindow(activities: Activity[], since: string) {
  const rows = activities.filter((a) => a.date >= since);
  const bySport: Record<string, { sessions: number; minutes: number; load: number }> = {};
  for (const a of rows) {
    const s = (bySport[a.sport] ??= { sessions: 0, minutes: 0, load: 0 });
    s.sessions++;
    s.minutes += a.duration_min ?? 0;
    s.load += a.load ?? 0;
  }
  return {
    total_sessions: rows.length,
    total_minutes: rows.reduce((sum, a) => sum + (a.duration_min ?? 0), 0),
    total_load: Math.round(rows.reduce((sum, a) => sum + (a.load ?? 0), 0)),
    by_sport: bySport,
  };
}

/** Builds the rollup summary and writes data/state/summary.json. Returns it. */
export async function writeSummary() {
  const [health, activities, gym] = await Promise.all([
    readHealth(),
    readActivities(),
    readGymSessions(),
  ]);

  const since7 = daysAgo(7);
  const since28 = daysAgo(28);

  // Gym tonnage per exercise over the last 28 days.
  const gymRecent = gym.filter((s) => s.date >= since28);
  const tonnage: Record<string, { sets: number; tonnage: number; top_weight: number }> = {};
  for (const s of gymRecent) {
    for (const ex of s.exercises) {
      const agg = (tonnage[ex.name] ??= { sets: 0, tonnage: 0, top_weight: 0 });
      for (const set of ex.sets) {
        if (!set.done) continue;
        agg.sets++;
        agg.tonnage += (set.reps ?? 0) * (set.weight ?? 0);
        if ((set.weight ?? 0) > agg.top_weight) agg.top_weight = set.weight ?? 0;
      }
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    health: { last_7d: healthWindow(health, since7), last_28d: healthWindow(health, since28) },
    activities: {
      last_7d: activityWindow(activities, since7),
      last_28d: activityWindow(activities, since28),
    },
    gym_last_28d: { sessions: gymRecent.length, by_exercise: tonnage },
  };

  const out = path.join(dataDir(), "state", "summary.json");
  await writeJsonAtomic(out, summary);
  return { path: out, summary };
}

// Allow running directly as a CLI: `npm run summarize`.
const invoked = process.argv[1] ? path.basename(process.argv[1]).replace(/\.(ts|js)$/, "") : "";
if (invoked === "summarize") {
  writeSummary()
    .then(({ path: out, summary }) => {
      process.stdout.write(`wrote ${out}\n`);
      process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

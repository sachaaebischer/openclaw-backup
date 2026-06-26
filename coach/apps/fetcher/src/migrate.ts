import fs from "node:fs";
import path from "node:path";
import {
  Activity,
  GymExercise,
  GymSession,
  HealthDaily,
  Plan,
  PlanDay,
  dataDir,
  num,
  parseCsv,
  saveGymSession,
  upsertActivities,
  upsertHealth,
  writeFileAtomic,
  writePlan,
} from "@coach/lib";

/**
 * One-shot migration of the legacy fitness-agent data into the new schema.
 * Reads the old workspace files and writes the new data/ contract (honoring
 * COACH_DATA_DIR). Idempotent: re-running upserts the same keys.
 */

const WS = process.env.LEGACY_WORKSPACE || "/home/sacha/.openclaw/agents/fitness/workspace";
const GYM = process.env.LEGACY_GYM || "/home/sacha/Projects/gym-logger/logs";

function read(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ------------------------------- health ------------------------------- */
// The legacy file lost its top header (data rows first, stray headers appended
// at the bottom). Parse with the known column order instead of the first line.
const LEGACY_HEALTH_HEADER =
  "date,recovery_index,hrv_avg,resting_hr,sleep_score,sleep_duration_min,deep_sleep_min,rem_min,sleep_efficiency_pct,vo2_max,movement_index,active_minutes,weekly_active_min,hr_drop,context";

function migrateHealth(): HealthDaily[] {
  const raw = read(path.join(WS, "metrics", "health_log.csv"));
  if (!raw) return [];
  // Prepend the canonical header so columns map correctly; stray header rows in
  // the body become rows with date="date" and are filtered out below.
  const rows = parseCsv(LEGACY_HEALTH_HEADER + "\n" + raw.trim());
  const out: HealthDaily[] = [];
  for (const r of rows) {
    if (!isDate(r.date)) continue; // skips the duplicated header rows
    // Drop the known placeholder rows (73/88/47/73…).
    if (r.recovery_index === "73" && r.hrv_avg === "88" && r.resting_hr === "47" && r.sleep_score === "73")
      continue;
    const sleepMin = num(r.sleep_duration_min);
    out.push({
      date: r.date,
      source: "ultrahuman",
      sleep_h: sleepMin === null ? null : Math.round((sleepMin / 60) * 100) / 100,
      sleep_score: num(r.sleep_score),
      hrv: num(r.hrv_avg),
      resting_hr: num(r.resting_hr),
      recovery: num(r.recovery_index),
      readiness: null,
      steps: null,
      calories: null,
      active_minutes: num(r.active_minutes),
      vo2_max: num(r.vo2_max),
      weight_kg: null,
      notes: r.context ?? "",
    });
  }
  return out;
}

/* ----------------------------- activities ----------------------------- */
function migrateActivities(): Activity[] {
  const text = read(path.join(WS, "activities.csv"));
  if (!text) return [];
  const rows = parseCsv(text);
  const out: Activity[] = [];
  let idx = 0;
  for (const r of rows) {
    if (!isDate(r.date)) continue;
    idx++;
    const sport = (r.sport || r.session || "unknown").toLowerCase();
    const source = r.source || "legacy";
    out.push({
      id: `${source}:${r.date}:${sport}:${idx}`,
      date: r.date,
      start_time: "",
      sport,
      source,
      duration_min: num(r.duration_min),
      distance_km: null,
      avg_hr: num(r.avg_hr),
      max_hr: num(r.max_hr),
      calories: num(r.calories),
      load: num(r.load),
      notes: [r.description, r.notes].filter(Boolean).join(" | "),
    });
  }
  return out;
}

/* -------------------------------- gym --------------------------------- */
async function migrateGym(): Promise<number> {
  // Prefer the canonical gym-logger CSV; fall back to the workspace copy.
  const text =
    read(path.join(GYM, "sessions.csv")) || read(path.join(WS, "sessions.csv"));
  if (!text) return 0;
  const rows = parseCsv(text);

  const byDate = new Map<string, Map<string, GymExercise>>();
  const times = new Map<string, { first: string; last: string }>();

  for (const r of rows) {
    if (!isDate(r.date) || !r.exercise) continue;
    const exMap = byDate.get(r.date) ?? new Map<string, GymExercise>();
    byDate.set(r.date, exMap);
    const ex =
      exMap.get(r.exercise) ??
      ({ name: r.exercise, target_sets: null, target_reps: "", notes: "", sets: [] } as GymExercise);
    exMap.set(r.exercise, ex);
    ex.sets.push({
      set_no: ex.sets.length + 1,
      reps: num(r.reps),
      weight: num(r.weight),
      rpe: null,
      done: true,
    });
    if (r.set_note && !ex.notes.includes(r.set_note)) {
      ex.notes = [ex.notes, r.set_note].filter(Boolean).join("; ");
    }
    const t = times.get(r.date) ?? { first: r.time || "", last: r.time || "" };
    if (r.time) {
      if (!t.first || r.time < t.first) t.first = r.time;
      if (!t.last || r.time > t.last) t.last = r.time;
    }
    times.set(r.date, t);
  }

  let count = 0;
  for (const [date, exMap] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const t = times.get(date);
    const session: GymSession = {
      id: `${date}-gym`,
      date,
      name: "Gym session",
      started_at: t?.first ? `${date}T${t.first}` : "",
      finished_at: t?.last ? `${date}T${t.last}` : "",
      notes: "",
      exercises: [...exMap.values()],
    };
    await saveGymSession(session);
    count++;
  }
  return count;
}

/* -------------------------------- plan -------------------------------- */
const WEEKDAYS: [string, string][] = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
];

function migratePlan(): Plan | null {
  const text = read(path.join(WS, "next-week-plan.json"));
  if (!text) return null;
  const parsed = JSON.parse(text);
  const weeks: any[] = Array.isArray(parsed) ? parsed : [parsed];
  if (!weeks.length) return null;
  // Most recent week by start_date.
  const week = weeks.sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))).at(-1)!;

  const days: PlanDay[] = [];
  for (const [key, name] of WEEKDAYS) {
    const d = week.dates?.[key];
    if (!d?.date) continue;
    const session: string = d.session || "rest";
    let sessions: PlanDay["sessions"] = [];
    if (session.startsWith("gym")) {
      const part = session.includes("upper") ? "upper" : "lower";
      const exos: any[] = week.gym?.[part] ?? [];
      sessions = [
        {
          type: "gym",
          title: `Gym ${part}`,
          planned_at: "",
          duration_min: null,
          intensity: "",
          details: "",
          exercises: exos.map((e) => ({
            name: String(e.name),
            target_sets: num(String(e.sets ?? "")),
            target_reps: e.reps != null ? String(e.reps) : "",
            target_weight: num(String(e.load ?? "")),
            notes: e.note ?? "",
          })),
        },
      ];
    } else if (session === "rest") {
      sessions = [{ type: "rest", title: "Rest", planned_at: "", duration_min: null, intensity: "easy", details: "", exercises: [] }];
    } else {
      sessions = [{ type: session, title: session.charAt(0).toUpperCase() + session.slice(1), planned_at: "", duration_min: null, intensity: "", details: "", exercises: [] }];
    }
    days.push({ date: d.date, weekday: name, sessions });
  }

  return {
    week_start: week.start_date,
    generated_at: week.generated_at || new Date().toISOString(),
    notes: [week.mesocycle, week.phase, week.week ? `week ${week.week}` : ""].filter(Boolean).join(" · "),
    days,
  };
}

/* ----------------------------- reference ------------------------------ */
function copyReference() {
  const targets = [
    [path.join(GYM, "exercises.json"), "exercises.json"],
    [path.join(WS, "mesocycle-config.json"), "plan/mesocycle.json"],
  ] as const;
  for (const [src, dest] of targets) {
    const text = read(src);
    if (text) {
      const out = path.join(dataDir(), dest);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, text);
    }
  }
}

async function main() {
  console.log(`Migrating into ${dataDir()}`);

  const health = migrateHealth();
  if (health.length) await upsertHealth(health);
  console.log(`  health: ${health.length} days`);

  const activities = migrateActivities();
  if (activities.length) await upsertActivities(activities);
  console.log(`  activities: ${activities.length}`);

  const gym = await migrateGym();
  console.log(`  gym sessions: ${gym}`);

  const plan = migratePlan();
  if (plan) await writePlan(plan);
  console.log(`  plan: ${plan ? `${plan.days.length} days (week ${plan.week_start})` : "none"}`);

  copyReference();
  console.log("  reference files copied (exercises.json, mesocycle.json)");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

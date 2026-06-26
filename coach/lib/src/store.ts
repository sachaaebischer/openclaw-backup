import { paths } from "./paths.js";
import { parseCsv, toCsv, num } from "./csv.js";
import {
  ensureDir,
  listFiles,
  readJson,
  readText,
  writeFileAtomic,
  writeJsonAtomic,
} from "./io.js";
import {
  ACTIVITY_COLUMNS,
  Activity,
  ActivitySchema,
  GYM_LOG_COLUMNS,
  GymSession,
  GymSessionSchema,
  HEALTH_COLUMNS,
  HealthDaily,
  HealthDailySchema,
  Plan,
  PlanSchema,
  SyncState,
  SyncStateSchema,
  ConstrainedEvent,
  ConstrainedEventSchema,
  WeekConstraints,
  WeekConstraintsSchema,
  ExerciseCatalog,
  ExerciseCatalogSchema,
} from "./schema.js";

/* ------------------------------- health ------------------------------- */

export async function readHealth(): Promise<HealthDaily[]> {
  const text = await readText(paths.healthCsv());
  if (!text) return [];
  return parseCsv(text).map((r) =>
    HealthDailySchema.parse({
      date: r.date,
      source: r.source,
      sleep_h: num(r.sleep_h),
      sleep_score: num(r.sleep_score),
      hrv: num(r.hrv),
      resting_hr: num(r.resting_hr),
      recovery: num(r.recovery),
      readiness: num(r.readiness),
      steps: num(r.steps),
      calories: num(r.calories),
      active_minutes: num(r.active_minutes),
      vo2_max: num(r.vo2_max),
      weight_kg: num(r.weight_kg),
      notes: r.notes ?? "",
    }),
  );
}

/** Upserts health rows keyed by (date, source). Returns the merged count. */
export async function upsertHealth(records: HealthDaily[]): Promise<number> {
  const existing = await readHealth();
  const byKey = new Map<string, HealthDaily>();
  for (const r of existing) byKey.set(`${r.date}|${r.source}`, r);
  for (const r of records) byKey.set(`${r.date}|${r.source}`, HealthDailySchema.parse(r));
  const merged = [...byKey.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source),
  );
  await writeFileAtomic(paths.healthCsv(), toCsv(HEALTH_COLUMNS as string[], merged));
  return records.length;
}

/* ------------------------------ activities ----------------------------- */

export async function readActivities(): Promise<Activity[]> {
  const text = await readText(paths.activitiesCsv());
  if (!text) return [];
  return parseCsv(text).map((r) =>
    ActivitySchema.parse({
      id: r.id,
      date: r.date,
      start_time: r.start_time ?? "",
      sport: r.sport,
      source: r.source,
      duration_min: num(r.duration_min),
      distance_km: num(r.distance_km),
      avg_hr: num(r.avg_hr),
      max_hr: num(r.max_hr),
      calories: num(r.calories),
      load: num(r.load),
      notes: r.notes ?? "",
    }),
  );
}

/** Upserts activities keyed by `id`. */
export async function upsertActivities(records: Activity[]): Promise<number> {
  const existing = await readActivities();
  const byKey = new Map<string, Activity>();
  for (const r of existing) byKey.set(r.id, r);
  for (const r of records) byKey.set(r.id, ActivitySchema.parse(r));
  const merged = [...byKey.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time),
  );
  await writeFileAtomic(paths.activitiesCsv(), toCsv(ACTIVITY_COLUMNS as string[], merged));
  return records.length;
}

/* --------------------------------- gym -------------------------------- */

export async function readGymSession(date: string): Promise<GymSession | null> {
  const raw = await readJson<unknown>(paths.gymSession(date));
  return raw ? GymSessionSchema.parse(raw) : null;
}

export async function readGymSessions(): Promise<GymSession[]> {
  const files = await listFiles(paths.gymSessionsDir());
  const sessions: GymSession[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const raw = await readJson<unknown>(`${paths.gymSessionsDir()}/${f}`);
    if (raw) sessions.push(GymSessionSchema.parse(raw));
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Persists a gym session JSON and rebuilds gym/log.csv from all sessions so the
 * flat per-set log always matches the source-of-truth session files.
 */
export async function saveGymSession(session: GymSession): Promise<void> {
  const parsed = GymSessionSchema.parse(session);
  await writeJsonAtomic(paths.gymSession(parsed.date), parsed);
  await rebuildGymLog();
}

async function rebuildGymLog(): Promise<void> {
  const sessions = await readGymSessions();
  const rows: Record<string, unknown>[] = [];
  for (const s of sessions) {
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (!set.done) continue;
        rows.push({
          date: s.date,
          session_id: s.id,
          exercise: ex.name,
          set_no: set.set_no,
          reps: set.reps,
          weight: set.weight,
          rpe: set.rpe,
        });
      }
    }
  }
  await writeFileAtomic(paths.gymLogCsv(), toCsv(GYM_LOG_COLUMNS as unknown as string[], rows));
}

/** Most recent prior performance per exercise, used for progressive-overload hints. */
export async function lastExercisePerformance(
  exercise: string,
  beforeDate?: string,
): Promise<{ date: string; reps: number | null; weight: number | null }[] | null> {
  const sessions = (await readGymSessions())
    .filter((s) => (beforeDate ? s.date < beforeDate : true))
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sessions) {
    const ex = s.exercises.find((e) => e.name.toLowerCase() === exercise.toLowerCase());
    if (ex && ex.sets.some((st) => st.done)) {
      return ex.sets
        .filter((st) => st.done)
        .map((st) => ({ date: s.date, reps: st.reps, weight: st.weight }));
    }
  }
  return null;
}


/* ----------------------------- exercise catalog ----------------------- */

export async function readExerciseCatalog(): Promise<ExerciseCatalog> {
  const raw = await readJson<unknown>(paths.gymCatalog());
  return raw ? ExerciseCatalogSchema.parse(raw) : { exercises: [] };
}

export async function writeExerciseCatalog(catalog: ExerciseCatalog): Promise<void> {
  await writeJsonAtomic(paths.gymCatalog(), ExerciseCatalogSchema.parse(catalog));
}

export async function allExerciseHistory(
  name: string,
): Promise<{ date: string; sets: { set_no: number; weight: number | null; reps: number | null; rpe: number | null }[] }[]> {
  const sessions = (await readGymSessions()).sort((a, b) => b.date.localeCompare(a.date));
  const result: { date: string; sets: { set_no: number; weight: number | null; reps: number | null; rpe: number | null }[] }[] = [];
  for (const s of sessions) {
    const ex = s.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (ex && ex.sets.some((st) => st.done)) {
      result.push({
        date: s.date,
        sets: ex.sets
          .filter((st) => st.done)
          .map((st) => ({ set_no: st.set_no, weight: st.weight, reps: st.reps, rpe: st.rpe ?? null })),
      });
    }
  }
  return result;
}

/* --------------------------------- plan ------------------------------- */

export async function readPlan(): Promise<Plan | null> {
  const raw = await readJson<unknown>(paths.planJson());
  return raw ? PlanSchema.parse(raw) : null;
}

export async function writePlan(plan: Plan): Promise<void> {
  await writeJsonAtomic(paths.planJson(), PlanSchema.parse(plan));
}

export async function readAnalysis(): Promise<string | null> {
  return readText(paths.analysisMd());
}

/* --------------------------------- sync ------------------------------- */

export async function readSyncState(): Promise<SyncState> {
  const raw = await readJson<unknown>(paths.syncState());
  if (!raw) return { last_run_at: null, sources: {} };
  return SyncStateSchema.parse(raw);
}

export async function writeSyncState(state: SyncState): Promise<void> {
  await writeJsonAtomic(paths.syncState(), SyncStateSchema.parse(state));
}

/* --------------------------------- raw -------------------------------- */

export async function writeRaw(source: string, date: string, data: unknown): Promise<void> {
  await ensureDir(paths.rawDir(source));
  await writeJsonAtomic(paths.raw(source, date), data);
}

/* ----------------------------- constraints ---------------------------- */

export async function readConstraints(weekStart: string): Promise<WeekConstraints | null> {
  const raw = await readJson<unknown>(paths.constraints(weekStart));
  return raw ? WeekConstraintsSchema.parse(raw) : null;
}

export async function writeConstraints(constraints: WeekConstraints): Promise<void> {
  await ensureDir(paths.constraintsDir());
  await writeJsonAtomic(paths.constraints(constraints.week_start), WeekConstraintsSchema.parse(constraints));
}

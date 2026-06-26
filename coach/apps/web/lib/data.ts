import "server-only";
import {
  Activity,
  GymSession,
  HealthDaily,
  lastExercisePerformance,
  Plan,
  readActivities,
  readAnalysis,
  readGymSession,
  readGymSessions,
  readHealth,
  readPlan,
  readSyncState,
  SyncState,
} from "@coach/lib";

export function todayStr(): string {
  return new Date().toLocaleDateString('sv');
}

export function lastNDays(rows: HealthDaily[], n: number): HealthDaily[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.slice(-n);
}

export interface DashboardData {
  health: HealthDaily[];
  latest: HealthDaily | null;
  prev: HealthDaily | null;
  activities: Activity[];
  plan: Plan | null;
  analysis: string | null;
  sync: SyncState;
}

export async function getDashboardData(): Promise<DashboardData> {
  const [health, activities, plan, analysis, sync] = await Promise.all([
    readHealth(),
    readActivities(),
    readPlan(),
    readAnalysis(),
    readSyncState(),
  ]);

  // Merge all sources per day: primary is the row with the most fields; fill nulls from others.
  const numericFields = ['sleep_h', 'sleep_score', 'hrv', 'resting_hr', 'recovery',
    'readiness', 'steps', 'calories', 'active_minutes', 'vo2_max', 'weight_kg'] as const;
  const byDate = new Map<string, HealthDaily>();
  for (const r of [...health].sort((a, b) => score(b) - score(a))) {
    const existing = byDate.get(r.date);
    if (!existing) {
      byDate.set(r.date, { ...r });
    } else {
      for (const f of numericFields) {
        if (existing[f] === null && r[f] !== null) existing[f] = r[f];
      }
    }
  }
  const dailyHealth = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    health: dailyHealth,
    latest: dailyHealth.at(-1) ?? null,
    prev: dailyHealth.at(-2) ?? null,
    activities: [...activities].sort((a, b) => b.date.localeCompare(a.date)),
    plan,
    analysis,
    sync,
  };
}

function score(r: HealthDaily): number {
  return [r.sleep_h, r.hrv, r.resting_hr, r.recovery, r.readiness].filter((v) => v !== null).length;
}

/* --------------------------------- gym -------------------------------- */

export type LastPerf = Record<
  string,
  { date: string; reps: number | null; weight: number | null }[] | null
>;

export interface GymDayData {
  session: GymSession;
  lastPerf: LastPerf;
  hasSaved: boolean;
}

/** Builds the session to log for a date: the saved one, or a fresh one from the plan. */
export async function getGymDayData(date: string): Promise<GymDayData> {
  const [saved, plan] = await Promise.all([readGymSession(date), readPlan()]);

  let session: GymSession;
  if (saved) {
    session = saved;
  } else {
    const day = plan?.days.find((d) => d.date === date);
    const gymSessions = (day?.sessions ?? []).filter((s) => s.type === "gym");
    const title = gymSessions[0]?.title ?? "Gym session";
    const planned = gymSessions.flatMap((s) => s.exercises);
    session = {
      id: `${date}-gym`,
      date,
      name: title,
      started_at: "",
      finished_at: "",
      notes: "",
      exercises: planned.map((p) => ({
        name: p.name,
        target_sets: p.target_sets,
        target_reps: p.target_reps,
        notes: p.notes,
        sets: Array.from({ length: Math.max(1, p.target_sets ?? 3) }, (_, i) => ({
          set_no: i + 1,
          reps: null,
          weight: p.target_weight ?? null,
          rpe: null,
          done: false,
        })),
      })),
    };
  }

  const names = [...new Set(session.exercises.map((e) => e.name))];
  const lastPerf: LastPerf = {};
  for (const name of names) {
    lastPerf[name] = await lastExercisePerformance(name, date);
  }

  return { session, lastPerf, hasSaved: !!saved };
}

export async function getRecentGymSessions(limit = 10): Promise<GymSession[]> {
  const all = await readGymSessions();
  return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

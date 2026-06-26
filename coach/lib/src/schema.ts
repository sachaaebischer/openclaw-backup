import { z } from "zod";

/**
 * Canonical data model shared by the fetcher, the web apps and the coach agent.
 * These schemas are the single source of truth for what lands in `data/`.
 */

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/** One normalized day of health metrics from a single source. */
export const HealthDailySchema = z.object({
  date: dateStr,
  source: z.string(),
  sleep_h: z.number().nullable().default(null),
  sleep_score: z.number().nullable().default(null),
  hrv: z.number().nullable().default(null),
  resting_hr: z.number().nullable().default(null),
  recovery: z.number().nullable().default(null),
  readiness: z.number().nullable().default(null),
  steps: z.number().nullable().default(null),
  calories: z.number().nullable().default(null),
  active_minutes: z.number().nullable().default(null),
  vo2_max: z.number().nullable().default(null),
  weight_kg: z.number().nullable().default(null),
  notes: z.string().default(""),
});
export type HealthDaily = z.infer<typeof HealthDailySchema>;

/** Column order for health/daily.csv (and the documented contract). */
export const HEALTH_COLUMNS: (keyof HealthDaily)[] = [
  "date",
  "source",
  "sleep_h",
  "sleep_score",
  "hrv",
  "resting_hr",
  "recovery",
  "readiness",
  "steps",
  "calories",
  "active_minutes",
  "vo2_max",
  "weight_kg",
  "notes",
];

/** One workout/activity (floorball, bike, run, …). */
export const ActivitySchema = z.object({
  id: z.string(),
  date: dateStr,
  start_time: z.string().default(""),
  sport: z.string(),
  source: z.string(),
  duration_min: z.number().nullable().default(null),
  distance_km: z.number().nullable().default(null),
  avg_hr: z.number().nullable().default(null),
  max_hr: z.number().nullable().default(null),
  calories: z.number().nullable().default(null),
  load: z.number().nullable().default(null),
  notes: z.string().default(""),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const ACTIVITY_COLUMNS: (keyof Activity)[] = [
  "id",
  "date",
  "start_time",
  "sport",
  "source",
  "duration_min",
  "distance_km",
  "avg_hr",
  "max_hr",
  "calories",
  "load",
  "notes",
];

/** A single logged set within a gym exercise. */
export const GymSetSchema = z.object({
  set_no: z.number().int().positive(),
  reps: z.number().nullable().default(null),
  weight: z.number().nullable().default(null),
  rpe: z.number().nullable().default(null),
  done: z.boolean().default(false),
});
export type GymSet = z.infer<typeof GymSetSchema>;

export const GymExerciseSchema = z.object({
  name: z.string(),
  target_sets: z.number().int().nullable().default(null),
  target_reps: z.string().default(""),
  notes: z.string().default(""),
  sets: z.array(GymSetSchema).default([]),
});
export type GymExercise = z.infer<typeof GymExerciseSchema>;

export const GymSessionSchema = z.object({
  id: z.string(),
  date: dateStr,
  name: z.string().default("Gym session"),
  started_at: z.string().default(""),
  finished_at: z.string().default(""),
  notes: z.string().default(""),
  exercises: z.array(GymExerciseSchema).default([]),
});
export type GymSession = z.infer<typeof GymSessionSchema>;

/** Flat row for gym/log.csv (one row per logged set). */
export const GYM_LOG_COLUMNS = [
  "date",
  "session_id",
  "exercise",
  "set_no",
  "reps",
  "weight",
  "rpe",
] as const;

/** A planned session within a day of the weekly plan. */
export const PlannedSessionSchema = z.object({
  type: z.string(), // gym | floorball | bike | run | rest | ...
  title: z.string(),
  planned_at: z.string().default(""),
  duration_min: z.number().nullable().default(null),
  intensity: z.string().default(""), // easy | moderate | hard | ...
  details: z.string().default(""),
  exercises: z
    .array(
      z.object({
        name: z.string(),
        target_sets: z.number().int().nullable().default(null),
        target_reps: z.string().default(""),
        target_weight: z.number().nullable().default(null),
        notes: z.string().default(""),
      }),
    )
    .default([]),
});
export type PlannedSession = z.infer<typeof PlannedSessionSchema>;

export const PlanDaySchema = z.object({
  date: dateStr,
  weekday: z.string(),
  sessions: z.array(PlannedSessionSchema).default([]),
});
export type PlanDay = z.infer<typeof PlanDaySchema>;

/** The weekly plan the coach agent writes to plan/current.json. */
export const PlanSchema = z.object({
  week_start: dateStr,
  generated_at: z.string(),
  days: z.array(PlanDaySchema),
  notes: z.string().default(""),
});
export type Plan = z.infer<typeof PlanSchema>;

/** Per-source sync bookkeeping in state/last_sync.json. */
export const SyncStateSchema = z.object({
  last_run_at: z.string().nullable().default(null),
  sources: z.record(
    z.object({
      last_run_at: z.string().nullable().default(null),
      status: z.enum(["ok", "error", "never"]).default("never"),
      error: z.string().default(""),
      health_records: z.number().default(0),
      activity_records: z.number().default(0),
    }),
  ),
});
export type SyncState = z.infer<typeof SyncStateSchema>;

/** A fixed/committed session the coach must plan around. */
export const ConstrainedEventSchema = z.object({
  date: dateStr,
  type: z.string(),
  title: z.string(),
  time: z.string().default(""),
  notes: z.string().default(""),
});
export type ConstrainedEvent = z.infer<typeof ConstrainedEventSchema>;

/** All fixed events for a given week. */
export const WeekConstraintsSchema = z.object({
  week_start: dateStr,
  fixed_events: z.array(ConstrainedEventSchema).default([]),
});
export type WeekConstraints = z.infer<typeof WeekConstraintsSchema>;

/** An exercise in the user's personal catalog (persisted in data/gym/catalog.json). */
export const ExerciseCatalogItemSchema = z.object({
  name: z.string(),
  notes: z.string().default(""),
  default_sets: z.number().int().nullable().default(null),
  default_reps: z.string().default(""),
  default_weight: z.number().nullable().default(null),
});
export type ExerciseCatalogItem = z.infer<typeof ExerciseCatalogItemSchema>;

export const ExerciseCatalogSchema = z.object({
  exercises: z.array(ExerciseCatalogItemSchema).default([]),
});
export type ExerciseCatalog = z.infer<typeof ExerciseCatalogSchema>;

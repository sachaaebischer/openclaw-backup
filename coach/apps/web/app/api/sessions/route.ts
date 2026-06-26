import { NextResponse } from "next/server";
import { readGymSessions } from "@coach/lib";

export const dynamic = "force-dynamic";

/**
 * Back-compat: flat per-set gym log in the old shape
 * ({date,time,exercise,weight,reps,set_note}), from the new session files.
 */
export async function GET() {
  const sessions = await readGymSessions();
  const rows: unknown[] = [];
  for (const s of sessions) {
    const time = s.started_at?.slice(11, 19) || "";
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (!set.done) continue;
        rows.push({
          date: s.date,
          time,
          exercise: ex.name,
          weight: set.weight ?? 0,
          reps: set.reps ?? 0,
          set_note: "",
        });
      }
    }
  }
  return NextResponse.json(rows);
}

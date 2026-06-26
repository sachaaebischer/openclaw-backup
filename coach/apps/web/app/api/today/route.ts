import { NextResponse } from "next/server";
import { readPlan } from "@coach/lib";

export const dynamic = "force-dynamic";

/** Back-compat: today's planned session(s) from the new plan. */
export async function GET() {
  const plan = await readPlan();
  const today = new Date().toLocaleDateString('sv');
  const day = plan?.days.find((d) => d.date === today);
  const session = day?.sessions.map((s) => s.title).join(", ") || "Rest";
  return NextResponse.json({ date: today, session, sessions: day?.sessions ?? [] });
}

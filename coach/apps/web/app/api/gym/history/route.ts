import { NextResponse } from "next/server";
import { allExerciseHistory } from "@coach/lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const exercise = searchParams.get("exercise");
  if (!exercise) return NextResponse.json({ error: "missing exercise param" }, { status: 400 });
  const history = await allExerciseHistory(exercise);
  return NextResponse.json(history);
}

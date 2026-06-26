import { NextResponse } from "next/server";
import {
  ExerciseCatalogItemSchema,
  readExerciseCatalog,
  readGymSessions,
  writeExerciseCatalog,
} from "@coach/lib";

export const dynamic = "force-dynamic";

export async function GET() {
  const [catalog, sessions] = await Promise.all([readExerciseCatalog(), readGymSessions()]);
  const catalogNames = new Set(catalog.exercises.map((e) => e.name.toLowerCase()));
  const historyNames = new Set<string>();
  for (const s of sessions) {
    for (const e of s.exercises) historyNames.add(e.name);
  }
  // Names that exist in history but not in catalog (no notes/defaults)
  const orphans = [...historyNames].filter((n) => !catalogNames.has(n.toLowerCase()));
  return NextResponse.json({ exercises: catalog.exercises, historyNames: [...historyNames], orphans });
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const parsed = ExerciseCatalogItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid item", issues: parsed.error.issues }, { status: 400 });

  const catalog = await readExerciseCatalog();
  const idx = catalog.exercises.findIndex((e) => e.name.toLowerCase() === parsed.data.name.toLowerCase());
  if (idx >= 0) {
    catalog.exercises[idx] = parsed.data;
  } else {
    catalog.exercises.push(parsed.data);
  }
  catalog.exercises.sort((a, b) => a.name.localeCompare(b.name));
  await writeExerciseCatalog(catalog);
  return NextResponse.json({ ok: true });
}

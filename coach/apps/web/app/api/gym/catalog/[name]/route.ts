import { NextResponse } from "next/server";
import { ExerciseCatalogItemSchema, readExerciseCatalog, writeExerciseCatalog } from "@coach/lib";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const parsed = ExerciseCatalogItemSchema.safeParse({ ...body as object, name });
  if (!parsed.success) return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });

  const catalog = await readExerciseCatalog();
  const idx = catalog.exercises.findIndex((e) => e.name.toLowerCase() === name.toLowerCase());
  if (idx >= 0) {
    catalog.exercises[idx] = parsed.data;
  } else {
    catalog.exercises.push(parsed.data);
  }
  catalog.exercises.sort((a, b) => a.name.localeCompare(b.name));
  await writeExerciseCatalog(catalog);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const catalog = await readExerciseCatalog();
  catalog.exercises = catalog.exercises.filter((e) => e.name.toLowerCase() !== name.toLowerCase());
  await writeExerciseCatalog(catalog);
  return NextResponse.json({ ok: true });
}

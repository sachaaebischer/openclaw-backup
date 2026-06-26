import { NextResponse } from "next/server";
import { GymSessionSchema, readGymSession, saveGymSession } from "@coach/lib";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { date: string } }) {
  const session = await readGymSession(params.date);
  return NextResponse.json(session ?? null);
}

export async function POST(req: Request, { params }: { params: { date: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = GymSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid session", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  if (parsed.data.date !== params.date) {
    return NextResponse.json({ error: "date mismatch" }, { status: 400 });
  }

  await saveGymSession(parsed.data);
  return NextResponse.json({ ok: true });
}

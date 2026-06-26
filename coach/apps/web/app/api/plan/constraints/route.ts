import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { WeekConstraintsSchema, readConstraints, writeConstraints } from "@coach/lib";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return NextResponse.json({ error: "invalid week parameter" }, { status: 400 });
  }
  const constraints = await readConstraints(week);
  return NextResponse.json(constraints ?? { week_start: week, fixed_events: [] });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = WeekConstraintsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid constraints", issues: parsed.error.issues }, { status: 400 });
  }
  await writeConstraints(parsed.data);

  // Fire a one-shot replan job. Errors here are non-fatal.
  try {
    injectReplanJob(parsed.data.week_start);
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true });
}

function injectReplanJob(weekStart: string): void {
  const jobsPath = path.join(os.homedir(), ".openclaw", "cron", "jobs.json");
  const raw = JSON.parse(fs.readFileSync(jobsPath, "utf8"));

  // Remove any pending replan jobs to avoid duplicates.
  raw.jobs = (raw.jobs as any[]).filter((j: any) => j.name !== "Re-plan (constraint update)");

  const today = new Date().toLocaleDateString("sv");
  const id = randomUUID();

  raw.jobs.push({
    id,
    agentId: "fitness",
    name: "Re-plan (constraint update)",
    enabled: true,
    deleteAfterRun: true,
    createdAtMs: Date.now(),
    schedule: { kind: "cron", expr: "* * * * *", tz: "Europe/Zurich" },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: {
      kind: "agentTurn",
      message:
        `Constraints for the week of ${weekStart} were just updated via the dashboard. Re-plan the week now.\n\n` +
        `Rules:\n` +
        `- Read data/plan/constraints/${weekStart}.json for Sacha's fixed committed events — these cannot be moved.\n` +
        `- Do NOT change any sessions scheduled before today (${today}). Only re-plan from today onwards.\n` +
        `- Follow the full AGENT.md workflow: check summary.json, health/daily.csv, activities.csv, gym/log.csv.\n` +
        `- Write the updated plan to data/plan/current.json (week_start = ${weekStart}), then run:\n` +
        `  COACH_DATA_DIR=/home/sacha/.openclaw/agents/fitness/workspace/data npm run validate-plan --workspace @coach/fetcher\n` +
        `- Fix any schema errors until it says "Plan OK".\n` +
        `- Write updated data/analysis/latest.md.\n` +
        `- Send Sacha a brief Telegram message summarising what changed.`,
      timeoutSeconds: 600,
    },
    delivery: {
      mode: "announce",
      channel: "telegram",
      to: "telegram:7789196354",
    },
    state: {},
  });

  // Atomic write: temp file → rename.
  const tmp = `${jobsPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(raw, null, 2) + "\n");
  fs.renameSync(tmp, jobsPath);
}

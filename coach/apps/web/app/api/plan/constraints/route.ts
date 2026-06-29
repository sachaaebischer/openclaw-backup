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

// Returns a cron expression that fires exactly once, ~2 minutes from now (UTC).
// Combined with deleteAfterRun:true this guarantees a single execution and prevents
// the job from repeating every minute if deleteAfterRun is delayed.
function oneShotCron(): string {
  const t = new Date(Date.now() + 2 * 60 * 1000);
  return `${t.getUTCMinutes()} ${t.getUTCHours()} ${t.getUTCDate()} ${t.getUTCMonth() + 1} *`;
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
    // One-shot schedule: fires exactly once at a specific UTC time ~2 min from now.
    schedule: { kind: "cron", expr: oneShotCron(), tz: "UTC" },
    sessionTarget: "isolated",
    payload: {
      kind: "agentTurn",
      message:
        `CONSTRAINTS UPDATE — Re-plan the week of ${weekStart} NOW.\n\n` +
        `HARD RULES (non-negotiable — do NOT deviate under any circumstances):\n` +
        `- The fixed_events in data/plan/constraints/${weekStart}.json are ABSOLUTE COMMITMENTS.\n` +
        `  They cannot be moved, skipped, or overridden — not for training load, not for recovery, not for any reason.\n` +
        `- Do NOT change any sessions already completed before today (${today}). Only re-plan from today onwards.\n` +
        `- If a constraint conflicts with good training practice, ALWAYS honour the constraint and adjust everything else around it.\n\n` +
        `Workflow:\n` +
        `1. Read data/plan/constraints/${weekStart}.json — note every fixed_event date and type.\n` +
        `2. Read data/state/summary.json, data/health/daily.csv, data/activities/activities.csv, data/gym/log.csv.\n` +
        `3. Write an updated plan to data/plan/current.json (week_start = ${weekStart}) that:\n` +
        `   - Places each fixed_event exactly on its stated date with no exceptions.\n` +
        `   - Fills the remaining days with appropriate training/rest.\n` +
        `4. Run validation:\n` +
        `   COACH_DATA_DIR=/home/sacha/.openclaw/agents/fitness/workspace/data npm run validate-plan --workspace @coach/fetcher\n` +
        `   Fix any schema errors until it says "Plan OK".\n` +
        `5. Write updated data/analysis/latest.md.\n` +
        `6. Send Sacha ONE concise Telegram message summarising what changed. Do not send multiple messages.`,
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

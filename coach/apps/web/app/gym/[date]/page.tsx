import Link from "next/link";
import { getGymDayData } from "@/lib/data";
import { GymLogger } from "@/app/components/GymLogger";

export const dynamic = "force-dynamic";

export default async function GymDatePage({ params }: { params: { date: string } }) {
  const { date } = params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return <div className="card text-bad">Invalid date.</div>;
  }

  const { session, lastPerf, hasSaved } = await getGymDayData(date);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/gym" className="btn-ghost">
          ← Gym
        </Link>
        <div className="ml-1">
          <div className="font-semibold">{session.name}</div>
          <div className="text-xs text-muted">
            {date} {hasSaved ? "· editing saved session" : "· new session"}
          </div>
        </div>
      </div>

      {session.exercises.length === 0 ? (
        <div className="card text-sm text-muted">
          No exercises planned for this day. The coach agent sets these in{" "}
          <code>data/plan/current.json</code>.
        </div>
      ) : (
        <GymLogger initial={session} lastPerf={lastPerf} />
      )}
    </div>
  );
}

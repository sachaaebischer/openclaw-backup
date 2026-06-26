import Link from "next/link";
import { getRecentGymSessions, todayStr } from "@/lib/data";
import { readPlan } from "@coach/lib";
import { DateSessionPicker } from "@/app/components/DateSessionPicker";

export const dynamic = "force-dynamic";

export default async function GymIndexPage() {
  const today = todayStr();
  const [plan, recent] = await Promise.all([readPlan(), getRecentGymSessions(10)]);

  const gymDays = (plan?.days ?? [])
    .filter((d) => d.sessions.some((s) => s.type === "gym"))
    .map((d) => ({
      date: d.date,
      weekday: d.weekday,
      title: d.sessions.find((s) => s.type === "gym")?.title ?? "Gym session",
    }));

  const todayGym = gymDays.find((d) => d.date === today);

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center">
          <h2 className="text-sm font-semibold text-muted">Today</h2>
          <Link href="/gym/exercises" className="ml-auto text-xs text-accent">Manage exercises →</Link>
        </div>
        {todayGym ? (
          <Link href={`/gym/${today}`} className="card flex items-center gap-3 hover:bg-white/5">
            <span className="text-2xl">🏋️</span>
            <div>
              <div className="font-medium">{todayGym.title}</div>
              <div className="text-xs text-muted">{today} · tap to log</div>
            </div>
            <span className="btn ml-auto">Start →</span>
          </Link>
        ) : (
          <Link href={`/gym/${today}`} className="card flex items-center gap-3 hover:bg-white/5">
            <span className="text-2xl">🏋️</span>
            <div>
              <div className="font-medium">Ad-hoc session</div>
              <div className="text-xs text-muted">{today} · no session planned</div>
            </div>
            <span className="btn ml-auto">Log →</span>
          </Link>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted">Open session for a date</h2>
        <DateSessionPicker />
      </section>

      {gymDays.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">This week's gym days</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {gymDays.map((d) => (
              <Link
                key={d.date}
                href={`/gym/${d.date}`}
                className={`card hover:bg-white/5 ${d.date === today ? "ring-1 ring-accent" : ""}`}
              >
                <div className="text-sm font-medium">{d.weekday}</div>
                <div className="truncate text-xs text-muted">{d.title}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted">Recent sessions</h2>
        <div className="space-y-2">
          {recent.length === 0 && <div className="card text-sm text-muted">No logged sessions yet.</div>}
          {recent.map((s) => {
            const sets = s.exercises.reduce((n, e) => n + e.sets.filter((st) => st.done).length, 0);
            return (
              <Link key={s.date} href={`/gym/${s.date}`} className="card flex items-center gap-3 hover:bg-white/5">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted">
                    {s.date} · {s.exercises.length} exercises · {sets} sets
                  </div>
                </div>
                <span className="ml-auto text-accent">→</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

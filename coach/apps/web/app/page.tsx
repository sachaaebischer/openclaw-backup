import Link from "next/link";
import { getDashboardData, todayStr } from "@/lib/data";
import { LoadChart, SleepHrvChart } from "@/app/components/Charts";
import { Markdown } from "@/app/components/Markdown";
import { PlanSessionCard } from "@/app/components/PlanSessionCard";
import type { HealthDaily } from "@coach/lib";

export const dynamic = "force-dynamic";

function dateRange(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(x.toLocaleDateString('sv'));
  }
  return out;
}

function fmt(v: number | null, digits = 0): string {
  return v === null ? "—" : v.toFixed(digits);
}

function Delta({ now, prev, invert }: { now: number | null; prev: number | null; invert?: boolean }) {
  if (now === null || prev === null) return null;
  const diff = Math.round((now - prev) * 10) / 10;
  if (diff === 0) return <span className="text-muted text-xs">±0</span>;
  const positive = invert ? diff < 0 : diff > 0;
  return (
    <span className={`text-xs ${positive ? "text-good" : "text-bad"}`}>
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}
    </span>
  );
}

function Stat({
  label,
  value,
  unit,
  now,
  prev,
  invert,
}: {
  label: string;
  value: string;
  unit?: string;
  now: number | null;
  prev: number | null;
  invert?: boolean;
}) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="stat">{value}</span>
        {unit && <span className="text-muted text-sm">{unit}</span>}
        <span className="ml-auto">
          <Delta now={now} prev={prev} invert={invert} />
        </span>
      </div>
    </div>
  );
}


const typeIcon: Record<string, string> = {
  gym: "🏋️",
  floorball: "🏑",
  bike: "🚴",
  cycling: "🚴",
  run: "🏃",
  running: "🏃",
  rest: "😴",
};

export default async function DashboardPage() {
  const { health, latest, prev, activities, plan, analysis, sync } = await getDashboardData();
  const today = todayStr();

  const range = dateRange(21);
  const byDate = new Map<string, HealthDaily>(health.map((h) => [h.date, h]));
  const sleepHrv = range.map((d) => ({
    date: d,
    sleep_h: byDate.get(d)?.sleep_h ?? null,
    hrv: byDate.get(d)?.hrv ?? null,
  }));

  const loadByDate = new Map<string, number>();
  for (const a of activities) {
    loadByDate.set(a.date, (loadByDate.get(a.date) ?? 0) + (a.load ?? 0));
  }
  const loadSeries = range.map((d) => ({ date: d, load: Math.round(loadByDate.get(d) ?? 0) }));

  return (
    <div className="space-y-6">
      {/* Readiness */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted">
          Readiness {latest ? `· ${latest.date}` : ""}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Sleep" value={fmt(latest?.sleep_h ?? null, 1)} unit="h" now={latest?.sleep_h ?? null} prev={prev?.sleep_h ?? null} />
          <Stat label="HRV" value={fmt(latest?.hrv ?? null)} unit="ms" now={latest?.hrv ?? null} prev={prev?.hrv ?? null} />
          <Stat label="Resting HR" value={fmt(latest?.resting_hr ?? null)} unit="bpm" now={latest?.resting_hr ?? null} prev={prev?.resting_hr ?? null} invert />
          <Stat label="Recovery" value={fmt(latest?.recovery ?? latest?.readiness ?? null)} now={latest?.recovery ?? latest?.readiness ?? null} prev={prev?.recovery ?? prev?.readiness ?? null} />
        </div>
      </section>

      {/* Week plan */}
      <section>
        <div className="mb-2 flex items-center">
          <h2 className="text-sm font-semibold text-muted">
            This week {plan ? `· from ${plan.week_start}` : ""}
          </h2>
          <Link href="/gym" className="ml-auto text-xs text-accent">
            Go to gym →
          </Link>
        </div>
        {plan ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {plan.days.map((day) => (
              <div
                key={day.date}
                className={`card ${day.date === today ? "ring-1 ring-accent" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{day.weekday}</span>
                  <span className="text-xs text-muted">{day.date.slice(5)}</span>
                </div>
                <div className="mt-2 space-y-2">
                  {day.sessions.length === 0 && <div className="text-sm text-muted">—</div>}
                  {day.sessions.map((s, i) => (
                    <PlanSessionCard
                      key={i}
                      session={s}
                      gymDate={s.type === "gym" ? `/gym/${day.date}` : undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-sm text-muted">
            No plan yet. The coach agent writes <code>data/plan/current.json</code>.
          </div>
        )}
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card">
          <div className="label mb-2">Sleep &amp; HRV · 21 days</div>
          <SleepHrvChart data={sleepHrv} />
        </div>
        <div className="card">
          <div className="label mb-2">Training load · 21 days</div>
          <LoadChart data={loadSeries} />
        </div>
      </section>

      {/* Recent activities + analysis */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card">
          <div className="label mb-2">Recent activities</div>
          <div className="space-y-1">
            {activities.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center gap-2 border-b border-cardborder/50 py-1.5 text-sm last:border-0">
                <span>{typeIcon[a.sport] ?? "•"}</span>
                <span className="capitalize">{a.sport}</span>
                <span className="ml-auto text-muted">
                  {a.duration_min ? `${a.duration_min}m` : ""}
                  {a.distance_km ? ` · ${a.distance_km}km` : ""}
                  {a.load ? ` · load ${a.load}` : ""}
                </span>
                <span className="w-16 text-right text-xs text-muted">{a.date.slice(5)}</span>
              </div>
            ))}
            {activities.length === 0 && <div className="text-sm text-muted">No activities yet.</div>}
          </div>
        </div>
        <div className="card">
          <div className="label mb-2">Coach analysis</div>
          {analysis ? (
            <Markdown>{analysis}</Markdown>
          ) : (
            <div className="text-sm text-muted">
              No analysis yet. The coach agent writes <code>data/analysis/latest.md</code>.
            </div>
          )}
        </div>
      </section>

      {/* Sync status */}
      <section>
        <div className="card">
          <div className="label mb-2">Sync status</div>
          <div className="flex flex-wrap gap-3 text-sm">
            {Object.entries(sync.sources).length === 0 && (
              <span className="text-muted">No syncs yet. Run the fetcher.</span>
            )}
            {Object.entries(sync.sources).map(([name, s]) => (
              <div key={name} className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${s.status === "ok" ? "bg-good" : s.status === "error" ? "bg-bad" : "bg-muted"}`}
                />
                <span className="capitalize">{name}</span>
                <span className="text-xs text-muted">
                  {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : "never"}
                  {s.status === "error" && s.error ? ` · ${s.error}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

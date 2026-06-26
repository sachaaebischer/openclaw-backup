"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GymSession } from "@coach/lib";
import type { LastPerf } from "@/lib/data";

type SaveState = "idle" | "saving" | "saved" | "error";

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function GymLogger({ initial, lastPerf }: { initial: GymSession; lastPerf: LastPerf }) {
  const router = useRouter();
  const [session, setSession] = useState<GymSession>(initial);
  const [save, setSave] = useState<SaveState>("idle");

  const [isDirty, setIsDirty] = useState(false);
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ---- rest timer ----
  const [restLeft, setRestLeft] = useState(0);
  const [restTotal, setRestTotal] = useState(120);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (restLeft <= 0) {
      if (tick.current) clearInterval(tick.current);
      return;
    }
    tick.current = setInterval(() => setRestLeft((s) => Math.max(0, s - 1)), 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [restLeft > 0]);
  const startRest = (secs = restTotal) => {
    setRestTotal(secs);
    setRestLeft(secs);
  };

  function update(fn: (draft: GymSession) => void) {
    setSession((prev) => {
      const next: GymSession = structuredClone(prev);
      fn(next);
      return next;
    });
    setSave("idle");
    setIsDirty(true);
  }

  function setField(exIdx: number, setIdx: number, field: "reps" | "weight" | "rpe", value: string) {
    update((d) => {
      (d.exercises[exIdx].sets[setIdx][field] as number | null) = num(value);
    });
  }

  function toggleDone(exIdx: number, setIdx: number) {
    update((d) => {
      const set = d.exercises[exIdx].sets[setIdx];
      set.done = !set.done;
      if (set.done && !d.started_at) d.started_at = new Date().toISOString();
    });
    // Auto-start rest timer when completing a set.
    const wasDone = session.exercises[exIdx].sets[setIdx].done;
    if (!wasDone) startRest();
  }

  function addSet(exIdx: number) {
    update((d) => {
      const sets = d.exercises[exIdx].sets;
      const last = sets[sets.length - 1];
      sets.push({
        set_no: sets.length + 1,
        reps: last?.reps ?? null,
        weight: last?.weight ?? null,
        rpe: null,
        done: false,
      });
    });
  }

  async function persist() {
    setSave("saving");
    const payload: GymSession = {
      ...session,
      started_at: session.started_at || new Date().toISOString(),
      finished_at: new Date().toISOString(),
    };
    try {
      const res = await fetch(`/api/gym/${session.date}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      setSession(payload);
      setSave("saved");
      setIsDirty(false);
      router.refresh();
    } catch (e) {
      console.error(e);
      setSave("error");
    }
  }

  return (
    <div className="space-y-3 pb-28">
      {session.exercises.map((ex, exIdx) => {
        const prev = lastPerf[ex.name];
        return (
          <div key={exIdx} className="card">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">{ex.name}</h3>
              <span className="text-xs text-muted">
                {ex.target_sets ? `${ex.target_sets} × ${ex.target_reps || "?"}` : ex.target_reps}
              </span>
            </div>
            {prev && prev.length > 0 && (
              <div className="mt-0.5 text-xs text-muted">
                Last: {prev.map((p) => `${p.weight ?? "–"}×${p.reps ?? "–"}`).join(", ")}
              </div>
            )}

            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-[24px_1fr_1fr_1fr_40px] items-center gap-2 text-xs text-muted">
                <span>#</span>
                <span className="text-center">kg</span>
                <span className="text-center">reps</span>
                <span className="text-center">rpe</span>
                <span></span>
              </div>
              {ex.sets.map((set, setIdx) => (
                <div
                  key={setIdx}
                  className={`grid grid-cols-[24px_1fr_1fr_1fr_40px] items-center gap-2 ${set.done ? "opacity-60" : ""}`}
                >
                  <span className="text-center text-sm text-muted">{set.set_no}</span>
                  <input
                    className="input"
                    inputMode="decimal"
                    defaultValue={set.weight ?? ""}
                    placeholder="–"
                    onChange={(e) => setField(exIdx, setIdx, "weight", e.target.value)}
                  />
                  <input
                    className="input"
                    inputMode="numeric"
                    defaultValue={set.reps ?? ""}
                    placeholder="–"
                    onChange={(e) => setField(exIdx, setIdx, "reps", e.target.value)}
                  />
                  <input
                    className="input"
                    inputMode="decimal"
                    defaultValue={set.rpe ?? ""}
                    placeholder="–"
                    onChange={(e) => setField(exIdx, setIdx, "rpe", e.target.value)}
                  />
                  <button
                    onClick={() => toggleDone(exIdx, setIdx)}
                    className={`h-9 w-9 rounded-lg border text-lg ${set.done ? "border-good bg-good/20 text-good" : "border-cardborder text-muted"}`}
                    aria-label="mark set done"
                  >
                    ✓
                  </button>
                </div>
              ))}
              <button onClick={() => addSet(exIdx)} className="btn-ghost w-full">
                + Add set
              </button>
            </div>
          </div>
        );
      })}

      <div className="card">
        <div className="label mb-1">Session notes</div>
        <textarea
          className="w-full rounded-lg border border-cardborder bg-bg p-2 text-sm outline-none focus:border-accent"
          rows={2}
          defaultValue={session.notes}
          onChange={(e) => update((d) => (d.notes = e.target.value))}
        />
      </div>

      {/* Sticky action bar: rest timer + save */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-cardborder bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <div className="flex items-center gap-1">
            <span className="w-12 text-center text-lg font-semibold tabular-nums">
              {restLeft > 0 ? `${Math.floor(restLeft / 60)}:${String(restLeft % 60).padStart(2, "0")}` : "—"}
            </span>
            {[90, 120, 180].map((s) => (
              <button key={s} onClick={() => startRest(s)} className="btn-ghost px-2 py-1 text-xs">
                {s}s
              </button>
            ))}
            {restLeft > 0 && (
              <button onClick={() => setRestLeft(0)} className="btn-ghost px-2 py-1 text-xs">
                stop
              </button>
            )}
          </div>
          <button onClick={persist} className="btn ml-auto" disabled={save === "saving"}>
            {save === "saving" ? "Saving…" : save === "saved" ? "Saved ✓" : save === "error" ? "Retry" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

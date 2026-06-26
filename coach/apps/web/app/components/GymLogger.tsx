"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GymSession } from "@coach/lib";
import type { ExerciseCatalogItem } from "@coach/lib";
import type { LastPerf } from "@/lib/data";

type SaveState = "idle" | "saving" | "saved" | "error";
type HistoryEntry = { date: string; sets: { set_no: number; weight: number | null; reps: number | null; rpe: number | null }[] };

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* ────────────────────────── AddExercise drawer ─────────────────────── */
function AddExerciseDrawer({
  catalog,
  onAdd,
  onClose,
}: {
  catalog: ExerciseCatalogItem[];
  onAdd: (item: ExerciseCatalogItem) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");

  const filtered = q.trim()
    ? catalog.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
    : catalog;

  const exactMatch = catalog.some((e) => e.name.toLowerCase() === q.toLowerCase());

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-cardborder bg-bg p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <span className="font-semibold">Add exercise</span>
          <button onClick={onClose} className="ml-auto text-muted">✕</button>
        </div>
        <input
          autoFocus
          className="input mb-3 w-full"
          placeholder="Search or type new name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {filtered.map((ex) => (
          <button
            key={ex.name}
            onClick={() => onAdd(ex)}
            className="flex w-full items-start gap-2 rounded-lg p-2 text-left hover:bg-white/5"
          >
            <div>
              <div className="text-sm font-medium">{ex.name}</div>
              {ex.notes && <div className="text-xs italic text-muted">{ex.notes}</div>}
              <div className="text-xs text-muted">
                {[ex.default_sets && `${ex.default_sets}×`, ex.default_reps, ex.default_weight && `${ex.default_weight}kg`].filter(Boolean).join(" ")}
              </div>
            </div>
          </button>
        ))}
        {q.trim() && !exactMatch && (
          <button
            onClick={() => onAdd({ name: q.trim(), notes: "", default_sets: null, default_reps: "", default_weight: null })}
            className="mt-1 flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-white/5"
          >
            <span className="text-accent">+</span>
            <span className="text-sm">Add "{q.trim()}" as new exercise</span>
          </button>
        )}
        {filtered.length === 0 && !q.trim() && (
          <div className="py-4 text-center text-sm text-muted">No exercises in catalog yet. <br/>Type a name above to add one.</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── History panel ─────────────────────────── */
function HistoryPanel({ name, onClose }: { name: string; onClose: () => void }) {
  const [data, setData] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    fetch(`/api/gym/history?exercise=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then(setData);
  }, [name]);

  return (
    <div className="mt-2 rounded-lg border border-cardborder/50 bg-bg/50 p-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-muted">History</span>
        <button onClick={onClose} className="text-muted">✕</button>
      </div>
      {data === null && <div className="text-muted">Loading…</div>}
      {data?.length === 0 && <div className="text-muted">No history yet.</div>}
      {data?.map((entry) => (
        <div key={entry.date} className="py-1 border-t border-cardborder/30 first:border-0">
          <div className="text-muted mb-0.5">{entry.date}</div>
          <div className="flex flex-wrap gap-1">
            {entry.sets.map((s, i) => (
              <span key={i} className="rounded bg-cardborder/40 px-1.5 py-0.5">
                {s.weight ?? "–"}×{s.reps ?? "–"}{s.rpe ? ` @${s.rpe}` : ""}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── main component ────────────────────────── */
export function GymLogger({
  initial,
  lastPerf,
  catalog,
}: {
  initial: GymSession;
  lastPerf: LastPerf;
  catalog: ExerciseCatalogItem[];
}) {
  const router = useRouter();
  const [session, setSession] = useState<GymSession>(initial);
  const [save, setSave] = useState<SaveState>("idle");
  const [isDirty, setIsDirty] = useState(false);
  const [historyOpen, setHistoryOpen] = useState<Set<number>>(new Set());
  const [notesOpen, setNotesOpen] = useState<Set<number>>(new Set());
  const [addExOpen, setAddExOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── rest timer ──
  const [restLeft, setRestLeft] = useState(0);
  const [restTotal, setRestTotal] = useState(120);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (restLeft <= 0) { if (tick.current) clearInterval(tick.current); return; }
    tick.current = setInterval(() => setRestLeft((s) => Math.max(0, s - 1)), 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [restLeft > 0]);
  const startRest = (secs = restTotal) => { setRestTotal(secs); setRestLeft(secs); };

  function update(fn: (draft: GymSession) => void) {
    setSession((prev) => { const next: GymSession = structuredClone(prev); fn(next); return next; });
    setSave("idle");
    setIsDirty(true);
  }

  // ── set operations ──
  function setField(exIdx: number, setIdx: number, field: "reps" | "weight" | "rpe", value: string) {
    update((d) => { (d.exercises[exIdx].sets[setIdx][field] as number | null) = num(value); });
  }

  function toggleDone(exIdx: number, setIdx: number) {
    const wasDone = session.exercises[exIdx].sets[setIdx].done;
    update((d) => {
      const s = d.exercises[exIdx].sets[setIdx];
      s.done = !s.done;
      if (s.done && !d.started_at) d.started_at = new Date().toISOString();
    });
    if (!wasDone) startRest();
  }

  function addSet(exIdx: number) {
    update((d) => {
      const sets = d.exercises[exIdx].sets;
      const last = sets[sets.length - 1];
      sets.push({ set_no: sets.length + 1, reps: last?.reps ?? null, weight: last?.weight ?? null, rpe: null, done: false });
    });
  }

  function removeSet(exIdx: number, setIdx: number) {
    update((d) => {
      d.exercises[exIdx].sets.splice(setIdx, 1);
      d.exercises[exIdx].sets.forEach((s, i) => { s.set_no = i + 1; });
    });
  }

  // ── exercise operations ──
  function removeExercise(exIdx: number) {
    if (!confirm(`Remove "${session.exercises[exIdx].name}" from this session?`)) return;
    setHistoryOpen((s) => { const n = new Set(s); n.delete(exIdx); return n; });
    setNotesOpen((s) => { const n = new Set(s); n.delete(exIdx); return n; });
    update((d) => { d.exercises.splice(exIdx, 1); });
  }

  function addExercise(item: ExerciseCatalogItem) {
    update((d) => {
      d.exercises.push({
        name: item.name,
        target_sets: item.default_sets,
        target_reps: item.default_reps,
        notes: item.notes,
        sets: Array.from({ length: Math.max(1, item.default_sets ?? 3) }, (_, i) => ({
          set_no: i + 1, reps: null, weight: item.default_weight ?? null, rpe: null, done: false,
        })),
      });
    });
    setAddExOpen(false);
  }

  function updateExNotes(exIdx: number, notes: string) {
    update((d) => { d.exercises[exIdx].notes = notes; });
  }

  async function persist() {
    setSave("saving");
    const payload: GymSession = { ...session, started_at: session.started_at || new Date().toISOString(), finished_at: new Date().toISOString() };
    try {
      const res = await fetch(`/api/gym/${session.date}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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
      {/* Session name */}
      {editingName ? (
        <input
          autoFocus
          className="input w-full text-base font-semibold"
          value={session.name}
          onChange={(e) => update((d) => { d.name = e.target.value; })}
          onBlur={() => setEditingName(false)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditingName(false); }}
        />
      ) : (
        <button onClick={() => setEditingName(true)} className="w-full rounded-lg p-1 text-left text-base font-semibold hover:bg-white/5">
          {session.name} <span className="text-xs font-normal text-muted">✏️</span>
        </button>
      )}

      {/* Exercise cards */}
      {session.exercises.map((ex, exIdx) => {
        const prev = lastPerf[ex.name];
        const showHistory = historyOpen.has(exIdx);
        const showNotes = notesOpen.has(exIdx);
        return (
          <div key={exIdx} className="card">
            {/* Header */}
            <div className="flex items-start gap-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1">
                  <h3 className="font-semibold">{ex.name}</h3>
                  <span className="text-xs text-muted">
                    {ex.target_sets ? `${ex.target_sets} × ${ex.target_reps || "?"}` : ex.target_reps}
                  </span>
                </div>
                {ex.notes && !showNotes && (
                  <div className="mt-0.5 text-xs italic text-muted">{ex.notes}</div>
                )}
              </div>
              {/* Action buttons */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setNotesOpen((s) => { const n = new Set(s); showNotes ? n.delete(exIdx) : n.add(exIdx); return n; })}
                  title="Notes / cues"
                  className="btn-ghost px-1.5 py-1 text-xs"
                >📝</button>
                <button
                  onClick={() => setHistoryOpen((s) => { const n = new Set(s); showHistory ? n.delete(exIdx) : n.add(exIdx); return n; })}
                  title="History"
                  className="btn-ghost px-1.5 py-1 text-xs"
                >📊</button>
                <button
                  onClick={() => removeExercise(exIdx)}
                  title="Remove exercise"
                  className="btn-ghost px-1.5 py-1 text-xs text-bad"
                >✕</button>
              </div>
            </div>

            {/* Inline notes editor */}
            {showNotes && (
              <div className="mt-2">
                <textarea
                  className="w-full rounded-lg border border-cardborder bg-bg p-2 text-xs outline-none focus:border-accent"
                  rows={2}
                  placeholder="Seat position, grip, cues…"
                  value={ex.notes}
                  onChange={(e) => updateExNotes(exIdx, e.target.value)}
                />
              </div>
            )}

            {/* Last perf */}
            {prev && prev.length > 0 && (
              <div className="mt-0.5 text-xs text-muted">
                Last: {prev.map((p) => `${p.weight ?? "–"}×${p.reps ?? "–"}`).join(", ")}
              </div>
            )}

            {/* Sets */}
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-[20px_1fr_1fr_1fr_36px_28px] items-center gap-1.5 text-xs text-muted">
                <span>#</span><span className="text-center">kg</span><span className="text-center">reps</span><span className="text-center">rpe</span><span></span><span></span>
              </div>
              {ex.sets.map((set, setIdx) => (
                <div key={setIdx} className={`grid grid-cols-[20px_1fr_1fr_1fr_36px_28px] items-center gap-1.5 ${set.done ? "opacity-60" : ""}`}>
                  <span className="text-center text-xs text-muted">{set.set_no}</span>
                  <input className="input" inputMode="decimal" defaultValue={set.weight ?? ""} placeholder="–" onChange={(e) => setField(exIdx, setIdx, "weight", e.target.value)} />
                  <input className="input" inputMode="numeric" defaultValue={set.reps ?? ""} placeholder="–" onChange={(e) => setField(exIdx, setIdx, "reps", e.target.value)} />
                  <input className="input" inputMode="decimal" defaultValue={set.rpe ?? ""} placeholder="–" onChange={(e) => setField(exIdx, setIdx, "rpe", e.target.value)} />
                  <button onClick={() => toggleDone(exIdx, setIdx)} className={`h-8 w-8 rounded-lg border text-base ${set.done ? "border-good bg-good/20 text-good" : "border-cardborder text-muted"}`} aria-label="mark done">✓</button>
                  <button onClick={() => removeSet(exIdx, setIdx)} className="h-8 w-7 rounded-lg text-xs text-bad hover:bg-bad/10" aria-label="remove set">✕</button>
                </div>
              ))}
              <button onClick={() => addSet(exIdx)} className="btn-ghost w-full text-sm">+ Add set</button>
            </div>

            {/* History panel */}
            {showHistory && <HistoryPanel name={ex.name} onClose={() => setHistoryOpen((s) => { const n = new Set(s); n.delete(exIdx); return n; })} />}
          </div>
        );
      })}

      {/* Add exercise */}
      <button onClick={() => setAddExOpen(true)} className="btn-ghost w-full">+ Add exercise</button>

      {/* Session notes */}
      <div className="card">
        <div className="label mb-1">Session notes</div>
        <textarea
          className="w-full rounded-lg border border-cardborder bg-bg p-2 text-sm outline-none focus:border-accent"
          rows={2}
          defaultValue={session.notes}
          onChange={(e) => update((d) => { d.notes = e.target.value; })}
        />
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-cardborder bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <div className="flex items-center gap-1">
            <span className="w-12 text-center text-lg font-semibold tabular-nums">
              {restLeft > 0 ? `${Math.floor(restLeft / 60)}:${String(restLeft % 60).padStart(2, "0")}` : "—"}
            </span>
            {[90, 120, 180].map((s) => (
              <button key={s} onClick={() => startRest(s)} className="btn-ghost px-2 py-1 text-xs">{s}s</button>
            ))}
            {restLeft > 0 && <button onClick={() => setRestLeft(0)} className="btn-ghost px-2 py-1 text-xs">stop</button>}
          </div>
          <button onClick={persist} className="btn ml-auto" disabled={save === "saving"}>
            {save === "saving" ? "Saving…" : save === "saved" ? "Saved ✓" : save === "error" ? "Retry" : "Save"}
          </button>
        </div>
      </div>

      {/* Add exercise drawer */}
      {addExOpen && <AddExerciseDrawer catalog={catalog} onAdd={addExercise} onClose={() => setAddExOpen(false)} />}
    </div>
  );
}

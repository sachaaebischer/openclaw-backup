"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ConstrainedEvent {
  date: string;
  type: string;
  title: string;
  time: string;
  notes: string;
}

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const EVENT_PRESETS = [
  { type: "floorball_training", label: "🏑 Floorball training", defaultTitle: "Floorball training" },
  { type: "floorball_game",     label: "🏑 Floorball game",     defaultTitle: "Floorball game" },
  { type: "tennis",             label: "🎾 Tennis",             defaultTitle: "Tennis" },
  { type: "bike",               label: "🚴 Bike ride",          defaultTitle: "Bike ride" },
  { type: "run",                label: "🏃 Run",                defaultTitle: "Run" },
  { type: "rest",               label: "😴 Rest day",           defaultTitle: "Rest day" },
  { type: "other",              label: "📅 Other",              defaultTitle: "" },
];

function currentMondayStr(): string {
  const d = new Date();
  const day = d.getDay();
  const daysBack = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysBack);
  return d.toLocaleDateString("sv");
}

function addWeeks(weekStart: string, n: number): string {
  const d = new Date(weekStart + "T12:00:00");
  d.setDate(d.getDate() + n * 7);
  return d.toLocaleDateString("sv");
}

function weekDays(weekStart: string): { date: string; weekday: string }[] {
  const d = new Date(weekStart + "T12:00:00");
  return WEEKDAY_NAMES.map((weekday, i) => {
    const date = new Date(d);
    date.setDate(d.getDate() + i);
    return { date: date.toLocaleDateString("sv"), weekday };
  });
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function PlanPage() {
  const [weekStart, setWeekStart] = useState(currentMondayStr);
  const [events, setEvents] = useState<ConstrainedEvent[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newType, setNewType] = useState(EVENT_PRESETS[0].type);
  const [newTitle, setNewTitle] = useState(EVENT_PRESETS[0].defaultTitle);
  const [newTime, setNewTime] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setSaveState("idle");
    fetch(`/api/plan/constraints?week=${weekStart}`)
      .then((r) => r.json())
      .then((data) => { setEvents(data.fixed_events ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [weekStart]);

  const days = weekDays(weekStart);
  const today = new Date().toLocaleDateString("sv");

  function removeEvent(date: string, dateIdx: number) {
    setEvents((prev) => {
      let count = 0;
      return prev.filter((e) => {
        if (e.date !== date) return true;
        return count++ !== dateIdx;
      });
    });
    setSaveState("idle");
  }

  function startAdd(date: string) {
    setAddingFor(date);
    setNewType(EVENT_PRESETS[0].type);
    setNewTitle(EVENT_PRESETS[0].defaultTitle);
    setNewTime("");
  }

  function confirmAdd() {
    if (!addingFor) return;
    const title = newTitle.trim() || EVENT_PRESETS.find((p) => p.type === newType)?.defaultTitle || newType;
    setEvents((prev) => [...prev, { date: addingFor, type: newType, title, time: newTime, notes: "" }]);
    setAddingFor(null);
    setSaveState("idle");
  }

  async function save() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/plan/constraints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart, fixed_events: events }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  const typeIcon: Record<string, string> = {
    floorball_training: "🏑", floorball_game: "🏑", tennis: "🎾",
    bike: "🚴", run: "🏃", rest: "😴", other: "📅",
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Link href="/" className="btn-ghost">← Dashboard</Link>
        <div className="ml-1">
          <div className="font-semibold">Fixed sessions</div>
          <div className="text-xs text-muted">Week of {weekStart}</div>
        </div>
      </div>

      {/* Week selector */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setWeekStart((w) => addWeeks(w, -1))}
          disabled={weekStart <= currentMondayStr()}
          className="btn-ghost px-3 disabled:opacity-30"
        >←</button>
        <span className="text-sm font-medium">{weekStart}</span>
        <button onClick={() => setWeekStart((w) => addWeeks(w, 1))} className="btn-ghost px-3">→</button>
      </div>

      {loading ? (
        <div className="card text-sm text-muted">Loading…</div>
      ) : (
        days.map(({ date, weekday }) => {
          const dayEvents = events.filter((e) => e.date === date);
          const isPast = date < today;

          return (
            <div key={date} className={`card ${date === today ? "ring-1 ring-accent" : ""} ${isPast ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{weekday}</span>
                  <span className="text-xs text-muted">{date.slice(5)}</span>
                  {isPast && <span className="text-xs text-muted italic">past</span>}
                </div>
                {!isPast && addingFor !== date && (
                  <button onClick={() => startAdd(date)} className="btn-ghost px-2 py-1 text-xs">
                    + Add
                  </button>
                )}
              </div>

              {dayEvents.length === 0 && addingFor !== date && (
                <div className="text-xs text-muted">Free</div>
              )}

              {dayEvents.map((ev, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-cardborder/50 last:border-0 text-sm">
                  <span>{typeIcon[ev.type] ?? "📅"}</span>
                  <span>{ev.title}</span>
                  {ev.time && <span className="text-xs text-muted">{ev.time}</span>}
                  {!isPast && (
                    <button
                      onClick={() => removeEvent(date, i)}
                      className="ml-auto text-xs text-bad/70 hover:text-bad"
                    >✕</button>
                  )}
                </div>
              ))}

              {!isPast && addingFor === date && (
                <div className="mt-2 space-y-2 border-t border-cardborder pt-2">
                  <select
                    className="input w-full"
                    value={newType}
                    onChange={(e) => {
                      const t = e.target.value;
                      setNewType(t);
                      setNewTitle(EVENT_PRESETS.find((p) => p.type === t)?.defaultTitle ?? "");
                    }}
                  >
                    {EVENT_PRESETS.map((p) => (
                      <option key={p.type} value={p.type}>{p.label}</option>
                    ))}
                  </select>
                  <input
                    className="input w-full"
                    placeholder="Title (optional override)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <input
                    className="input w-full"
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button onClick={confirmAdd} className="btn flex-1">Add</button>
                    <button onClick={() => setAddingFor(null)} className="btn-ghost flex-1">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-cardborder bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <span className="text-xs text-muted">
            {events.length} fixed event{events.length !== 1 ? "s" : ""} this week
          </span>
          <button onClick={save} disabled={saveState === "saving"} className="btn ml-auto">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : saveState === "error" ? "Retry" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

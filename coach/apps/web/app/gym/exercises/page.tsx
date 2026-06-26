"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type CatalogItem = {
  name: string; notes: string; default_sets: number | null;
  default_reps: string; default_weight: number | null;
};

type CatalogResponse = { exercises: CatalogItem[]; historyNames: string[]; orphans: string[] };

const EMPTY: CatalogItem = { name: "", notes: "", default_sets: null, default_reps: "", default_weight: null };

function num(v: string): number | null {
  const n = parseFloat(v); return Number.isFinite(n) ? n : null;
}

function ItemForm({
  initial, onSave, onCancel,
}: { initial: CatalogItem; onSave: (item: CatalogItem) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof CatalogItem, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-accent/40 bg-card p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-4">
          <label className="label">Name</label>
          <input className="input mt-0.5 w-full" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Bench Press" required />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className="label">Notes / cues</label>
          <input className="input mt-0.5 w-full" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. seat position 4, grip shoulder-width" />
        </div>
        <div>
          <label className="label">Default sets</label>
          <input className="input mt-0.5 w-full" inputMode="numeric" value={form.default_sets ?? ""} onChange={(e) => set("default_sets", num(e.target.value))} placeholder="3" />
        </div>
        <div>
          <label className="label">Default reps</label>
          <input className="input mt-0.5 w-full" value={form.default_reps} onChange={(e) => set("default_reps", e.target.value)} placeholder="8–10" />
        </div>
        <div>
          <label className="label">Default kg</label>
          <input className="input mt-0.5 w-full" inputMode="decimal" value={form.default_weight ?? ""} onChange={(e) => set("default_weight", num(e.target.value))} placeholder="60" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

export default function ExercisesPage() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newFromHistory, setNewFromHistory] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const r = await fetch("/api/gym/catalog");
    setData(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function save(item: CatalogItem) {
    await fetch("/api/gym/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
    setAdding(false); setNewFromHistory(null); setEditingName(null);
    await load();
  }

  async function del(name: string) {
    if (!confirm(`Remove "${name}" from catalog? (Past sessions are not affected.)`)) return;
    await fetch(`/api/gym/catalog/${encodeURIComponent(name)}`, { method: "DELETE" });
    await load();
  }

  if (!data) return <div className="card text-sm text-muted">Loading…</div>;

  const allNames = [...new Set([...data.exercises.map((e) => e.name), ...data.historyNames])].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/gym" className="btn-ghost">← Gym</Link>
        <h1 className="ml-1 font-semibold">Exercises</h1>
        <button onClick={() => { setAdding(true); setNewFromHistory(null); }} className="btn ml-auto">+ New</button>
      </div>

      {error && <div className="card text-sm text-bad">{error}</div>}

      {adding && (
        <ItemForm initial={EMPTY} onSave={save} onCancel={() => setAdding(false)} />
      )}

      {newFromHistory && !adding && (
        <ItemForm
          initial={{ ...EMPTY, name: newFromHistory }}
          onSave={save}
          onCancel={() => setNewFromHistory(null)}
        />
      )}

      {/* Catalog exercises */}
      {data.exercises.length > 0 && (
        <section>
          <div className="label mb-2">Catalog</div>
          <div className="space-y-2">
            {data.exercises.map((ex) =>
              editingName === ex.name ? (
                <ItemForm key={ex.name} initial={ex} onSave={save} onCancel={() => setEditingName(null)} />
              ) : (
                <div key={ex.name} className="card flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{ex.name}</div>
                    {ex.notes && <div className="mt-0.5 text-xs italic text-muted">{ex.notes}</div>}
                    <div className="mt-0.5 text-xs text-muted">
                      {[ex.default_sets && `${ex.default_sets} sets`, ex.default_reps && ex.default_reps + " reps", ex.default_weight && ex.default_weight + " kg"].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <button onClick={() => setEditingName(ex.name)} className="btn-ghost shrink-0 text-xs">Edit</button>
                  <button onClick={() => del(ex.name)} className="btn-ghost shrink-0 text-xs text-bad">✕</button>
                </div>
              )
            )}
          </div>
        </section>
      )}

      {/* Exercises from history not yet in catalog */}
      {data.orphans.length > 0 && (
        <section>
          <div className="label mb-2">Used in sessions — not in catalog yet</div>
          <div className="space-y-1">
            {data.orphans.sort((a, b) => a.localeCompare(b)).map((name) => (
              <div key={name} className="card flex items-center gap-3 py-2">
                <span className="flex-1 text-sm">{name}</span>
                <button onClick={() => { setNewFromHistory(name); setAdding(false); }} className="btn-ghost text-xs">Add to catalog</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.exercises.length === 0 && data.orphans.length === 0 && (
        <div className="card text-sm text-muted">No exercises yet. Start logging or click "New" to add one.</div>
      )}
    </div>
  );
}

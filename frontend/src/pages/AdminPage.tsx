import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { DietType, Goal } from "../types/fittayi";

// Admin portal (PRD Section 6.7): Dashboard, Users, Dish database, Review
// queue. Real enforcement is RLS (dishes/unmatched_food_events/user_profiles
// admin policies, 20260915000002_photo_logging_admin_workout_rls.sql) — this
// page is only reachable via <RequireAdmin>, itself only a frontend
// convenience, never the actual security boundary.

interface DishRow {
  id: string;
  name: string;
  serving_size: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  diet_type: DietType;
}

interface ProfileRow {
  user_id: string;
  height_cm: number;
  weight_kg: number;
  body_fat_pct: number | null;
  goal: Goal;
  diet_type: DietType;
}

interface UnmatchedGroup {
  seenAs: string;
  timesFlagged: number;
  estimate: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number } | null;
}

const GOALS: Goal[] = ["cut", "cut_aggressive", "maintain", "build", "recomp"];
const DIET_TYPES: DietType[] = ["veg", "vegan", "egg", "non_veg"];

type Tab = "dashboard" | "users" | "dishes" | "queue";

export function AdminPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [queue, setQueue] = useState<UnmatchedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [{ data: profileRows }, { data: dishRows }, { data: unmatchedRows }] = await Promise.all([
      supabase.from("user_profiles").select("user_id, height_cm, weight_kg, body_fat_pct, goal, diet_type"),
      supabase
        .from("dishes")
        .select("id, name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, diet_type")
        .order("name"),
      supabase.from("unmatched_food_events").select("seen_as, estimate, created_at").eq("status", "open"),
    ]);

    setProfiles((profileRows ?? []) as ProfileRow[]);
    setDishes((dishRows ?? []) as DishRow[]);

    // Aggregate client-side: count occurrences per seen_as, keep the most
    // recent estimate as the representative one (see PRD 6.7 / handoff
    // README — a log table + GROUP BY, not a stored counter).
    const groups = new Map<string, { count: number; estimate: UnmatchedGroup["estimate"]; latest: string }>();
    for (const row of (unmatchedRows ?? []) as { seen_as: string; estimate: UnmatchedGroup["estimate"]; created_at: string }[]) {
      const existing = groups.get(row.seen_as);
      if (!existing || row.created_at > existing.latest) {
        groups.set(row.seen_as, {
          count: (existing?.count ?? 0) + 1,
          estimate: row.estimate,
          latest: row.created_at,
        });
      } else {
        existing.count += 1;
      }
    }
    const grouped = Array.from(groups.entries())
      .map(([seenAs, g]) => ({ seenAs, timesFlagged: g.count, estimate: g.estimate }))
      .sort((a, b) => b.timesFlagged - a.timesFlagged);
    setQueue(grouped);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function resolveQueueGroup(seenAs: string, status: "dismissed" | "resolved") {
    const { error } = await supabase
      .from("unmatched_food_events")
      .update({ status })
      .eq("seen_as", seenAs)
      .eq("status", "open");
    if (error) {
      setBanner(`Couldn't update "${seenAs}": ${error.message}`);
      return;
    }
    setBanner(status === "dismissed" ? `Dismissed "${seenAs}".` : `Resolved "${seenAs}".`);
    await loadAll();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold">Admin</h1>

      {banner && (
        <div className="mt-4 rounded-lg border border-cardamom bg-cardamom/10 px-4 py-3 text-sm text-ink">{banner}</div>
      )}

      <nav className="mt-6 flex gap-2 border-b border-line">
        {(["dashboard", "users", "dishes", "queue"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize ${
              tab === t ? "border-b-2 border-gold text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t === "queue" ? "Review queue" : t}
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="mt-8 text-center text-sm text-ink-muted">Loading…</p>
      ) : (
        <div className="mt-8">
          {tab === "dashboard" && <DashboardTab profiles={profiles} dishes={dishes} queue={queue} />}
          {tab === "users" && <UsersTab profiles={profiles} onChanged={loadAll} onBanner={setBanner} />}
          {tab === "dishes" && <DishesTab dishes={dishes} onChanged={loadAll} onBanner={setBanner} />}
          {tab === "queue" && (
            <QueueTab queue={queue} onDismiss={(s) => resolveQueueGroup(s, "dismissed")} onResolved={loadAll} onBanner={setBanner} />
          )}
        </div>
      )}
    </div>
  );
}

function DashboardTab({ profiles, dishes, queue }: { profiles: ProfileRow[]; dishes: DishRow[]; queue: UnmatchedGroup[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-line bg-surface p-4 text-center">
        <div className="font-mono text-3xl font-bold tabular-nums text-gold">{profiles.length}</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Users</div>
      </div>
      <div className="rounded-lg border border-line bg-surface p-4 text-center">
        <div className="font-mono text-3xl font-bold tabular-nums text-gold">{dishes.length}</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Dishes</div>
      </div>
      <div className="rounded-lg border border-line bg-surface p-4 text-center">
        <div className="font-mono text-3xl font-bold tabular-nums text-gold">{queue.length}</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Open review items</div>
      </div>
    </div>
  );
}

function UsersTab({
  profiles,
  onChanged,
  onBanner,
}: {
  profiles: ProfileRow[];
  onChanged: () => void;
  onBanner: (m: string) => void;
}) {
  const [editing, setEditing] = useState<ProfileRow | null>(null);

  async function save(patch: Partial<ProfileRow>) {
    if (!editing) return;
    const { error } = await supabase.from("user_profiles").update(patch).eq("user_id", editing.user_id);
    if (error) {
      onBanner(`Couldn't save: ${error.message}`);
    } else {
      onBanner("Saved profile.");
      setEditing(null);
      onChanged();
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      {/* No email column here — auth.users isn't exposed to the client;
          user_id is the only identifier available without a dedicated
          admin-only view joining auth.users (not built in this pass). */}
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-surface text-left">
            <th className="py-2 pr-4 pl-4">User ID</th>
            <th className="py-2 pr-4">Height</th>
            <th className="py-2 pr-4">Weight</th>
            <th className="py-2 pr-4">Body fat</th>
            <th className="py-2 pr-4">Goal</th>
            <th className="py-2 pr-4">Diet</th>
            <th className="py-2 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.user_id} className="border-b border-line last:border-b-0">
              <td className="py-2 pr-4 pl-4 font-mono text-xs text-ink-muted">{p.user_id.slice(0, 8)}…</td>
              <td className="py-2 pr-4">{p.height_cm} cm</td>
              <td className="py-2 pr-4">{p.weight_kg} kg</td>
              <td className="py-2 pr-4">{p.body_fat_pct ?? "–"}%</td>
              <td className="py-2 pr-4">{p.goal}</td>
              <td className="py-2 pr-4">{p.diet_type}</td>
              <td className="py-2 pr-4">
                <button onClick={() => setEditing(p)} className="text-xs text-gold hover:underline">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <Modal title="Edit profile" onClose={() => setEditing(null)}>
          <UserForm profile={editing} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

function UserForm({ profile, onSave }: { profile: ProfileRow; onSave: (patch: Partial<ProfileRow>) => void }) {
  const [heightCm, setHeightCm] = useState(profile.height_cm);
  const [weightKg, setWeightKg] = useState(profile.weight_kg);
  const [bodyFatPct, setBodyFatPct] = useState(profile.body_fat_pct ?? 0);
  const [goal, setGoal] = useState<Goal>(profile.goal);
  const [dietType, setDietType] = useState<DietType>(profile.diet_type);

  return (
    <div className="flex flex-col gap-3">
      <Field label="Height (cm)">
        <input type="number" value={heightCm} onChange={(e) => setHeightCm(parseFloat(e.target.value))} className="input" />
      </Field>
      <Field label="Weight (kg)">
        <input type="number" value={weightKg} onChange={(e) => setWeightKg(parseFloat(e.target.value))} className="input" />
      </Field>
      <Field label="Body fat (%)">
        <input type="number" value={bodyFatPct} onChange={(e) => setBodyFatPct(parseFloat(e.target.value))} className="input" />
      </Field>
      <Field label="Goal">
        <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)} className="input">
          {GOALS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Diet type">
        <select value={dietType} onChange={(e) => setDietType(e.target.value as DietType)} className="input">
          {DIET_TYPES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Field>
      <button
        onClick={() =>
          onSave({ height_cm: heightCm, weight_kg: weightKg, body_fat_pct: bodyFatPct, goal, diet_type: dietType })
        }
        className="mt-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-backwater hover:brightness-90"
      >
        Save
      </button>
    </div>
  );
}

function DishesTab({ dishes, onChanged, onBanner }: { dishes: DishRow[]; onChanged: () => void; onBanner: (m: string) => void }) {
  const [editing, setEditing] = useState<DishRow | "new" | null>(null);
  const [query, setQuery] = useState("");
  const filtered = dishes.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));

  async function save(values: Omit<DishRow, "id">, id?: string) {
    const { error } = id
      ? await supabase.from("dishes").update(values).eq("id", id)
      : await supabase.from("dishes").insert(values);
    if (error) {
      onBanner(`Couldn't save dish: ${error.message}`);
    } else {
      onBanner(id ? "Updated dish." : "Added dish.");
      setEditing(null);
      onChanged();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <input
          placeholder="Search dishes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input max-w-xs"
        />
        <button onClick={() => setEditing("new")} className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-backwater hover:brightness-90">
          Add dish
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left">
              <th className="py-2 pr-4 pl-4">Name</th>
              <th className="py-2 pr-4">Kcal</th>
              <th className="py-2 pr-4">Protein</th>
              <th className="py-2 pr-4">Diet</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-b-0">
                <td className="py-2 pr-4 pl-4">{d.name}</td>
                <td className="py-2 pr-4 font-mono tabular-nums">{d.calories}</td>
                <td className="py-2 pr-4 font-mono tabular-nums">{d.protein_g}g</td>
                <td className="py-2 pr-4">{d.diet_type}</td>
                <td className="py-2 pr-4">
                  <button onClick={() => setEditing(d)} className="text-xs text-gold hover:underline">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing === "new" ? "Add dish" : "Edit dish"} onClose={() => setEditing(null)}>
          <DishForm dish={editing === "new" ? null : editing} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

function DishForm({
  dish,
  prefillFromEstimate,
  onSave,
}: {
  dish: DishRow | null;
  prefillFromEstimate?: { seenAs: string; estimate: UnmatchedGroup["estimate"] };
  onSave: (values: Omit<DishRow, "id">, id?: string) => void;
}) {
  const [name, setName] = useState(dish?.name ?? prefillFromEstimate?.seenAs ?? "");
  const [servingSize, setServingSize] = useState(dish?.serving_size ?? "1 serving (estimate — confirm)");
  const [calories, setCalories] = useState(dish?.calories ?? prefillFromEstimate?.estimate?.calories ?? 0);
  const [proteinG, setProteinG] = useState(dish?.protein_g ?? prefillFromEstimate?.estimate?.protein_g ?? 0);
  const [carbsG, setCarbsG] = useState(dish?.carbs_g ?? prefillFromEstimate?.estimate?.carbs_g ?? 0);
  const [fatG, setFatG] = useState(dish?.fat_g ?? prefillFromEstimate?.estimate?.fat_g ?? 0);
  const [fiberG, setFiberG] = useState(dish?.fiber_g ?? prefillFromEstimate?.estimate?.fiber_g ?? 0);
  const [dietType, setDietType] = useState<DietType>(dish?.diet_type ?? "veg");

  return (
    <div className="flex flex-col gap-3">
      <Field label="Dish name">
        <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
      </Field>
      <Field label="Standard serving">
        <input value={servingSize} onChange={(e) => setServingSize(e.target.value)} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kcal">
          <input type="number" value={calories} onChange={(e) => setCalories(parseFloat(e.target.value))} className="input" />
        </Field>
        <Field label="Protein (g)">
          <input type="number" value={proteinG} onChange={(e) => setProteinG(parseFloat(e.target.value))} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Carbs (g)">
          <input type="number" value={carbsG} onChange={(e) => setCarbsG(parseFloat(e.target.value))} className="input" />
        </Field>
        <Field label="Fat (g)">
          <input type="number" value={fatG} onChange={(e) => setFatG(parseFloat(e.target.value))} className="input" />
        </Field>
      </div>
      <Field label="Fiber (g)">
        <input type="number" value={fiberG} onChange={(e) => setFiberG(parseFloat(e.target.value))} className="input" />
      </Field>
      <Field label="Diet type">
        <select value={dietType} onChange={(e) => setDietType(e.target.value as DietType)} className="input">
          {DIET_TYPES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Field>
      <button
        onClick={() =>
          onSave(
            {
              name,
              serving_size: servingSize,
              calories,
              protein_g: proteinG,
              carbs_g: carbsG,
              fat_g: fatG,
              fiber_g: fiberG,
              diet_type: dietType,
            },
            dish?.id
          )
        }
        disabled={!name}
        className="mt-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-backwater hover:brightness-90 disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}

function QueueTab({
  queue,
  onDismiss,
  onResolved,
  onBanner,
}: {
  queue: UnmatchedGroup[];
  onDismiss: (seenAs: string) => void;
  onResolved: () => void;
  onBanner: (m: string) => void;
}) {
  const [promoting, setPromoting] = useState<UnmatchedGroup | null>(null);

  async function savePromoted(values: Omit<DishRow, "id">) {
    if (!promoting) return;
    const { error: insertError } = await supabase.from("dishes").insert(values);
    if (insertError) {
      onBanner(`Couldn't add dish: ${insertError.message}`);
      return;
    }
    const { error: updateError } = await supabase
      .from("unmatched_food_events")
      .update({ status: "resolved" })
      .eq("seen_as", promoting.seenAs)
      .eq("status", "open");
    if (updateError) {
      onBanner(`Dish added, but couldn't clear the queue: ${updateError.message}`);
    } else {
      onBanner(`Added "${values.name}" and cleared it from the queue.`);
    }
    setPromoting(null);
    onResolved();
  }

  if (queue.length === 0) {
    return <p className="text-sm text-ink-muted">Nothing waiting on review right now.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {queue.map((item) => (
        <div key={item.seenAs} className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">"{item.seenAs}"</p>
              <p className="text-xs text-ink-muted">Flagged {item.timesFlagged}×</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setPromoting(item)}
                className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-backwater hover:brightness-90"
              >
                Add to database
              </button>
              <button
                onClick={() => onDismiss(item.seenAs)}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink hover:border-gold"
              >
                Dismiss
              </button>
            </div>
          </div>
          {item.estimate && (
            <p className="mt-2 font-mono text-xs tabular-nums text-ink-muted">
              ~{Math.round(item.estimate.calories)} kcal (est.) &middot; {Math.round(item.estimate.protein_g)}g protein
              &middot; {Math.round(item.estimate.carbs_g)}g carbs &middot; {Math.round(item.estimate.fat_g)}g fat
            </p>
          )}
        </div>
      ))}

      {promoting && (
        <Modal title="Add to dish database" onClose={() => setPromoting(null)}>
          <DishForm dish={null} prefillFromEstimate={promoting} onSave={savePromoted} />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink">
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

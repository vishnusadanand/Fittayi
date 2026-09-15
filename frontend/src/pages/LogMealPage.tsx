import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { analyzeMealPhoto, uploadMealPhoto } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import type { MealPhotoItem, ComputedMacros } from "../types/fittayi";

interface DishOption {
  id: string;
  name: string;
  serving_size: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
}

// Working confirmation-state shape for one item on screen — mirrors
// plate-check.html's `items` working state.
interface WorkingItem {
  matchedDishId: string | null;
  seenAs: string;
  multiplier: number | null;
  referenceUsed: string;
  confidence: "high" | "medium" | "low";
  unmatchedEstimate: ComputedMacros | null;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n)) : "–";
}

export function LogMealPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dishes, setDishes] = useState<DishOption[]>([]);
  const [dishById, setDishById] = useState<Map<string, DishOption>>(new Map());

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WorkingItem[] | null>(null);
  const [notes, setNotes] = useState("");
  const [overallConfidence, setOverallConfidence] = useState<"high" | "medium" | "low">("medium");
  const [savedPhotoPath, setSavedPhotoPath] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [loggedMessage, setLoggedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    supabase
      .from("dishes")
      .select("id, name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g")
      .eq("is_active", true)
      .then(({ data }) => {
        const rows = (data ?? []) as DishOption[];
        setDishes(rows);
        setDishById(new Map(rows.map((d) => [d.id, d])));
      });
  }, [user, navigate]);

  function handleFile(f: File) {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setItems(null);
    setError(null);
    setLoggedMessage(null);
  }

  async function handleAnalyze() {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      const storagePath = await uploadMealPhoto(file);
      setSavedPhotoPath(storagePath);
      const result = await analyzeMealPhoto(storagePath);
      setItems(
        result.items.map((item: MealPhotoItem) => ({
          matchedDishId: item.matched_dish_id,
          seenAs: item.seen_as,
          multiplier: item.portion_multiplier,
          referenceUsed: item.reference_used,
          confidence: item.confidence,
          unmatchedEstimate: item.unmatched_estimate,
        }))
      );
      setNotes(result.notes);
      setOverallConfidence(result.overall_confidence);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong analyzing this photo.");
    } finally {
      setAnalyzing(false);
    }
  }

  function computeMacros(item: WorkingItem): ComputedMacros {
    if (item.matchedDishId) {
      const dish = dishById.get(item.matchedDishId);
      if (dish) {
        const m = item.multiplier ?? 1;
        return {
          calories: dish.calories * m,
          protein_g: dish.protein_g * m,
          carbs_g: dish.carbs_g * m,
          fat_g: dish.fat_g * m,
          fiber_g: (dish.fiber_g ?? 0) * m,
        };
      }
    }
    return item.unmatchedEstimate ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  }

  function updateItem(idx: number, patch: Partial<WorkingItem>) {
    setItems((prev) => prev?.map((it, i) => (i === idx ? { ...it, ...patch } : it)) ?? null);
  }

  const totals = (items ?? []).reduce(
    (t, item) => {
      const m = computeMacros(item);
      return {
        calories: t.calories + m.calories,
        protein_g: t.protein_g + m.protein_g,
        carbs_g: t.carbs_g + m.carbs_g,
        fat_g: t.fat_g + m.fat_g,
        fiber_g: t.fiber_g + m.fiber_g,
      };
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  );

  async function handleLog() {
    if (!user || !items) return;
    setLogging(true);
    try {
      const rows = items.map((item) => {
        const m = computeMacros(item);
        return {
          user_id: user.id,
          dish_id: item.matchedDishId,
          seen_as: item.seenAs,
          portion_multiplier: item.multiplier,
          calories: m.calories,
          protein_g: m.protein_g,
          carbs_g: m.carbs_g,
          fat_g: m.fat_g,
          fiber_g: m.fiber_g,
          confidence: item.confidence,
          photo_storage_path: savedPhotoPath,
        };
      });
      const { error: insertError } = await supabase.from("meal_logs").insert(rows);
      if (insertError) throw new Error(insertError.message);
      setLoggedMessage(`Logged ${fmt(totals.calories)} kcal for this meal.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this log — try again.");
    } finally {
      setLogging(false);
    }
  }

  function reset() {
    setFile(null);
    setPreviewUrl(null);
    setItems(null);
    setError(null);
    setLoggedMessage(null);
    setSavedPhotoPath(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold">Log a Meal</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Photo estimates are informed guesses, not lab measurements — matched items pull real numbers from our dish
        database; unmatched items get a rough one-off estimate and are flagged for review.
      </p>

      {!items && (
        <div className="mt-6">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line bg-surface p-8 text-center hover:border-gold">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {previewUrl ? (
              <img src={previewUrl} alt="Selected meal" className="max-h-64 rounded-lg" />
            ) : (
              <span className="text-sm text-ink-muted">Click to choose a photo of your plate</span>
            )}
          </label>

          {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}

          {file && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="mt-4 w-full rounded-full bg-gold px-6 py-3 font-semibold text-backwater hover:brightness-90 disabled:opacity-50"
            >
              {analyzing ? "Reading the plate…" : "Analyze plate"}
            </button>
          )}
        </div>
      )}

      {items && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-muted">Matched items pull real numbers; drag to correct the portion.</p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                overallConfidence === "low" ? "bg-terracotta/20 text-terracotta" : "bg-surface-raised text-ink-muted"
              }`}
            >
              {overallConfidence[0].toUpperCase() + overallConfidence.slice(1)} confidence
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Calories" value={fmt(totals.calories)} />
            <Stat label="Protein" value={`${fmt(totals.protein_g)}g`} />
            <Stat label="Carbs" value={`${fmt(totals.carbs_g)}g`} />
            <Stat label="Fat" value={`${fmt(totals.fat_g)}g`} />
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {items.map((item, idx) => {
              const macros = computeMacros(item);
              return (
                <div key={idx} className="rounded-lg border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-ink-muted">"{item.seenAs}"</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        item.confidence === "low" ? "bg-terracotta/20 text-terracotta" : "bg-surface-raised text-ink-muted"
                      }`}
                    >
                      {item.confidence}
                    </span>
                  </div>

                  <select
                    value={item.matchedDishId ?? "__unmatched__"}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateItem(idx, {
                        matchedDishId: val === "__unmatched__" ? null : val,
                        multiplier: val === "__unmatched__" ? null : (item.multiplier ?? 1),
                      });
                    }}
                    className="mt-2 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink"
                  >
                    <option value="__unmatched__">Not in database — "{item.seenAs}"</option>
                    {dishes.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.serving_size ?? "1 serving"})
                      </option>
                    ))}
                  </select>

                  {item.matchedDishId && (
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        type="range"
                        min={0.25}
                        max={3}
                        step={0.05}
                        value={item.multiplier ?? 1}
                        onChange={(e) => updateItem(idx, { multiplier: parseFloat(e.target.value) })}
                        className="flex-1 accent-gold"
                      />
                      <span className="font-mono text-sm tabular-nums text-ink-muted">
                        {(item.multiplier ?? 1).toFixed(2)}×
                      </span>
                    </div>
                  )}

                  <p className="mt-3 font-mono text-sm tabular-nums text-gold">
                    {fmt(macros.calories)} kcal{" "}
                    <span className="font-body text-ink-muted">
                      &middot; {fmt(macros.protein_g)}g protein &middot; {fmt(macros.carbs_g)}g carbs &middot;{" "}
                      {fmt(macros.fat_g)}g fat
                    </span>
                  </p>
                  {item.referenceUsed && <p className="mt-1 text-xs text-ink-muted">Reference: {item.referenceUsed}</p>}
                </div>
              );
            })}
          </div>

          {notes && <p className="mt-4 text-xs text-ink-muted">{notes}</p>}

          {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}

          {loggedMessage ? (
            <div className="mt-6 rounded-lg border border-cardamom bg-cardamom/10 px-4 py-3 text-sm text-ink">
              {loggedMessage}
            </div>
          ) : (
            <button
              onClick={handleLog}
              disabled={logging}
              className="mt-6 w-full rounded-full bg-gold px-6 py-3 font-semibold text-backwater hover:brightness-90 disabled:opacity-50"
            >
              {logging ? "Saving…" : "Log this meal"}
            </button>
          )}

          <button onClick={reset} className="mt-3 w-full rounded-full border border-line bg-surface px-6 py-2 text-sm text-ink hover:border-gold">
            Start over
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3 text-center">
      <div className="font-mono text-2xl font-bold tabular-nums text-ink">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
    </div>
  );
}

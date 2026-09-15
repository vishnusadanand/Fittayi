// Bodyweight workout circuit — exercise library, substitution logic, and
// routines. Ported from fittayi-handoff-2026-09-15/daily-circuit.html
// (EX, ALT, ROUTINES, buildRoutine) — see FITTAYI_PRD.md Section 6.6.
import type { Condition, Exercise, RoutineExercise, WorkoutGoal } from "../types/fittayi";

export const EXERCISES: Record<string, Exercise> = {
  jacks: { name: "Jumping jacks", anim: "jack", mode: "time", target: 45, tags: ["knee"] },
  squat: { name: "Bodyweight squats", anim: "squat", mode: "reps", target: 15, tags: ["knee"] },
  climbers: { name: "Mountain climbers", anim: "kneedrive", mode: "time", target: 30, tags: ["wrist", "knee"] },
  pushup: { name: "Push-ups", anim: "pushup", mode: "reps", target: 10, tags: ["wrist"] },
  highknees: { name: "High knees", anim: "kneedrive", mode: "time", target: 30, tags: ["knee"] },
  plank: { name: "Plank", anim: "static", mode: "time", target: 30, tags: ["wrist"] },
  lunge: { name: "Alternating lunges", anim: "lunge", mode: "reps", target: 12, tags: ["knee"] },
  burpee: { name: "Burpees", anim: "burpee", mode: "reps", target: 8, tags: ["knee", "wrist", "back"] },
  pikepush: { name: "Pike push-ups", anim: "pushup", mode: "reps", target: 8, tags: ["wrist"] },
  bridge: { name: "Glute bridges", anim: "hiplift", mode: "reps", target: 15, tags: ["back"] },
  plank45: { name: "Plank", anim: "static", mode: "time", target: 45, tags: ["wrist"] },
  superman: { name: "Superman", anim: "hiplift", mode: "reps", target: 12, tags: ["back"] },
  dips: { name: "Chair tricep dips", anim: "pushup", mode: "reps", target: 10, tags: ["wrist"] },
  wallsit: { name: "Wall sit", anim: "static", mode: "time", target: 40, tags: ["knee"] },
  bridge12: { name: "Glute bridges", anim: "hiplift", mode: "reps", target: 12, tags: ["back"] },
  sidecrunch: { name: "Side crunches", anim: "twist", mode: "reps", target: 12, tags: ["back"] },
  march: { name: "Standing march", anim: "kneedrive", mode: "time", target: 30, tags: [] },
};

// Safer swap-ins when a routine exercise's tags match a stated condition.
export const ALTERNATES: Record<string, Exercise> = {
  squat: { name: "Standing march (knee-friendly)", anim: "kneedrive", mode: "time", target: 30, tags: [] },
  lunge: { name: "Standing march (knee-friendly)", anim: "kneedrive", mode: "time", target: 30, tags: [] },
  wallsit: { name: "Standing march (knee-friendly)", anim: "kneedrive", mode: "time", target: 30, tags: [] },
  jacks: { name: "Standing arm raises", anim: "jack", mode: "time", target: 30, tags: [] },
  highknees: { name: "Standing march", anim: "kneedrive", mode: "time", target: 30, tags: [] },
  climbers: { name: "Slow plank shoulder taps", anim: "static", mode: "time", target: 30, tags: [] },
  burpee: { name: "Step-back burpee (no jump)", anim: "squat", mode: "reps", target: 8, tags: [] },
  pushup: { name: "Wall push-ups", anim: "pushup", mode: "reps", target: 10, tags: [] },
  pikepush: { name: "Wall push-ups", anim: "pushup", mode: "reps", target: 10, tags: [] },
  dips: { name: "Seated arm presses", anim: "pushup", mode: "reps", target: 10, tags: [] },
  plank: { name: "Wall push-ups (light hold)", anim: "pushup", mode: "time", target: 20, tags: [] },
  plank45: { name: "Wall push-ups (light hold)", anim: "pushup", mode: "time", target: 20, tags: [] },
  superman: { name: "Gentle cat-cow stretch", anim: "hiplift", mode: "time", target: 30, tags: [] },
  sidecrunch: { name: "Standing side reach", anim: "twist", mode: "time", target: 20, tags: [] },
  bridge: { name: "Gentle cat-cow stretch", anim: "hiplift", mode: "time", target: 30, tags: [] },
  bridge12: { name: "Gentle cat-cow stretch", anim: "hiplift", mode: "time", target: 30, tags: [] },
};

export const ROUTINES: Record<WorkoutGoal, { label: string; ids: string[] }> = {
  fatloss: { label: "Fat loss", ids: ["jacks", "squat", "climbers", "pushup", "highknees", "plank", "lunge", "burpee"] },
  muscle: { label: "Muscle gain", ids: ["pushup", "squat", "pikepush", "bridge", "plank45", "superman", "dips", "wallsit"] },
  maintain: { label: "Maintain weight", ids: ["squat", "pushup", "plank", "lunge", "bridge12", "jacks", "sidecrunch"] },
};

export const CONDITION_OPTIONS: { value: Condition; label: string }[] = [
  { value: "knee", label: "Knee" },
  { value: "back", label: "Back" },
  { value: "wrist", label: "Wrist / shoulder" },
  { value: "none", label: "None" },
];

// Matches a user's stated conditions against each exercise's tags and swaps
// in the safer alternative, with the swap shown transparently to the caller.
export function buildRoutine(goal: WorkoutGoal, conditions: Condition[]): RoutineExercise[] {
  const conds = conditions.filter((c) => c !== "none");
  return ROUTINES[goal].ids.map((id) => {
    const base = EXERCISES[id];
    const flagged = base.tags.some((t) => conds.includes(t));
    if (flagged && ALTERNATES[id]) {
      return { id, swapped: true, originalName: base.name, ...ALTERNATES[id] };
    }
    return { id, swapped: false, ...base };
  });
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";
import { StickFigure } from "../components/StickFigure";
import { ROUTINES, CONDITION_OPTIONS, buildRoutine } from "../lib/workout";
import type { Condition, RoutineExercise, WorkoutGoal } from "../types/fittayi";

// Session/timer state machine ported from daily-circuit.html's beginSession/
// tick/advance/finishSession. v1 has no in-app streak UI (PRD Section 6.6) —
// workout_completions is written purely so the daily reminder cron job has
// something to query; nothing here reads a streak back.
const REST_SECONDS = 15;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Screen = "setup" | "session" | "complete";
type Phase = "exercise" | "rest";

export function WorkoutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<Screen>("setup");
  const [goal, setGoal] = useState<WorkoutGoal>("fatloss");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [alreadyDoneToday, setAlreadyDoneToday] = useState(false);

  const [routine, setRoutine] = useState<RoutineExercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("exercise");
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const sessionStart = useRef(0);
  const [elapsedOnFinish, setElapsedOnFinish] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    (async () => {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("conditions")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.conditions) setConditions(profile.conditions as Condition[]);

      const { data: completion } = await supabase
        .from("workout_completions")
        .select("completed_date")
        .eq("user_id", user.id)
        .eq("completed_date", todayStr())
        .maybeSingle();
      setAlreadyDoneToday(!!completion);
    })();
  }, [user, navigate]);

  function toggleCondition(id: Condition) {
    setConditions((prev) => {
      if (id === "none") return prev.includes("none") ? [] : ["none"];
      const withoutNone = prev.filter((c) => c !== "none");
      return withoutNone.includes(id) ? withoutNone.filter((c) => c !== id) : [...withoutNone, id];
    });
  }

  const preview = buildRoutine(goal, conditions);

  function beginSession() {
    const built = buildRoutine(goal, conditions);
    setRoutine(built);
    setIdx(0);
    setPhase("exercise");
    setPaused(false);
    sessionStart.current = Date.now();
    setScreen("session");
    setRemaining(built[0].mode === "time" ? built[0].target : 0);
  }

  async function markCompleted() {
    if (!user) return;
    await supabase
      .from("workout_completions")
      .upsert({ user_id: user.id, completed_date: todayStr() }, { onConflict: "user_id,completed_date" });
  }

  function advance() {
    if (phase === "exercise") {
      if (idx < routine.length - 1) {
        setPhase("rest");
        setRemaining(REST_SECONDS);
      } else {
        finishSession();
      }
    } else {
      const nextIdx = idx + 1;
      setIdx(nextIdx);
      setPhase("exercise");
      setRemaining(routine[nextIdx].mode === "time" ? routine[nextIdx].target : 0);
    }
  }

  function finishSession() {
    setElapsedOnFinish(Math.round((Date.now() - sessionStart.current) / 1000));
    setScreen("complete");
    markCompleted();
  }

  // Countdown timer — only runs during a timed exercise or rest phase.
  useEffect(() => {
    if (screen !== "session" || paused) return;
    const isTimed = phase === "rest" || routine[idx]?.mode === "time";
    if (!isTimed) return;

    const handle = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(handle);
          advance();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, phase, idx, paused]);

  if (screen === "complete") {
    return <CompleteScreen elapsed={elapsedOnFinish} onRestart={beginSession} onHome={() => setScreen("setup")} />;
  }

  if (screen === "session") {
    const ex = routine[idx];
    return (
      <SessionScreen
        ex={ex}
        phase={phase}
        idx={idx}
        total={routine.length}
        remaining={remaining}
        paused={paused}
        goalLabel={ROUTINES[goal].label}
        nextName={routine[idx + 1]?.name}
        onAdvance={advance}
        onTogglePause={() => setPaused((p) => !p)}
      />
    );
  }

  return (
    <SetupScreen
      goal={goal}
      onGoal={setGoal}
      conditions={conditions}
      onToggleCondition={toggleCondition}
      preview={preview}
      alreadyDoneToday={alreadyDoneToday}
      onStart={beginSession}
    />
  );
}

function SetupScreen({
  goal,
  onGoal,
  conditions,
  onToggleCondition,
  preview,
  alreadyDoneToday,
  onStart,
}: {
  goal: WorkoutGoal;
  onGoal: (g: WorkoutGoal) => void;
  conditions: Condition[];
  onToggleCondition: (c: Condition) => void;
  preview: RoutineExercise[];
  alreadyDoneToday: boolean;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold">Today's Circuit</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Bodyweight only. Substitutions are shown transparently if you flag an injury below.
      </p>

      {alreadyDoneToday && (
        <div className="mt-4 rounded-lg border border-cardamom bg-cardamom/10 px-4 py-3 text-sm text-ink">
          You've already completed today's circuit — nice work. Redoing it won't send you a reminder email later.
        </div>
      )}

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Goal</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(ROUTINES) as WorkoutGoal[]).map((key) => (
            <button
              key={key}
              onClick={() => onGoal(key)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                goal === key ? "border-gold bg-gold text-backwater" : "border-line bg-surface hover:border-gold"
              }`}
            >
              {ROUTINES[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Any injuries or conditions we should know about?
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CONDITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onToggleCondition(opt.value)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                conditions.includes(opt.value)
                  ? "border-gold bg-gold text-backwater"
                  : "border-line bg-surface hover:border-gold"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {preview.map((ex) => (
          <div key={ex.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-2 text-sm">
            <span>
              {ex.name}
              {ex.swapped && <span className="ml-2 text-xs text-terracotta">(swapped for {ex.originalName})</span>}
            </span>
            <span className="font-mono tabular-nums text-ink-muted">
              {ex.mode === "time" ? `${ex.target}s` : `${ex.target} reps`}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="mt-8 w-full rounded-full bg-gold px-6 py-3 font-semibold text-backwater hover:brightness-90"
      >
        Start circuit
      </button>
    </div>
  );
}

function SessionScreen({
  ex,
  phase,
  idx,
  total,
  remaining,
  paused,
  goalLabel,
  nextName,
  onAdvance,
  onTogglePause,
}: {
  ex: RoutineExercise;
  phase: Phase;
  idx: number;
  total: number;
  remaining: number;
  paused: boolean;
  goalLabel: string;
  nextName?: string;
  onAdvance: () => void;
  onTogglePause: () => void;
}) {
  const progressPct = Math.round(((idx + (phase === "rest" ? 1 : 0)) / total) * 100);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeLabel = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center">
      <p className="text-sm text-ink-muted">{goalLabel} circuit</p>
      <p className="font-mono text-xs tabular-nums text-ink-muted">
        {idx + 1} / {total}
      </p>
      <div className="mt-2 h-1 w-full rounded-full bg-line">
        <div className="h-1 rounded-full bg-gold transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="mt-8">
        <StickFigure anim={phase === "rest" ? "static" : ex.anim} />
      </div>

      {phase === "rest" ? (
        <>
          <p className="mt-4 font-display text-lg font-semibold text-terracotta">Rest</p>
          <p className="font-mono text-4xl font-bold tabular-nums">{timeLabel}</p>
          <p className="mt-2 text-sm text-ink-muted">Next: {nextName}</p>
        </>
      ) : (
        <>
          <h2 className="mt-4 font-display text-xl font-semibold">{ex.name}</h2>
          {ex.mode === "time" ? (
            <>
              <p className="font-mono text-4xl font-bold tabular-nums">{timeLabel}</p>
              <p className="mt-1 text-sm text-ink-muted">target: {ex.target}s</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">Target: {ex.target} reps &middot; take your time</p>
          )}
          {ex.swapped && (
            <p className="mt-2 text-sm text-terracotta">Swapped from {ex.originalName} based on what you flagged.</p>
          )}
        </>
      )}

      <div className="mt-8 flex justify-center gap-3">
        {(phase === "rest" || ex.mode === "time") && (
          <button
            onClick={onTogglePause}
            className="rounded-full border border-line bg-surface px-6 py-2 text-sm text-ink hover:border-gold"
          >
            {paused ? "Resume" : "Pause"}
          </button>
        )}
        <button
          onClick={onAdvance}
          className="rounded-full bg-gold px-6 py-2 font-semibold text-backwater hover:brightness-90"
        >
          {phase === "rest" ? "Skip rest" : ex.mode === "time" ? "Skip to next" : "Done — next"}
        </button>
      </div>
    </div>
  );
}

function CompleteScreen({ elapsed, onRestart, onHome }: { elapsed: number; onRestart: () => void; onHome: () => void }) {
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center">
      <h1 className="font-display text-2xl font-bold">Circuit complete</h1>
      <div className="mt-4 rounded-lg border border-cardamom bg-cardamom/10 px-4 py-3 text-sm text-ink">
        Nice work — circuit done in about {mins}:{String(secs).padStart(2, "0")}. Today is marked complete, so the
        reminder email would skip you tonight.
      </div>
      <div className="mt-8 flex justify-center gap-3">
        <button onClick={onHome} className="rounded-full border border-line bg-surface px-6 py-2 text-sm text-ink hover:border-gold">
          Back to setup
        </button>
        <button onClick={onRestart} className="rounded-full bg-gold px-6 py-2 font-semibold text-backwater hover:brightness-90">
          Do it again
        </button>
      </div>
    </div>
  );
}

// FITTAYI daily workout reminder — Edge Function (PRD 6.6), triggered by
// pg_cron (see 20260915000004_workout_reminder_cron.sql), not called by the
// frontend at all. Finds every user who hasn't completed today's circuit
// (no workout_completions row for today, IST) and emails them a reminder.
//
// Protected by a shared secret (CRON_SECRET), not user auth — pg_cron has
// no user session to present. Uses the service_role key (auto-provided in
// the Edge Function runtime) since this legitimately needs to read across
// all users, unlike every other function in this project.
//
// Email provider is an open product decision (FITTAYI_PRD.md Section 12,
// not decided as of this build) — sendReminderEmail() below is the one
// function to replace once that's picked. Everything else (who to remind,
// when, how "today" is defined) is real and complete.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// "Today" for this job is IST (Asia/Kolkata, UTC+5:30) — working assumption
// per PRD Section 12, given the Kerala-first launch; not yet explicitly
// confirmed. Computed by offset rather than relying on the Edge Function
// runtime's local timezone (Deno's is UTC).
function todayIST(): string {
  const IST_OFFSET_MINUTES = 5 * 60 + 30;
  const now = new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

// STUB: swap this for a real call once an email provider is chosen (PRD
// Section 12 open question). Kept as its own function so that's a one-place
// change — everything else in this file is provider-agnostic.
async function sendReminderEmail(email: string): Promise<boolean> {
  console.log(`[workout-reminder] would email ${email}: haven't completed today's circuit yet`);
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!cronSecret || provided !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const today = todayIST();

  const { data: completedRows, error: completedError } = await supabase
    .from("workout_completions")
    .select("user_id")
    .eq("completed_date", today);
  if (completedError) {
    return jsonResponse({ error: "Failed to read workout_completions" }, 500);
  }
  const completedUserIds = new Set((completedRows ?? []).map((r: { user_id: string }) => r.user_id));

  // user_profiles is a reasonable proxy for "has an active FITTAYI account
  // with onboarding complete" — there's no separate "opted into reminders"
  // flag yet (not in PRD scope), so every onboarded user is a candidate.
  const { data: profileRows, error: profileError } = await supabase.from("user_profiles").select("user_id");
  if (profileError) {
    return jsonResponse({ error: "Failed to read user_profiles" }, 500);
  }

  const pendingUserIds = (profileRows ?? [])
    .map((r: { user_id: string }) => r.user_id)
    .filter((id: string) => !completedUserIds.has(id));

  let sent = 0;
  let failed = 0;
  for (const userId of pendingUserIds) {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (userError || !email) {
      failed += 1;
      continue;
    }
    const ok = await sendReminderEmail(email);
    if (ok) sent += 1;
    else failed += 1;
  }

  return jsonResponse({ date: today, candidates: pendingUserIds.length, sent, failed }, 200);
});

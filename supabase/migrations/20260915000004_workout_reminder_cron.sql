-- Daily workout reminder cron (PRD Section 6.6). Schedules a call to the
-- workout-reminder Edge Function once a day; the function itself decides
-- who actually gets emailed (everyone without a workout_completions row for
-- today, IST).
--
-- The shared secret used to authenticate this call is stored in Supabase
-- Vault, NOT in this file -- migrations are committed to git, and a secret
-- value has no business there. This migration only references it by name
-- (workout_reminder_cron_secret). The actual secret value must be created
-- once, out of band, e.g.:
--   select vault.create_secret('<random value>', 'workout_reminder_cron_secret');
-- with the SAME value set as the Edge Function's CRON_SECRET env var
-- (`supabase secrets set CRON_SECRET=<same random value>`).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select
  cron.schedule(
    'workout-reminder-daily',
    '30 12 * * *', -- 12:30 UTC = 18:00 IST (working assumption, see PRD Section 12)
    $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'workout_reminder_function_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'workout_reminder_cron_secret')
      ),
      body := '{}'::jsonb
    );
    $$
  );

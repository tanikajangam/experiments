-- Step 5: call the `remind` Edge Function every 15 minutes, on the quarter hour.
-- Run once in the Supabase SQL Editor, after turning on the pg_cron and pg_net extensions.
-- Replace YOUR-CRON-SECRET with the CRON_SECRET Edge Function secret (never commit the real one).
select cron.schedule('remind-every-15-min', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://xdjifryphyslmuifvbrz.supabase.co/functions/v1/remind',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR-CRON-SECRET')
  );
$$);

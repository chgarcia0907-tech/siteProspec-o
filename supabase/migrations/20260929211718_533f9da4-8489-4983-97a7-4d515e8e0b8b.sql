-- lovable-cron-fallback-reviewed: user explicitly requires a 15-minute push to an external Google Sheet; no event source on the sheet side
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL,
  rows_count integer NOT NULL DEFAULT 0,
  message text NOT NULL DEFAULT '',
  trigger text NOT NULL DEFAULT 'cron'
);
GRANT SELECT ON public.sync_log TO authenticated;
GRANT ALL ON public.sync_log TO service_role;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logged users can read sync log" ON public.sync_log FOR SELECT TO authenticated USING (true);

SELECT cron.schedule(
  'sync-sheets-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--3ec806f2-c57e-4831-9eb1-5e4e10dcd7a8.lovable.app/api/public/sync-sheets',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT token FROM public.sync_settings ORDER BY created_at LIMIT 1)),
    body := '{}'::jsonb
  );
  $$
);
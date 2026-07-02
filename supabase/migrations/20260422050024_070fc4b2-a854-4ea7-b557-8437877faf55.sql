-- Settings table for webhook URL (singleton-ish; one row per admin)
CREATE TABLE IF NOT EXISTS public.content_lab_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_url text,
  last_test_at timestamptz,
  last_test_outcome text,
  last_test_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_lab_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content lab admin full access settings"
ON public.content_lab_settings
FOR ALL
TO authenticated
USING (public.is_email('daniel@phaosai.com'))
WITH CHECK (public.is_email('daniel@phaosai.com'));

CREATE TRIGGER content_lab_settings_updated_at
BEFORE UPDATE ON public.content_lab_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Delivery tracking columns on content_queue
ALTER TABLE public.content_queue
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE INDEX IF NOT EXISTS content_queue_status_scheduled_idx
  ON public.content_queue (status, scheduled_at);

-- pg_cron + pg_net for scheduled dispatch
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule, then create a fresh per-minute schedule
DO $$
BEGIN
  PERFORM cron.unschedule('content-lab-dispatch-every-minute');
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;

SELECT cron.schedule(
  'content-lab-dispatch-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rgiesetdwhbwayjjgvnb.supabase.co/functions/v1/content-lab-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object('source', 'cron')
  );
  $cron$
);
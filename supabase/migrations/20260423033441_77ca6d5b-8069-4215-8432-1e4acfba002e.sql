
-- 1) Table
CREATE TABLE IF NOT EXISTS public.strategy_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','in_progress','completed','failed')),
  total_steps integer NOT NULL DEFAULT 4 CHECK (total_steps > 0),
  completed_steps integer NOT NULL DEFAULT 0 CHECK (completed_steps >= 0),
  current_step text,
  start_date date NOT NULL,
  result_post_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategy_jobs_user_created
  ON public.strategy_jobs (user_id, created_at DESC);

-- 2) updated_at trigger (reuse existing set_updated_at function)
DROP TRIGGER IF EXISTS strategy_jobs_set_updated_at ON public.strategy_jobs;
CREATE TRIGGER strategy_jobs_set_updated_at
BEFORE UPDATE ON public.strategy_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) RLS
ALTER TABLE public.strategy_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users select own strategy jobs" ON public.strategy_jobs;
CREATE POLICY "users select own strategy jobs"
  ON public.strategy_jobs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

DROP POLICY IF EXISTS "users insert own strategy jobs" ON public.strategy_jobs;
CREATE POLICY "users insert own strategy jobs"
  ON public.strategy_jobs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users update own strategy jobs" ON public.strategy_jobs;
CREATE POLICY "users update own strategy jobs"
  ON public.strategy_jobs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

DROP POLICY IF EXISTS "users delete own strategy jobs" ON public.strategy_jobs;
CREATE POLICY "users delete own strategy jobs"
  ON public.strategy_jobs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

-- 4) Realtime
ALTER TABLE public.strategy_jobs REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'strategy_jobs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.strategy_jobs';
  END IF;
END $$;

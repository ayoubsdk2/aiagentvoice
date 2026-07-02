-- QA Test Suites: groups runs together
CREATE TABLE public.qa_test_suites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_tests integer NOT NULL DEFAULT 0,
  passed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- QA Test Runs: each test execution
CREATE TABLE public.qa_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id uuid REFERENCES public.qa_test_suites(id) ON DELETE CASCADE,
  test_id text NOT NULL,
  test_category text NOT NULL CHECK (test_category IN ('trait_isolation', 'blended', 'surprise_me', 'four_week_strategy', 'webhook', 'linkedin_post')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'passed', 'failed', 'error')),
  score integer CHECK (score IS NULL OR (score BETWEEN 1 AND 5)),
  judge_rationale text,
  input_text text,
  output_text text,
  traits_used jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qa_test_runs_suite_id ON public.qa_test_runs(suite_id);
CREATE INDEX idx_qa_test_runs_category ON public.qa_test_runs(test_category);
CREATE INDEX idx_qa_test_runs_created_at ON public.qa_test_runs(created_at DESC);

ALTER TABLE public.qa_test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_test_runs ENABLE ROW LEVEL SECURITY;

-- Phaos admins only
CREATE POLICY "phaos_admin_all_suites" ON public.qa_test_suites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::app_role));

CREATE POLICY "phaos_admin_all_runs" ON public.qa_test_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::app_role));
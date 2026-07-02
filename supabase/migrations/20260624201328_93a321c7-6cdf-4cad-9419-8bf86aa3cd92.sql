CREATE TABLE IF NOT EXISTS public.admin_password_override (
  id text PRIMARY KEY DEFAULT 'singleton',
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_password_override TO service_role;
ALTER TABLE public.admin_password_override ENABLE ROW LEVEL SECURITY;
-- No policies => RLS blocks all anon/authenticated access; service_role bypasses RLS.
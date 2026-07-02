CREATE TABLE public.sandbox_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  company_name text NOT NULL,
  vapi_assistant_id text NOT NULL,
  vapi_public_key text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sandbox_instances_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')
);

ALTER TABLE public.sandbox_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phaos admin manages sandbox instances"
ON public.sandbox_instances
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'phaos_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::app_role));

CREATE POLICY "anyone reads active sandbox instances"
ON public.sandbox_instances
FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE TRIGGER set_sandbox_instances_updated_at
BEFORE UPDATE ON public.sandbox_instances
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
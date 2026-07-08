-- Compliance registry foundation tables
-- Creates: regulation_registry, control_library, control_mappings, customer_compliance_annexes
-- Required by: internal.tenant_compliance_summary_impl in 20260626034727

-- 1) regulation_registry (standalone — no FK deps)
CREATE TABLE IF NOT EXISTS public.regulation_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  jurisdiction text NOT NULL,
  description text NOT NULL,
  authority text,
  reference_url text,
  applies_to_industries text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.regulation_registry ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.regulation_registry TO authenticated;
GRANT ALL ON public.regulation_registry TO service_role;
CREATE POLICY "regulation_registry_select_authenticated"
  ON public.regulation_registry FOR SELECT TO authenticated USING (true);

-- 2) control_library (standalone — no FK deps)
CREATE TABLE IF NOT EXISTS public.control_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  control_type text NOT NULL DEFAULT 'technical',
  operating_status text NOT NULL DEFAULT 'planned',
  implementation_ref text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.control_library ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.control_library TO authenticated;
GRANT ALL ON public.control_library TO service_role;
CREATE POLICY "control_library_select_authenticated"
  ON public.control_library FOR SELECT TO authenticated USING (true);

-- 3) control_mappings (FK → regulation_registry.code, control_library.code)
CREATE TABLE IF NOT EXISTS public.control_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_code text NOT NULL REFERENCES public.regulation_registry(code),
  control_code text NOT NULL REFERENCES public.control_library(code),
  requirement_ref text NOT NULL,
  requirement_text text NOT NULL,
  coverage_level text NOT NULL DEFAULT 'partial',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regulation_code, control_code, requirement_ref)
);
ALTER TABLE public.control_mappings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.control_mappings TO authenticated;
GRANT ALL ON public.control_mappings TO service_role;
CREATE POLICY "control_mappings_select_authenticated"
  ON public.control_mappings FOR SELECT TO authenticated USING (true);

-- 4) customer_compliance_annexes (FK → customers.id)
CREATE TABLE IF NOT EXISTS public.customer_compliance_annexes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  in_scope_regulations text[] NOT NULL DEFAULT '{}',
  customer_obligations text NOT NULL,
  phaos_supporting_controls text NOT NULL,
  out_of_scope_notes text,
  version integer NOT NULL DEFAULT 1,
  generated_by uuid REFERENCES auth.users(id),
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_compliance_annexes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.customer_compliance_annexes TO authenticated;
GRANT ALL ON public.customer_compliance_annexes TO service_role;
CREATE POLICY "customer_compliance_annexes_select_own"
  ON public.customer_compliance_annexes FOR SELECT TO authenticated
  USING (customer_id = public.tenant_of(auth.uid()));

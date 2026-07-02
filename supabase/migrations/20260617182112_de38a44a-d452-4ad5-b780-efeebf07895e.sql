
-- Agents per live account
CREATE TABLE public.live_account_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL,
  vapi_assistant_id text NOT NULL,
  label text,
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verification_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, vapi_assistant_id)
);

CREATE INDEX idx_live_account_agents_customer ON public.live_account_agents(customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_account_agents TO authenticated;
GRANT ALL ON public.live_account_agents TO service_role;

ALTER TABLE public.live_account_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all agents"
  ON public.live_account_agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::app_role));

CREATE POLICY "Tenant admins read their agents"
  ON public.live_account_agents FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'phaos_admin'::app_role)
    OR (customer_id = public.tenant_of(auth.uid())
        AND public.has_role(auth.uid(), 'customer_admin'::app_role))
  );

CREATE TRIGGER set_live_account_agents_updated_at
  BEFORE UPDATE ON public.live_account_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Phone numbers per agent
CREATE TABLE public.live_account_phone_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.live_account_agents(id) ON DELETE CASCADE,
  e164 text NOT NULL,
  provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (e164)
);

CREATE INDEX idx_live_account_phone_numbers_customer ON public.live_account_phone_numbers(customer_id);
CREATE INDEX idx_live_account_phone_numbers_agent ON public.live_account_phone_numbers(agent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_account_phone_numbers TO authenticated;
GRANT ALL ON public.live_account_phone_numbers TO service_role;

ALTER TABLE public.live_account_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all numbers"
  ON public.live_account_phone_numbers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::app_role));

CREATE POLICY "Tenant admins read their numbers"
  ON public.live_account_phone_numbers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'phaos_admin'::app_role)
    OR (customer_id = public.tenant_of(auth.uid())
        AND public.has_role(auth.uid(), 'customer_admin'::app_role))
  );

CREATE TRIGGER set_live_account_phone_numbers_updated_at
  BEFORE UPDATE ON public.live_account_phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

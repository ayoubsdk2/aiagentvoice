
-- 1. Extend live_accounts with SOA-required columns
ALTER TABLE public.live_accounts
  ADD COLUMN IF NOT EXISTS notification_email text,
  ADD COLUMN IF NOT EXISTS system_prompt text,
  ADD COLUMN IF NOT EXISTS vapi_assistant_id_primary text,
  ADD COLUMN IF NOT EXISTS setup_email_sent_at timestamptz;

-- 2. SOA vendor integrations (cards in the LIVE account console)
CREATE TABLE IF NOT EXISTS public.soa_vendor_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vendor_key text NOT NULL,
  status text NOT NULL DEFAULT 'off',
  mode text NOT NULL DEFAULT 'dry_run',
  kill_switch boolean NOT NULL DEFAULT false,
  manual_review boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_test_at timestamptz,
  last_test_outcome text,
  last_test_error text,
  last_sync_at timestamptz,
  last_write_at timestamptz,
  last_error text,
  failure_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT soa_vendor_integrations_customer_vendor_uniq UNIQUE (customer_id, vendor_key),
  CONSTRAINT soa_vendor_integrations_status_chk CHECK (status IN ('off','on','manual_review','pending')),
  CONSTRAINT soa_vendor_integrations_mode_chk CHECK (mode IN ('dry_run','write_enabled','manual_approval','full_auto'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.soa_vendor_integrations TO authenticated;
GRANT ALL ON public.soa_vendor_integrations TO service_role;
ALTER TABLE public.soa_vendor_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phaos_admin manages soa vendor integrations"
  ON public.soa_vendor_integrations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "Tenant admins read their soa integrations"
  ON public.soa_vendor_integrations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'phaos_admin'::public.app_role)
    OR (customer_id = public.tenant_of(auth.uid())
        AND public.has_role(auth.uid(), 'customer_admin'::public.app_role))
  );

CREATE TRIGGER set_soa_vendor_integrations_updated_at
  BEFORE UPDATE ON public.soa_vendor_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_soa_vendor_integrations_customer
  ON public.soa_vendor_integrations(customer_id);

-- 3. Action Router config (per live account)
CREATE TABLE IF NOT EXISTS public.action_router_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  endpoint_url text,
  auth_secret_ref text,
  retry_max integer NOT NULL DEFAULT 3,
  retry_backoff_seconds integer NOT NULL DEFAULT 30,
  manual_review_destination text,
  vendor_priority jsonb NOT NULL DEFAULT '["email","integration","portal_automation"]'::jsonb,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_router_config TO authenticated;
GRANT ALL ON public.action_router_config TO service_role;
ALTER TABLE public.action_router_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phaos_admin manages action router config"
  ON public.action_router_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE TRIGGER set_action_router_config_updated_at
  BEFORE UPDATE ON public.action_router_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Service ticket intents (audit + manual review queue)
CREATE TABLE IF NOT EXISTS public.service_ticket_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vapi_call_id text,
  session_ref text,
  intent text NOT NULL,
  vendor_chosen text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text NOT NULL DEFAULT 'queued',
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  manual_review boolean NOT NULL DEFAULT false,
  approval_required boolean NOT NULL DEFAULT false,
  created_by text NOT NULL DEFAULT 'vapi',
  transcript_ref text,
  recording_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_ticket_intents_result_chk
    CHECK (result IN ('queued','success','failed','manual_review','vendor_error','approval_required'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_ticket_intents TO authenticated;
GRANT ALL ON public.service_ticket_intents TO service_role;
ALTER TABLE public.service_ticket_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phaos_admin manages service ticket intents"
  ON public.service_ticket_intents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "Tenant admins read their ticket intents"
  ON public.service_ticket_intents
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'phaos_admin'::public.app_role)
    OR (customer_id = public.tenant_of(auth.uid())
        AND public.has_role(auth.uid(), 'customer_admin'::public.app_role))
  );

CREATE TRIGGER set_service_ticket_intents_updated_at
  BEFORE UPDATE ON public.service_ticket_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_service_ticket_intents_customer
  ON public.service_ticket_intents(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_ticket_intents_result
  ON public.service_ticket_intents(result) WHERE result IN ('queued','manual_review','failed','approval_required');

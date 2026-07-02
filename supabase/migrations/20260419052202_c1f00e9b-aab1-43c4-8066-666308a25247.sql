-- =====================================================
-- 1. Encrypted integration credentials
-- =====================================================
CREATE TABLE public.integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  integration_id text NOT NULL, -- e.g. 'telnyx', 'sales_chain', 'eautomate', 'hubspot'
  -- AES-256-GCM encrypted blob (base64-encoded)
  ciphertext text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  -- Field hints (non-sensitive metadata: which fields were filled)
  field_hints jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Validation state
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed', 'disabled')),
  last_tested_at timestamptz,
  last_test_outcome text,
  last_test_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (customer_id, integration_id)
);

CREATE INDEX idx_integration_credentials_customer ON public.integration_credentials(customer_id);
CREATE INDEX idx_integration_credentials_status ON public.integration_credentials(status);

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

-- Tenant admins read their own (but client never gets ciphertext — controlled at edge fn)
CREATE POLICY "tenant admin reads own integration creds"
  ON public.integration_credentials
  FOR SELECT TO authenticated
  USING (customer_id = public.tenant_of(auth.uid())
         AND public.has_role(auth.uid(), 'customer_admin'::public.app_role));

CREATE POLICY "tenant admin writes own integration creds"
  ON public.integration_credentials
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = public.tenant_of(auth.uid())
              AND public.has_role(auth.uid(), 'customer_admin'::public.app_role));

CREATE POLICY "tenant admin updates own integration creds"
  ON public.integration_credentials
  FOR UPDATE TO authenticated
  USING (customer_id = public.tenant_of(auth.uid())
         AND public.has_role(auth.uid(), 'customer_admin'::public.app_role))
  WITH CHECK (customer_id = public.tenant_of(auth.uid())
              AND public.has_role(auth.uid(), 'customer_admin'::public.app_role));

CREATE POLICY "tenant admin deletes own integration creds"
  ON public.integration_credentials
  FOR DELETE TO authenticated
  USING (customer_id = public.tenant_of(auth.uid())
         AND public.has_role(auth.uid(), 'customer_admin'::public.app_role));

CREATE POLICY "phaos admin full access integration creds"
  ON public.integration_credentials
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE TRIGGER integration_credentials_set_updated_at
  BEFORE UPDATE ON public.integration_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit any change to credentials
CREATE TRIGGER integration_credentials_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.integration_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

-- =====================================================
-- 2. Telnyx call events (append-only)
-- =====================================================
CREATE TABLE public.telnyx_call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  call_id uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  telnyx_call_control_id text,
  telnyx_call_leg_id text,
  event_type text NOT NULL, -- call.initiated, call.answered, call.hangup, etc.
  from_number text,
  to_number text,
  signature_verified boolean NOT NULL DEFAULT false,
  signature_timestamp timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telnyx_events_customer ON public.telnyx_call_events(customer_id);
CREATE INDEX idx_telnyx_events_call_control_id ON public.telnyx_call_events(telnyx_call_control_id);
CREATE INDEX idx_telnyx_events_created_at ON public.telnyx_call_events(created_at DESC);

ALTER TABLE public.telnyx_call_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant reads own telnyx events"
  ON public.telnyx_call_events
  FOR SELECT TO authenticated
  USING (customer_id = public.tenant_of(auth.uid()));

CREATE POLICY "phaos admin reads all telnyx events"
  ON public.telnyx_call_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

-- Append-only — no update/delete from any authenticated role
CREATE POLICY "deny telnyx event updates"
  ON public.telnyx_call_events
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "deny telnyx event deletes"
  ON public.telnyx_call_events
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (false);

-- =====================================================
-- 3. Integration sync log (Sales Chain + E-Automate)
-- =====================================================
CREATE TABLE public.integration_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  integration_id text NOT NULL, -- 'sales_chain' | 'eautomate'
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  resource_type text NOT NULL, -- 'lead' | 'opportunity' | 'service_call' | 'meter_read'
  resource_id text, -- our local ID
  external_id text, -- ID assigned by remote system
  outcome text NOT NULL CHECK (outcome IN ('success', 'failure', 'partial')),
  http_status int,
  error_message text,
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_log_customer ON public.integration_sync_log(customer_id);
CREATE INDEX idx_sync_log_integration ON public.integration_sync_log(integration_id, created_at DESC);
CREATE INDEX idx_sync_log_outcome ON public.integration_sync_log(outcome) WHERE outcome != 'success';

ALTER TABLE public.integration_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant reads own sync log"
  ON public.integration_sync_log
  FOR SELECT TO authenticated
  USING (customer_id = public.tenant_of(auth.uid()));

CREATE POLICY "phaos admin reads all sync log"
  ON public.integration_sync_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "deny sync log updates"
  ON public.integration_sync_log
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "deny sync log deletes"
  ON public.integration_sync_log
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (false);

-- =====================================================
-- 4. Helper RPC: list integration statuses for current tenant
-- (returns metadata only — no ciphertext)
-- =====================================================
CREATE OR REPLACE FUNCTION public.list_integration_statuses(_customer_id uuid)
RETURNS TABLE (
  integration_id text,
  status text,
  last_tested_at timestamptz,
  last_test_outcome text,
  last_test_error text,
  field_hints jsonb,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ic.integration_id,
    ic.status,
    ic.last_tested_at,
    ic.last_test_outcome,
    ic.last_test_error,
    ic.field_hints,
    ic.updated_at
  FROM public.integration_credentials ic
  WHERE ic.customer_id = _customer_id
    AND (
      public.has_role(auth.uid(), 'phaos_admin'::public.app_role)
      OR (ic.customer_id = public.tenant_of(auth.uid())
          AND public.has_role(auth.uid(), 'customer_admin'::public.app_role))
    );
$$;
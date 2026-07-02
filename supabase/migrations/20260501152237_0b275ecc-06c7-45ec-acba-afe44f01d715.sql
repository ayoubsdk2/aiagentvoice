-- Extend organizations with billing state
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'inactive'
    CHECK (billing_status IN ('inactive','active','past_due','canceled','grace_period','suspended')),
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS card_exp_month int,
  ADD COLUMN IF NOT EXISTS card_exp_year int,
  ADD COLUMN IF NOT EXISTS billing_plan text NOT NULL DEFAULT 'vip_early_adopter',
  ADD COLUMN IF NOT EXISTS rate_per_second_cents numeric(10,4) NOT NULL DEFAULT 0.3333,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_call_at timestamptz;

-- Per-call usage events (source of truth for monthly billing)
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_id text,
  vapi_call_id text,
  seconds_used int NOT NULL CHECK (seconds_used >= 0),
  cost_cents numeric(12,4) NOT NULL DEFAULT 0,
  rate_per_second_cents numeric(10,4) NOT NULL,
  billing_period date NOT NULL,
  billed_at timestamptz,
  invoice_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_org_period
  ON public.usage_events(organization_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_usage_events_unbilled
  ON public.usage_events(organization_id, billing_period) WHERE billed_at IS NULL;

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view own usage"
  ON public.usage_events FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "service role manages usage"
  ON public.usage_events FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Monthly invoices we generate and push to Stripe
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  billing_period date NOT NULL,
  stripe_invoice_id text UNIQUE,
  stripe_payment_intent_id text,
  total_seconds int NOT NULL DEFAULT 0,
  total_cents int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','paid','failed','refunded','void')),
  attempt_count int NOT NULL DEFAULT 0,
  last_error text,
  finalized_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, billing_period)
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_org ON public.billing_invoices(organization_id);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view own invoices"
  ON public.billing_invoices FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "service role manages invoices"
  ON public.billing_invoices FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Append-only billing event log
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  stripe_event_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_org ON public.billing_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_events_stripe_event ON public.billing_events(stripe_event_id);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view own billing events"
  ON public.billing_events FOR SELECT
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "service role manages billing events"
  ON public.billing_events FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- updated_at trigger for billing_invoices
CREATE TRIGGER trg_billing_invoices_updated_at
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: record a call's usage. Called from vapi-webhook (service role).
CREATE OR REPLACE FUNCTION public.record_call_usage(
  _organization_id uuid,
  _vapi_call_id text,
  _seconds int,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rate numeric(10,4);
  _id uuid;
  _period date;
BEGIN
  IF _organization_id IS NULL OR _seconds IS NULL OR _seconds <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT rate_per_second_cents INTO _rate
    FROM public.organizations WHERE id = _organization_id;
  IF _rate IS NULL THEN _rate := 0.3333; END IF;

  _period := date_trunc('month', now())::date;

  INSERT INTO public.usage_events (
    organization_id, vapi_call_id, seconds_used,
    rate_per_second_cents, cost_cents, billing_period, metadata
  ) VALUES (
    _organization_id, _vapi_call_id, _seconds,
    _rate, (_seconds * _rate)::numeric(12,4), _period, COALESCE(_metadata, '{}'::jsonb)
  ) RETURNING id INTO _id;

  -- Stamp first-call timestamp once
  UPDATE public.organizations
    SET first_call_at = now()
    WHERE id = _organization_id AND first_call_at IS NULL;

  RETURN _id;
END;
$$;
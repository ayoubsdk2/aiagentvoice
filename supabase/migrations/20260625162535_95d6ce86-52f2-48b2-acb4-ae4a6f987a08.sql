
-- 1. Relax legacy NOT NULL on encrypted blob columns (HubSpot uses dedicated columns).
ALTER TABLE public.integration_credentials ALTER COLUMN ciphertext DROP NOT NULL;
ALTER TABLE public.integration_credentials ALTER COLUMN iv DROP NOT NULL;
ALTER TABLE public.integration_credentials ALTER COLUMN auth_tag DROP NOT NULL;

-- 2. Integration pins (Search & Add persistent list)
CREATE TABLE public.integration_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  integration_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (customer_id, integration_id)
);

GRANT SELECT, INSERT, DELETE ON public.integration_pins TO authenticated;
GRANT ALL ON public.integration_pins TO service_role;

ALTER TABLE public.integration_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phaos admin manage pins"
  ON public.integration_pins
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "tenant admin reads own pins"
  ON public.integration_pins
  FOR SELECT
  TO authenticated
  USING (customer_id = public.tenant_of(auth.uid())
         AND public.has_role(auth.uid(), 'customer_admin'::public.app_role));

CREATE POLICY "tenant admin writes own pins"
  ON public.integration_pins
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = public.tenant_of(auth.uid())
              AND public.has_role(auth.uid(), 'customer_admin'::public.app_role));

CREATE POLICY "tenant admin deletes own pins"
  ON public.integration_pins
  FOR DELETE
  TO authenticated
  USING (customer_id = public.tenant_of(auth.uid())
         AND public.has_role(auth.uid(), 'customer_admin'::public.app_role));

CREATE INDEX idx_integration_pins_customer ON public.integration_pins(customer_id);

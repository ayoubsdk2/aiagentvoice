
ALTER TABLE public.live_accounts
  ADD COLUMN IF NOT EXISTS provisioning_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS provisioning_error text,
  ADD COLUMN IF NOT EXISTS needs_manual_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS live_accounts_idempotency_key_uidx
  ON public.live_accounts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.live_account_phone_numbers
  ADD COLUMN IF NOT EXISTS telnyx_phone_number_id text,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS area_code text;

ALTER TABLE public.live_account_agents
  ADD COLUMN IF NOT EXISTS routing_type text,
  ADD COLUMN IF NOT EXISTS parent_assistant_id text,
  ADD COLUMN IF NOT EXISTS line_label text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'live_account_agents' AND constraint_name = 'live_account_agents_routing_type_chk'
  ) THEN
    ALTER TABLE public.live_account_agents
      ADD CONSTRAINT live_account_agents_routing_type_chk
      CHECK (routing_type IS NULL OR routing_type IN ('unique','duplicate'));
  END IF;
END $$;

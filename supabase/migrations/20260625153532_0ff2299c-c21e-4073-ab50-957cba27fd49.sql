ALTER TABLE public.integration_credentials
  ADD COLUMN IF NOT EXISTS hubspot_portal_id text,
  ADD COLUMN IF NOT EXISTS hubspot_private_app_token_encrypted text;
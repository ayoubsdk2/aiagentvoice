-- ==========================================================================
-- Relax NOT NULL constraints on portal_calls so webhooks can safely insert
-- call records even if the exact location/phone mapping is unknown.
-- ==========================================================================

ALTER TABLE public.portal_calls 
  ALTER COLUMN location_id DROP NOT NULL;

ALTER TABLE public.portal_calls 
  ALTER COLUMN phone_number_id DROP NOT NULL;

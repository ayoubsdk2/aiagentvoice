
ALTER TABLE public.live_account_agents
  ADD COLUMN IF NOT EXISTS voice_provider text,
  ADD COLUMN IF NOT EXISTS voice_id text;

ALTER TABLE public.live_accounts
  ADD COLUMN IF NOT EXISTS notification_config jsonb NOT NULL DEFAULT '{"include_transcript":true,"include_summary":true,"subject_mode":"theme"}'::jsonb;

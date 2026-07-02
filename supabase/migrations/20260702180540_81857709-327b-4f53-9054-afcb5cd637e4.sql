
ALTER TABLE public.live_account_agents
  ADD COLUMN IF NOT EXISTS base_agent_id text NOT NULL DEFAULT 'agent_281c022afc5fd87515a3a7956a',
  ADD COLUMN IF NOT EXISTS custom_instructions text,
  ADD COLUMN IF NOT EXISTS dynamic_vars jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.live_accounts
  ADD COLUMN IF NOT EXISTS transfer_number text,
  ADD COLUMN IF NOT EXISTS supply_team_number text,
  ADD COLUMN IF NOT EXISTS vip_greeting text;

-- 1. ENUMS
CREATE TYPE public.agent_type AS ENUM ('service', 'sales', 'toner', 'mixed');
CREATE TYPE public.consent_channel AS ENUM ('voice', 'sms', 'email', 'whatsapp');
CREATE TYPE public.consent_source AS ENUM ('web_form', 'voice_recording', 'written', 'imported_crm', 'api', 'other');
CREATE TYPE public.consent_status AS ENUM ('granted', 'revoked', 'expired', 'pending');
CREATE TYPE public.integration_type AS ENUM ('sales_chain', 'eautomate', 'microsoft_365', 'google_workspace', 'webhook', 'telemetry_provider');
CREATE TYPE public.org_member_role AS ENUM ('owner', 'admin', 'manager', 'viewer');
CREATE TYPE public.portal_account_status AS ENUM ('active', 'pending_approval', 'trial', 'suspended');
CREATE TYPE public.portal_agent_status AS ENUM ('active', 'inactive');
CREATE TYPE public.portal_integration_status AS ENUM ('connected', 'setup_required', 'error');
CREATE TYPE public.portal_location_status AS ENUM ('active', 'inactive', 'paused');
CREATE TYPE public.portal_membership_role AS ENUM ('owner', 'admin', 'location_manager', 'viewer', 'trial');
CREATE TYPE public.portal_org_status AS ENUM ('trial', 'active', 'suspended');
CREATE TYPE public.portal_phone_status AS ENUM ('active', 'inactive', 'provisioning', 'error');
CREATE TYPE public.portal_platform_role AS ENUM ('internal_super_admin', 'internal_operator', 'customer_owner', 'customer_admin', 'location_manager', 'viewer', 'trial_user');
CREATE TYPE public.telephony_status AS ENUM ('pending_forward', 'active', 'paused', 'failed');

-- 2. LEVEL 0 TABLES (No intra-group deps, just customers/users)

CREATE TABLE public.locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    name text NOT NULL,
    external_number text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kill_switches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    outbound_email_paused boolean NOT NULL DEFAULT false,
    outbound_sms_paused boolean NOT NULL DEFAULT false,
    outbound_voice_paused boolean NOT NULL DEFAULT false,
    panic_ai_disabled boolean NOT NULL DEFAULT false,
    payments_paused boolean NOT NULL DEFAULT false,
    reason text,
    toggled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    action text NOT NULL,
    actor_type text NOT NULL,
    actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    resource_id uuid,
    resource_type text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_activity_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    event_type text NOT NULL,
    session_id text,
    ip_address text,
    user_agent text,
    duration_seconds integer,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.consent_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    channel public.consent_channel NOT NULL,
    source public.consent_source NOT NULL,
    status public.consent_status NOT NULL,
    contact_email text,
    contact_phone text,
    captured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    evidence_url text,
    evidence_hash text,
    notes text,
    captured_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dsar_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    request_type text NOT NULL,
    status text NOT NULL,
    subject_email text,
    subject_phone text,
    requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    verification_method text,
    notes text,
    fulfilled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sandbox_usage_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    agent_name text,
    call_id uuid,
    duration_seconds integer,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.legal_agreements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    agreement_type text NOT NULL,
    status text NOT NULL,
    signer_email text,
    signer_name text,
    evidence_url text,
    notes text,
    signed_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. LEVEL 1 TABLES
CREATE TABLE public.agents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
    name text NOT NULL,
    type public.agent_type NOT NULL,
    system_prompt text,
    workflow_config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. LEVEL 2 TABLES
CREATE TABLE public.calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
    agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
    caller_name text,
    customer_phone text,
    twilio_number text,
    intent text,
    outcome text,
    ai_resolved boolean NOT NULL DEFAULT false,
    transferred_to_human boolean NOT NULL DEFAULT false,
    duration_sec integer,
    error_code text,
    serial_number text,
    recording_url text,
    transcript_url text,
    started_at timestamptz,
    ended_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orchestrator_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
    agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
    contact_name text,
    company text,
    email text,
    phone text,
    urgency text,
    action_taken text,
    sales_chain_lead_id text,
    sales_chain_synced_at timestamptz,
    specs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. PLACEHOLDER FUNCTIONS FOR REVOKE FIXES
CREATE OR REPLACE FUNCTION public.sync_kill_switch_for_risk() RETURNS void LANGUAGE plpgsql AS $$ BEGIN END; $$;
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.consume_ai_tokens(customer_id uuid, tokens bigint) RETURNS void LANGUAGE plpgsql AS $$ BEGIN END; $$;
CREATE OR REPLACE FUNCTION public.log_ai_action(customer_id uuid, action text, model text, risk_level text, rationale text, resource_id uuid, actor_user_id uuid, agent_id text, call_id text, model_version text, metadata jsonb, decision text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN END; $$;
CREATE OR REPLACE FUNCTION public.record_consent_change(customer_id uuid, channel public.consent_channel, status public.consent_status, contact_email text, contact_phone text, source public.consent_source, evidence_url text, notes text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN END; $$;
CREATE OR REPLACE FUNCTION public.check_consent(customer_id uuid, channel public.consent_channel, contact_email text, contact_phone text) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RETURN true; END; $$;
CREATE OR REPLACE FUNCTION public.outbound_allowed(customer_id uuid, channel public.consent_channel) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RETURN true; END; $$;
CREATE OR REPLACE FUNCTION public.is_outbound_paused(customer_id uuid, channel public.consent_channel) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RETURN false; END; $$;
CREATE OR REPLACE FUNCTION public.email_queue_dispatch() RETURNS void LANGUAGE plpgsql AS $$ BEGIN END; $$;
CREATE OR REPLACE FUNCTION public.email_queue_wake() RETURNS void LANGUAGE plpgsql AS $$ BEGIN END; $$;
CREATE OR REPLACE FUNCTION public.handle_new_user_role() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;

-- =====================================================================
-- Phaos AI — Customer Portal Foundation (Phase 1)
-- ZERO-REGRESSION. All NEW tables. Existing schema untouched.
-- Order: enums → tables → functions → policies → triggers → backfill.
-- =====================================================================

-- ---------- Enums ----------
/*
CREATE TYPE public.portal_platform_role AS ENUM (
  'internal_super_admin','internal_operator','customer_owner','customer_admin',
  'location_manager','viewer','trial_user'
);
CREATE TYPE public.portal_account_status AS ENUM ('active','pending_approval','trial','suspended');
CREATE TYPE public.portal_org_status AS ENUM ('trial','active','suspended');
CREATE TYPE public.portal_location_status AS ENUM ('active','inactive');
CREATE TYPE public.portal_phone_status AS ENUM ('active','inactive','provisioning','error');
CREATE TYPE public.portal_agent_status AS ENUM ('active','inactive');
CREATE TYPE public.portal_integration_status AS ENUM ('connected','setup_required','error');
CREATE TYPE public.portal_membership_role AS ENUM ('owner','admin','location_manager','viewer','trial');
*/

-- ---------- Shared updated_at trigger fn ----------
CREATE OR REPLACE FUNCTION public.portal_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =====================================================================
-- TABLES (created first, no RLS yet, no policies referencing them)
-- =====================================================================

CREATE TABLE public.portal_user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  platform_role portal_platform_role NOT NULL DEFAULT 'trial_user',
  is_internal boolean NOT NULL DEFAULT false,
  default_org_id uuid,
  account_status portal_account_status NOT NULL DEFAULT 'trial',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.portal_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  primary_color text,
  savings_per_call numeric NOT NULL DEFAULT 15,
  org_status portal_org_status NOT NULL DEFAULT 'trial',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.portal_user_org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.portal_organizations(id) ON DELETE CASCADE,
  role portal_membership_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);
CREATE INDEX idx_portal_memberships_user ON public.portal_user_org_memberships(user_id);
CREATE INDEX idx_portal_memberships_org ON public.portal_user_org_memberships(org_id);

CREATE TABLE public.portal_organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.portal_organizations(id) ON DELETE CASCADE,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  business_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  routing_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_dashboard_enabled boolean NOT NULL DEFAULT true,
  sandbox_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.portal_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.portal_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  timezone text NOT NULL DEFAULT 'America/New_York',
  business_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  routing_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  status portal_location_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_locations_org ON public.portal_locations(org_id);

CREATE TABLE public.portal_user_location_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.portal_locations(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, location_id)
);

CREATE TABLE public.portal_ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.portal_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  voice_provider text,
  voice_id text,
  prompt_pack jsonb NOT NULL DEFAULT '{}'::jsonb,
  tools_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  escalation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  status portal_agent_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_agents_org ON public.portal_ai_agents(org_id);

CREATE TABLE public.portal_phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.portal_organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.portal_locations(id) ON DELETE SET NULL,
  number text UNIQUE NOT NULL,
  friendly_name text,
  vapi_assistant_id text,
  assigned_agent_id uuid REFERENCES public.portal_ai_agents(id) ON DELETE SET NULL,
  carrier text,
  status portal_phone_status NOT NULL DEFAULT 'provisioning',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_phones_org ON public.portal_phone_numbers(org_id);
CREATE INDEX idx_portal_phones_location ON public.portal_phone_numbers(location_id);

CREATE TABLE public.portal_number_agent_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id uuid NOT NULL REFERENCES public.portal_phone_numbers(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.portal_ai_agents(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.portal_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.portal_organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.portal_locations(id) ON DELETE CASCADE,
  phone_number_id uuid NOT NULL REFERENCES public.portal_phone_numbers(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.portal_ai_agents(id) ON DELETE SET NULL,
  caller_phone text,
  caller_name text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_sec integer,
  outcome text,
  ai_resolved boolean NOT NULL DEFAULT false,
  transferred_to_human boolean NOT NULL DEFAULT false,
  recording_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_calls_org ON public.portal_calls(org_id);
CREATE INDEX idx_portal_calls_location ON public.portal_calls(location_id);
CREATE INDEX idx_portal_calls_started ON public.portal_calls(started_at DESC);

CREATE TABLE public.portal_call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.portal_calls(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.portal_organizations(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.portal_locations(id) ON DELETE CASCADE,
  phone_number_id uuid REFERENCES public.portal_phone_numbers(id) ON DELETE SET NULL,
  transcript_text text,
  searchable_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_transcripts_org ON public.portal_call_transcripts(org_id);
CREATE INDEX idx_portal_transcripts_call ON public.portal_call_transcripts(call_id);

CREATE TABLE public.portal_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.portal_organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.portal_locations(id) ON DELETE SET NULL,
  call_id uuid REFERENCES public.portal_calls(id) ON DELETE SET NULL,
  customer_name text,
  customer_email text,
  customer_phone text,
  lead_score integer NOT NULL DEFAULT 0,
  quote_status text NOT NULL DEFAULT 'none',
  print_specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_leads_org ON public.portal_leads(org_id);

CREATE TABLE public.portal_tenant_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.portal_organizations(id) ON DELETE CASCADE,
  integration_type text NOT NULL,
  status portal_integration_status NOT NULL DEFAULT 'setup_required',
  config_ref text,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, integration_type)
);

CREATE TABLE public.portal_location_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.portal_locations(id) ON DELETE CASCADE,
  integration_type text NOT NULL,
  status portal_integration_status NOT NULL DEFAULT 'setup_required',
  config_ref text,
  inherits_from_org boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, integration_type)
);

CREATE TABLE public.portal_client_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.portal_organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.portal_locations(id) ON DELETE CASCADE,
  integration_type text NOT NULL,
  encrypted_payload text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.portal_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.portal_organizations(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.portal_locations(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_scope text,
  resource_type text,
  resource_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_audit_org ON public.portal_audit_events(org_id, created_at DESC);

CREATE TABLE public.portal_sample_dashboard_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.portal_organizations(id) ON DELETE CASCADE,
  preset_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- HELPER FUNCTIONS (now that referenced tables exist)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_internal_operator(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND lower(email) IN ('daniel@phaosai.com','shree@phaosai.com','diego@phaosai.com')
  );
$$;
COMMENT ON FUNCTION public.is_internal_operator(uuid) IS
  'True ONLY for the 3 hardcoded Phaos internal operator emails. Used by frontend routing and RLS to gate the legacy operator UI.';

CREATE OR REPLACE FUNCTION public.portal_is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.portal_user_org_memberships
    WHERE user_id = _user_id AND org_id = _org_id);
$$;

CREATE OR REPLACE FUNCTION public.portal_has_org_role(_user_id uuid, _org_id uuid, _role portal_membership_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.portal_user_org_memberships
    WHERE user_id = _user_id AND org_id = _org_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.portal_can_view_location(_user_id uuid, _location_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_locations l
    WHERE l.id = _location_id
      AND (
        public.portal_is_org_member(_user_id, l.org_id)
        OR EXISTS (SELECT 1 FROM public.portal_user_location_permissions p
                   WHERE p.user_id = _user_id AND p.location_id = _location_id AND p.can_view = true)
      )
  );
$$;

-- =====================================================================
-- ENABLE RLS + POLICIES
-- =====================================================================

ALTER TABLE public.portal_user_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_portal_user_profiles_updated BEFORE UPDATE ON public.portal_user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.portal_set_updated_at();
CREATE POLICY "users read own profile" ON public.portal_user_profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "internal operator full profiles" ON public.portal_user_profiles
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_user_org_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own memberships" ON public.portal_user_org_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "internal operator full memberships" ON public.portal_user_org_memberships
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_portal_orgs_updated BEFORE UPDATE ON public.portal_organizations
  FOR EACH ROW EXECUTE FUNCTION public.portal_set_updated_at();
CREATE POLICY "members read own org" ON public.portal_organizations
  FOR SELECT TO authenticated USING (public.portal_is_org_member(auth.uid(), id));
CREATE POLICY "owners update own org" ON public.portal_organizations
  FOR UPDATE TO authenticated
  USING (public.portal_has_org_role(auth.uid(), id, 'owner'))
  WITH CHECK (public.portal_has_org_role(auth.uid(), id, 'owner'));
CREATE POLICY "internal operator full orgs" ON public.portal_organizations
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_organization_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_portal_org_settings_updated BEFORE UPDATE ON public.portal_organization_settings
  FOR EACH ROW EXECUTE FUNCTION public.portal_set_updated_at();
CREATE POLICY "members read org settings" ON public.portal_organization_settings
  FOR SELECT TO authenticated USING (public.portal_is_org_member(auth.uid(), org_id));
CREATE POLICY "admins update org settings" ON public.portal_organization_settings
  FOR UPDATE TO authenticated
  USING (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'))
  WITH CHECK (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "internal operator full org settings" ON public.portal_organization_settings
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_locations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_portal_locations_updated BEFORE UPDATE ON public.portal_locations
  FOR EACH ROW EXECUTE FUNCTION public.portal_set_updated_at();
CREATE POLICY "members read locations" ON public.portal_locations
  FOR SELECT TO authenticated USING (public.portal_is_org_member(auth.uid(), org_id));
CREATE POLICY "admins insert locations" ON public.portal_locations
  FOR INSERT TO authenticated
  WITH CHECK (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "admins update locations" ON public.portal_locations
  FOR UPDATE TO authenticated
  USING (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'))
  WITH CHECK (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "admins delete locations" ON public.portal_locations
  FOR DELETE TO authenticated
  USING (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "internal operator full locations" ON public.portal_locations
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_user_location_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own loc perms" ON public.portal_user_location_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "internal operator full loc perms" ON public.portal_user_location_permissions
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_ai_agents ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_portal_agents_updated BEFORE UPDATE ON public.portal_ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.portal_set_updated_at();
CREATE POLICY "members read agents" ON public.portal_ai_agents
  FOR SELECT TO authenticated USING (public.portal_is_org_member(auth.uid(), org_id));
CREATE POLICY "admins insert agents" ON public.portal_ai_agents
  FOR INSERT TO authenticated
  WITH CHECK (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "admins update agents" ON public.portal_ai_agents
  FOR UPDATE TO authenticated
  USING (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'))
  WITH CHECK (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "internal operator full agents" ON public.portal_ai_agents
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_portal_phones_updated BEFORE UPDATE ON public.portal_phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.portal_set_updated_at();
CREATE POLICY "members read phones" ON public.portal_phone_numbers
  FOR SELECT TO authenticated USING (public.portal_is_org_member(auth.uid(), org_id));
CREATE POLICY "admins insert phones" ON public.portal_phone_numbers
  FOR INSERT TO authenticated
  WITH CHECK (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "admins update phones" ON public.portal_phone_numbers
  FOR UPDATE TO authenticated
  USING (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'))
  WITH CHECK (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "internal operator full phones" ON public.portal_phone_numbers
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_number_agent_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read assignments" ON public.portal_number_agent_assignments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.portal_phone_numbers p
            WHERE p.id = phone_number_id AND public.portal_is_org_member(auth.uid(), p.org_id))
  );
CREATE POLICY "internal operator full assignments" ON public.portal_number_agent_assignments
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read calls" ON public.portal_calls
  FOR SELECT TO authenticated USING (public.portal_is_org_member(auth.uid(), org_id));
CREATE POLICY "internal operator full calls" ON public.portal_calls
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_call_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read transcripts" ON public.portal_call_transcripts
  FOR SELECT TO authenticated USING (public.portal_is_org_member(auth.uid(), org_id));
CREATE POLICY "internal operator full transcripts" ON public.portal_call_transcripts
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read leads" ON public.portal_leads
  FOR SELECT TO authenticated USING (public.portal_is_org_member(auth.uid(), org_id));
CREATE POLICY "managers update leads" ON public.portal_leads
  FOR UPDATE TO authenticated
  USING (
    public.portal_has_org_role(auth.uid(), org_id, 'owner') OR
    public.portal_has_org_role(auth.uid(), org_id, 'admin') OR
    public.portal_has_org_role(auth.uid(), org_id, 'location_manager')
  )
  WITH CHECK (
    public.portal_has_org_role(auth.uid(), org_id, 'owner') OR
    public.portal_has_org_role(auth.uid(), org_id, 'admin') OR
    public.portal_has_org_role(auth.uid(), org_id, 'location_manager')
  );
CREATE POLICY "internal operator full leads" ON public.portal_leads
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_tenant_integrations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_portal_tenant_integ_updated BEFORE UPDATE ON public.portal_tenant_integrations
  FOR EACH ROW EXECUTE FUNCTION public.portal_set_updated_at();
CREATE POLICY "members read tenant integrations" ON public.portal_tenant_integrations
  FOR SELECT TO authenticated USING (public.portal_is_org_member(auth.uid(), org_id));
CREATE POLICY "admins insert tenant integrations" ON public.portal_tenant_integrations
  FOR INSERT TO authenticated
  WITH CHECK (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "admins update tenant integrations" ON public.portal_tenant_integrations
  FOR UPDATE TO authenticated
  USING (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'))
  WITH CHECK (public.portal_has_org_role(auth.uid(), org_id, 'owner') OR public.portal_has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY "internal operator full tenant integrations" ON public.portal_tenant_integrations
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_location_integrations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_portal_loc_integ_updated BEFORE UPDATE ON public.portal_location_integrations
  FOR EACH ROW EXECUTE FUNCTION public.portal_set_updated_at();
CREATE POLICY "members read loc integrations" ON public.portal_location_integrations
  FOR SELECT TO authenticated USING (public.portal_can_view_location(auth.uid(), location_id));
CREATE POLICY "internal operator full loc integrations" ON public.portal_location_integrations
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

-- Vault: ONLY internal operators (and service role) can read. Customers must use edge functions.
ALTER TABLE public.portal_client_vault ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_portal_vault_updated BEFORE UPDATE ON public.portal_client_vault
  FOR EACH ROW EXECUTE FUNCTION public.portal_set_updated_at();
CREATE POLICY "internal operator only vault" ON public.portal_client_vault
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

ALTER TABLE public.portal_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own audit" ON public.portal_audit_events
  FOR SELECT TO authenticated USING (org_id IS NOT NULL AND public.portal_is_org_member(auth.uid(), org_id));
CREATE POLICY "internal operator full audit" ON public.portal_audit_events
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

CREATE OR REPLACE FUNCTION public.portal_prevent_audit_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'portal_audit_events is append-only'; END;
$$;
CREATE TRIGGER trg_portal_audit_no_update BEFORE UPDATE OR DELETE ON public.portal_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.portal_prevent_audit_mutation();

ALTER TABLE public.portal_sample_dashboard_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read sample presets" ON public.portal_sample_dashboard_presets
  FOR SELECT TO authenticated USING (
    active = true AND (org_id IS NULL OR public.portal_is_org_member(auth.uid(), org_id))
  );
CREATE POLICY "internal operator full presets" ON public.portal_sample_dashboard_presets
  FOR ALL TO authenticated USING (public.is_internal_operator()) WITH CHECK (public.is_internal_operator());

-- =====================================================================
-- New-user trigger (coexists with existing handle_new_user)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.portal_handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_internal boolean; _role portal_platform_role; _status portal_account_status;
BEGIN
  _is_internal := lower(NEW.email) IN ('daniel@phaosai.com','shree@phaosai.com','diego@phaosai.com');
  IF _is_internal THEN _role := 'internal_super_admin'; _status := 'active';
  ELSE _role := 'trial_user'; _status := 'trial'; END IF;

  INSERT INTO public.portal_user_profiles (id, email, full_name, platform_role, is_internal, account_status)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    _role, _is_internal, _status
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_portal
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.portal_handle_new_user();

-- Backfill
INSERT INTO public.portal_user_profiles (id, email, full_name, platform_role, is_internal, account_status)
SELECT u.id, u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'display_name', split_part(u.email,'@',1)),
  CASE WHEN lower(u.email) IN ('daniel@phaosai.com','shree@phaosai.com','diego@phaosai.com')
       THEN 'internal_super_admin'::portal_platform_role
       ELSE 'trial_user'::portal_platform_role END,
  lower(u.email) IN ('daniel@phaosai.com','shree@phaosai.com','diego@phaosai.com'),
  CASE WHEN lower(u.email) IN ('daniel@phaosai.com','shree@phaosai.com','diego@phaosai.com')
       THEN 'active'::portal_account_status
       ELSE 'trial'::portal_account_status END
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

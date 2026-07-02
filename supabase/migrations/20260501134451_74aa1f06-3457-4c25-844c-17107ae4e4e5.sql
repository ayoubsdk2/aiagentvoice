-- =========================================================================
-- PHASE 1: Clean tenant schema for the Client Portal
-- =========================================================================

-- Member roles inside an organization
DO $$ BEGIN
  CREATE TYPE public.org_member_role AS ENUM ('owner', 'admin', 'manager', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Telephony asset lifecycle
DO $$ BEGIN
  CREATE TYPE public.telephony_status AS ENUM ('pending_forward', 'active', 'paused', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- organizations
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  billing_email text,
  stripe_customer_id text,
  stripe_payment_method_verified boolean NOT NULL DEFAULT false,
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_step smallint NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- organization_branding (1:1 with organizations)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.organization_branding (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#a855f7',
  display_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organization_branding ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- organization_members
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_member_role NOT NULL DEFAULT 'viewer',
  invited_email text,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);

-- =========================================================================
-- Helper functions (SECURITY DEFINER, search_path locked)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members
   WHERE user_id = auth.uid()
   ORDER BY created_at ASC
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _roles public.org_member_role[], _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- =========================================================================
-- org_locations
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.org_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  state text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_locations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_org_locations_org ON public.org_locations(organization_id);

-- =========================================================================
-- telephony_assets (the gateway model)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.telephony_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.org_locations(id) ON DELETE SET NULL,
  business_origin_number text,
  ai_gateway_number text,
  vapi_assistant_id text,
  vapi_phone_number_id text,
  status public.telephony_status NOT NULL DEFAULT 'pending_forward',
  last_inbound_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telephony_assets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_telephony_org ON public.telephony_assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_telephony_gateway ON public.telephony_assets(ai_gateway_number);
CREATE INDEX IF NOT EXISTS idx_telephony_origin ON public.telephony_assets(business_origin_number);

-- =========================================================================
-- updated_at triggers
-- =========================================================================
DROP TRIGGER IF EXISTS trg_orgs_updated ON public.organizations;
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_branding_updated ON public.organization_branding;
CREATE TRIGGER trg_branding_updated BEFORE UPDATE ON public.organization_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_org_locations_updated ON public.org_locations;
CREATE TRIGGER trg_org_locations_updated BEFORE UPDATE ON public.org_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_telephony_updated ON public.telephony_assets;
CREATE TRIGGER trg_telephony_updated BEFORE UPDATE ON public.telephony_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- RLS policies
-- =========================================================================

-- organizations
DROP POLICY IF EXISTS "members read own org" ON public.organizations;
CREATE POLICY "members read own org" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id) OR public.is_internal_operator());

DROP POLICY IF EXISTS "owners update own org" ON public.organizations;
CREATE POLICY "owners update own org" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(id, ARRAY['owner','admin']::public.org_member_role[]) OR public.is_internal_operator())
  WITH CHECK (public.has_org_role(id, ARRAY['owner','admin']::public.org_member_role[]) OR public.is_internal_operator());

DROP POLICY IF EXISTS "auth users create org" ON public.organizations;
CREATE POLICY "auth users create org" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.is_internal_operator());

-- organization_branding
DROP POLICY IF EXISTS "members read branding" ON public.organization_branding;
CREATE POLICY "members read branding" ON public.organization_branding
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) OR public.is_internal_operator());

DROP POLICY IF EXISTS "owners write branding" ON public.organization_branding;
CREATE POLICY "owners write branding" ON public.organization_branding
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_member_role[]) OR public.is_internal_operator())
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_member_role[]) OR public.is_internal_operator());

-- organization_members
DROP POLICY IF EXISTS "members read membership" ON public.organization_members;
CREATE POLICY "members read membership" ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_member(organization_id)
    OR public.is_internal_operator()
  );

DROP POLICY IF EXISTS "owners manage membership" ON public.organization_members;
CREATE POLICY "owners manage membership" ON public.organization_members
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner']::public.org_member_role[]) OR public.is_internal_operator())
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner']::public.org_member_role[]) OR public.is_internal_operator());

DROP POLICY IF EXISTS "self insert first member" ON public.organization_members;
CREATE POLICY "self insert first member" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_internal_operator());

-- org_locations
DROP POLICY IF EXISTS "members read locations" ON public.org_locations;
CREATE POLICY "members read locations" ON public.org_locations
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) OR public.is_internal_operator());

DROP POLICY IF EXISTS "admins write locations" ON public.org_locations;
CREATE POLICY "admins write locations" ON public.org_locations
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_member_role[]) OR public.is_internal_operator())
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_member_role[]) OR public.is_internal_operator());

-- telephony_assets
DROP POLICY IF EXISTS "members read telephony" ON public.telephony_assets;
CREATE POLICY "members read telephony" ON public.telephony_assets
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id) OR public.is_internal_operator());

DROP POLICY IF EXISTS "admins write telephony" ON public.telephony_assets;
CREATE POLICY "admins write telephony" ON public.telephony_assets
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_member_role[]) OR public.is_internal_operator())
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_member_role[]) OR public.is_internal_operator());

-- =========================================================================
-- Storage bucket for org branding logos
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-branding', 'org-branding', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "org branding public read" ON storage.objects;
CREATE POLICY "org branding public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'org-branding');

DROP POLICY IF EXISTS "org branding owner upload" ON storage.objects;
CREATE POLICY "org branding owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-branding'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "org branding owner update" ON storage.objects;
CREATE POLICY "org branding owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-branding'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "org branding owner delete" ON storage.objects;
CREATE POLICY "org branding owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-branding'
    AND public.has_org_role(((storage.foldername(name))[1])::uuid, ARRAY['owner','admin']::public.org_member_role[])
  );

-- =========================================================================
-- Auto-bootstrap trigger: every new external user gets a personal stub org
-- so they show up as "owner" of an unfinished onboarding right away.
-- Internal operators are skipped.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.bootstrap_org_for_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _slug text;
  _base text;
  _i int := 0;
BEGIN
  -- Skip internal operators (Phaos staff)
  IF lower(NEW.email) IN ('daniel@phaosai.com','shree@phaosai.com','diego@phaosai.com') THEN
    RETURN NEW;
  END IF;

  -- Build a unique slug from the email local-part
  _base := regexp_replace(lower(split_part(NEW.email, '@', 1)), '[^a-z0-9]+', '-', 'g');
  IF _base = '' OR _base IS NULL THEN _base := 'org'; END IF;
  _slug := _base;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = _slug) LOOP
    _i := _i + 1;
    _slug := _base || '-' || _i;
  END LOOP;

  INSERT INTO public.organizations (slug, name, billing_email, created_by, onboarding_completed, onboarding_step)
  VALUES (_slug, initcap(replace(_base, '-', ' ')), NEW.email, NEW.id, false, 1)
  RETURNING id INTO _org_id;

  INSERT INTO public.organization_branding (organization_id) VALUES (_org_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
  VALUES (_org_id, NEW.id, 'owner', now())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bootstrap_org_after_signup ON auth.users;
CREATE TRIGGER bootstrap_org_after_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_org_for_new_user();

-- =========================================================================
-- Backfill: ensure every existing non-internal user has an org
-- =========================================================================
DO $$
DECLARE _u record; _org_id uuid; _slug text; _base text; _i int;
BEGIN
  FOR _u IN
    SELECT u.id, u.email FROM auth.users u
    WHERE lower(u.email) NOT IN ('daniel@phaosai.com','shree@phaosai.com','diego@phaosai.com')
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_members m WHERE m.user_id = u.id
      )
  LOOP
    _base := regexp_replace(lower(split_part(_u.email, '@', 1)), '[^a-z0-9]+', '-', 'g');
    IF _base = '' OR _base IS NULL THEN _base := 'org'; END IF;
    _slug := _base; _i := 0;
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = _slug) LOOP
      _i := _i + 1; _slug := _base || '-' || _i;
    END LOOP;

    INSERT INTO public.organizations (slug, name, billing_email, created_by, onboarding_completed, onboarding_step)
    VALUES (_slug, initcap(replace(_base, '-', ' ')), _u.email, _u.id, false, 1)
    RETURNING id INTO _org_id;

    INSERT INTO public.organization_branding (organization_id) VALUES (_org_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
    VALUES (_org_id, _u.id, 'owner', now())
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
-- ==========================================================================
-- Update signup trigger: join existing org by billing_email match
--
-- When provision-client creates an organizations row for a paid customer,
-- it sets billing_email = the customer's email. When that customer later
-- signs up via the web portal, this trigger now detects the existing org
-- and links them to it instead of creating a duplicate.
-- ==========================================================================

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

  -- ── Check if an organization already exists for this email ───────────
  -- This catches orgs pre-created by provision-client (iPad Calculator).
  -- Case-insensitive match on billing_email.
  SELECT id INTO _org_id
    FROM public.organizations
   WHERE lower(billing_email) = lower(NEW.email)
   LIMIT 1;

  IF _org_id IS NOT NULL THEN
    -- Org already exists (e.g. from provision-client). Link user as owner.
    INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
    VALUES (_org_id, NEW.id, 'owner', now())
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    RETURN NEW;
  END IF;

  -- ── No match — create a fresh org (original logic, unchanged) ───────
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

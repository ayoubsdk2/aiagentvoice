-- ==========================================================================
-- Step 6: Restore signup trigger (bootstrap_org_for_new_user)
--         This was previously set to a NO-OP in the dummy_functions migration.
--         We restore the original logic which correctly links new users to
--         the `organizations` and `organization_members` tables.
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

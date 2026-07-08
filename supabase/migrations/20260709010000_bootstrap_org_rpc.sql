-- RPC function to bootstrap an organization for a user who has none.
-- Runs as SECURITY DEFINER so it bypasses RLS (the user can't INSERT
-- into organizations or organization_members directly due to the
-- circular dependency in the RLS policies).

CREATE OR REPLACE FUNCTION public.bootstrap_my_organization()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _email text;
  _org_id uuid;
  _existing uuid;
BEGIN
  -- Get current user
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has an org
  SELECT organization_id INTO _existing
    FROM public.organization_members
   WHERE user_id = _uid
   ORDER BY created_at ASC
   LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  -- Get email for billing_email default
  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  -- Create the organization
  _org_id := gen_random_uuid();
  INSERT INTO public.organizations (id, slug, name, created_by, billing_email, onboarding_completed, onboarding_step)
  VALUES (_org_id, 'org-' || extract(epoch FROM now())::bigint, 'My Organization', _uid, _email, false, 1);

  -- Add user as owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_org_id, _uid, 'owner');

  RETURN _org_id;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.bootstrap_my_organization() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_my_organization() TO authenticated;

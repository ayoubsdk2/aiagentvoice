-- Restore real implementations of the RLS helper functions that were
-- accidentally overwritten by the dummy_functions migration.

-- is_org_member: checks if user belongs to the given org
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

-- has_org_role: checks if user has one of the given roles in the org
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

-- current_org_id: returns the user's primary organization
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

-- is_internal_operator: checks if user is a Phaos admin
CREATE OR REPLACE FUNCTION public.is_internal_operator(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'phaos_admin'::public.app_role); $$;

-- Re-grant execute to authenticated (was revoked by earlier migration)
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.org_member_role[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_operator(uuid) TO authenticated;


-- 1) Prevent role-escalation on organization_members self-insert.
DROP POLICY IF EXISTS "self insert first member" ON public.organization_members;
CREATE POLICY "self insert as viewer"
  ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_internal_operator()
    OR public.has_org_role(organization_id, ARRAY['owner'::public.org_member_role])
    OR (user_id = auth.uid() AND role = 'viewer'::public.org_member_role)
  );

-- 2) Revoke EXECUTE on SECURITY DEFINER helper from end-user roles.
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_active_tools(uuid, text, jsonb) FROM PUBLIC'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_active_tools(uuid, text, jsonb) FROM anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_active_tools(uuid, text, jsonb) FROM authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
GRANT EXECUTE ON FUNCTION public.set_active_tools(uuid, text, jsonb) TO service_role;

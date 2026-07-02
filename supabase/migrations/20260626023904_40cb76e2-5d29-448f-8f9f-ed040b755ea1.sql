DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Re-grant the minimum set actually invoked via PostgREST RPC from the client.
GRANT EXECUTE ON FUNCTION public.get_public_sandbox(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_live_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_account_mode(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_live_access_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_operator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_integration_statuses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_compliance_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_compliance_evidence_status(uuid) TO authenticated;
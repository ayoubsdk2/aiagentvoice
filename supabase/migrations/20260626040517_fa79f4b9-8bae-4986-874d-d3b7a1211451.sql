-- Emergency recovery: allow public safe wrappers to call their private implementations.
-- The internal schema is still not exposed through the Data API, and only the
-- narrow implementation functions below have execute permissions for app roles.

GRANT USAGE ON SCHEMA internal TO anon, authenticated;

GRANT EXECUTE ON FUNCTION internal.get_public_sandbox_impl(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_sandbox(text) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION internal.get_my_live_account_impl() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_live_account() TO authenticated;

GRANT EXECUTE ON FUNCTION internal.list_integration_statuses_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_integration_statuses(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION internal.redeem_live_access_code_impl(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_live_access_code(text) TO authenticated;

GRANT EXECUTE ON FUNCTION internal.set_account_mode_impl(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_account_mode(text) TO authenticated;

GRANT EXECUTE ON FUNCTION internal.tenant_compliance_evidence_status_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_compliance_evidence_status(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION internal.tenant_compliance_summary_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_compliance_summary(uuid) TO authenticated;
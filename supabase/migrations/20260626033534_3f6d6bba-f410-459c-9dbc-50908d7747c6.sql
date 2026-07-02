
-- 1) Lock down Stripe/payment-card columns on organizations from PostgREST roles
REVOKE SELECT (stripe_customer_id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year) ON public.organizations FROM authenticated;
REVOKE SELECT (stripe_customer_id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year) ON public.organizations FROM anon;

-- 2) Convert lightweight role helpers from SECURITY DEFINER to SECURITY INVOKER.
-- user_roles already has an RLS policy ("users read own roles") permitting self reads,
-- so these no longer require elevated execution.
ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.is_internal_operator(uuid) SECURITY INVOKER;

-- 3) Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions that are
-- only invoked from server-side edge functions (service_role) or other DEFINER fns.
REVOKE EXECUTE ON FUNCTION public.tenant_of(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_call_usage(uuid, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_ai_tokens(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dsar_export_subject(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dsar_redact_subject(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.data_retention_sweep_report() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_consent_change(uuid, public.consent_channel, public.consent_status, text, text, public.consent_source, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ai_action(uuid, text, text, text, text, uuid, uuid, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_org_billing_card(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_user_activity_summary() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_user_activity_summary(uuid) FROM PUBLIC, anon, authenticated;

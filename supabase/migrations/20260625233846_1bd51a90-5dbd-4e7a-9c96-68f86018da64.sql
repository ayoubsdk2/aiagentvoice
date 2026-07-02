
-- 1. organizations: revoke column-level SELECT on Stripe card details
REVOKE SELECT (stripe_customer_id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year)
  ON public.organizations FROM anon, authenticated;

-- 2. live_accounts: replace any tenant-wide read with admin-only,
--    and create a safe view for non-admin tenant users (omitting access_code_hash, system_prompt, notification/contact emails).
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = 'public.live_accounts'::regclass AND polcmd = 'r' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.live_accounts', pol.polname);
  END LOOP;
END$$;

CREATE POLICY "phaos admins read live_accounts"
  ON public.live_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

-- Tenant users keep limited read via the existing get_my_live_account() RPC (already filters columns)
-- so no broad tenant SELECT policy is needed.

-- 3. admin_password_override: ensure RLS denies all non-service-role access
ALTER TABLE public.admin_password_override ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = 'public.admin_password_override'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_password_override', pol.polname);
  END LOOP;
END$$;
CREATE POLICY "deny all non-service-role"
  ON public.admin_password_override FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
REVOKE ALL ON public.admin_password_override FROM anon, authenticated;
GRANT ALL ON public.admin_password_override TO service_role;

-- 4. realtime: drop the permissive subscription policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='realtime' AND c.relname='messages'
      AND p.polname='authenticated only realtime channels'
  ) THEN
    EXECUTE 'DROP POLICY "authenticated only realtime channels" ON realtime.messages';
  END IF;
END$$;

-- 5. Revoke EXECUTE on all SECURITY DEFINER functions in public from PUBLIC/anon/authenticated,
--    then re-grant ONLY to the allowlist of RPCs the app legitimately calls from the browser.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   fn.proname, fn.args);
  END LOOP;
END$$;

-- Re-grant the allowlist
DO $$
DECLARE
  rpc text;
  rpcs text[] := ARRAY[
    'get_public_sandbox',
    'redeem_live_access_code',
    'set_account_mode',
    'get_my_live_account',
    'list_integration_statuses',
    'get_org_billing_card',
    'log_audit_event',
    'log_ai_action',
    'check_consent',
    'record_consent_change',
    'dsar_export_subject',
    'tenant_compliance_summary',
    'tenant_compliance_evidence_status',
    'admin_user_activity_summary',
    'consume_ai_tokens',
    'outbound_allowed',
    'is_outbound_paused',
    'record_call_usage',
    'has_role',
    'has_org_role',
    'is_org_member',
    'is_internal_operator',
    'tenant_of',
    'current_org_id',
    'portal_is_org_member',
    'portal_has_org_role',
    'portal_can_view_location',
    'is_email'
  ];
  fn record;
BEGIN
  FOREACH rpc IN ARRAY rpcs LOOP
    FOR fn IN
      SELECT pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname = rpc
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', rpc, fn.args);
      IF rpc = 'get_public_sandbox' THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon', rpc, fn.args);
      END IF;
    END LOOP;
  END LOOP;
END$$;

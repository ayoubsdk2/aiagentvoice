
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'phaos_admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN ('daniel@phaosai.com','shree@phaosai.com','diego@phaosai.com')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_internal_operator(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'phaos_admin'::public.app_role); $$;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) IN ('daniel@phaosai.com','shree@phaosai.com','diego@phaosai.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'phaos_admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP POLICY IF EXISTS "anyone reads active sandbox instances" ON public.sandbox_instances;
CREATE POLICY "authenticated reads active sandbox instances"
  ON public.sandbox_instances FOR SELECT TO authenticated USING (is_active = true);
REVOKE SELECT ON public.sandbox_instances FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_sandbox(p_slug text)
RETURNS TABLE(slug text, company_name text, vapi_assistant_id text, vapi_public_key text, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.slug, s.company_name, s.vapi_assistant_id, s.vapi_public_key, s.is_active
  FROM public.sandbox_instances s WHERE s.slug = p_slug AND s.is_active = true LIMIT 1;
$$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_public_sandbox(text) FROM PUBLIC'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
GRANT EXECUTE ON FUNCTION public.get_public_sandbox(text) TO anon, authenticated;

DROP POLICY IF EXISTS "phaos admin reads email send log" ON public.email_send_log;
CREATE POLICY "phaos admin reads email send log"
  ON public.email_send_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

DROP POLICY IF EXISTS "Service role full access leads" ON public.leads;
DROP POLICY IF EXISTS "Service role full access service_tickets" ON public.service_tickets;

DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit contact form"
  ON public.contact_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 200
    AND email IS NOT NULL AND length(email) BETWEEN 3 AND 320
    AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND reason IS NOT NULL AND length(btrim(reason)) BETWEEN 1 AND 5000
    AND (phone IS NULL OR length(phone) <= 50)
  );

DROP POLICY IF EXISTS "org branding public read" ON storage.objects;

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.portal_handle_new_user() FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.bootstrap_org_for_new_user() FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.audit_profile_sensitive() FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.audit_sensitive_change() FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.sync_kill_switch_for_risk() FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.portal_set_updated_at() FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.portal_prevent_audit_mutation() FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.prevent_audit_mutation() FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.data_retention_sweep_report() FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.dsar_redact_subject(uuid, text, text) FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.record_call_usage(uuid, text, integer, jsonb) FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.consume_ai_tokens(uuid, bigint) FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.admin_user_activity_summary() FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.admin_user_activity_summary(uuid) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb, uuid) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_ai_action(uuid, text, text, text, text, uuid, uuid, text, text, text, jsonb, text) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.dsar_export_subject(uuid, text, text) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.record_consent_change(uuid, consent_channel, consent_status, text, text, consent_source, text, text) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.tenant_compliance_summary(uuid) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.tenant_compliance_evidence_status(uuid) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.list_integration_statuses(uuid) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_account_mode(text) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.redeem_live_access_code(text) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_my_live_account() FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_org_billing_card(uuid) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, org_member_role[], uuid) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_internal_operator(uuid) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.portal_is_org_member(uuid, uuid) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.portal_has_org_role(uuid, uuid, portal_membership_role) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.portal_can_view_location(uuid, uuid) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.tenant_of(uuid) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.check_consent(uuid, consent_channel, text, text) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.outbound_allowed(uuid, consent_channel) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_outbound_paused(uuid, consent_channel) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_email(text) FROM PUBLIC, anon'; EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $outer$
BEGIN
  EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_object THEN NULL;
END $outer$;

DO $outer$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "authenticated only realtime channels" ON realtime.messages';
  EXECUTE 'CREATE POLICY "authenticated only realtime channels" ON realtime.messages FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)';
EXCEPTION WHEN insufficient_privilege OR undefined_table OR undefined_object THEN NULL;
END $outer$;

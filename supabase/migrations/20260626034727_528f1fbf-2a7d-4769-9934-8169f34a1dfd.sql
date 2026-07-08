
-- Create a private schema not exposed via the Data API
CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA internal TO postgres, service_role;

-- ============================================================
-- 1) get_my_live_account
-- ============================================================
CREATE OR REPLACE FUNCTION internal.get_my_live_account_impl()
RETURNS TABLE(customer_id uuid, display_name text, is_active boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT last_live_customer_id INTO _cid FROM public.profiles WHERE id = auth.uid();
  IF _cid IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT la.customer_id, la.display_name, la.is_active
    FROM public.live_accounts la
    WHERE la.customer_id = _cid
    ORDER BY la.updated_at DESC LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION internal.get_my_live_account_impl() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.get_my_live_account_impl() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_live_account()
RETURNS TABLE(customer_id uuid, display_name text, is_active boolean)
LANGUAGE sql SECURITY INVOKER STABLE SET search_path = public AS $$
  SELECT * FROM internal.get_my_live_account_impl();
$$;

-- ============================================================
-- 2) get_public_sandbox(p_slug text)
-- ============================================================
CREATE OR REPLACE FUNCTION internal.get_public_sandbox_impl(p_slug text)
RETURNS TABLE(slug text, company_name text, vapi_assistant_id text, vapi_public_key text, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.slug, s.company_name, s.vapi_assistant_id, s.vapi_public_key, s.is_active
  FROM public.sandbox_instances s WHERE s.slug = p_slug AND s.is_active = true LIMIT 1;
$$;
REVOKE ALL ON FUNCTION internal.get_public_sandbox_impl(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.get_public_sandbox_impl(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_sandbox(p_slug text)
RETURNS TABLE(slug text, company_name text, vapi_assistant_id text, vapi_public_key text, is_active boolean)
LANGUAGE sql SECURITY INVOKER STABLE SET search_path = public AS $$
  SELECT * FROM internal.get_public_sandbox_impl(p_slug);
$$;

-- ============================================================
-- 3) list_integration_statuses(_customer_id uuid)
-- ============================================================
CREATE OR REPLACE FUNCTION internal.list_integration_statuses_impl(_customer_id uuid)
RETURNS TABLE(integration_id text, status text, last_tested_at timestamptz, last_test_outcome text, last_test_error text, field_hints jsonb, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ic.integration_id, ic.status, ic.last_tested_at, ic.last_test_outcome,
         ic.last_test_error, ic.field_hints, ic.updated_at
  FROM public.integration_credentials ic
  WHERE ic.customer_id = _customer_id
    AND (
      public.has_role(auth.uid(), 'phaos_admin'::public.app_role)
      OR (ic.customer_id = public.tenant_of(auth.uid())
          AND public.has_role(auth.uid(), 'customer_admin'::public.app_role))
    );
$$;
REVOKE ALL ON FUNCTION internal.list_integration_statuses_impl(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.list_integration_statuses_impl(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_integration_statuses(_customer_id uuid)
RETURNS TABLE(integration_id text, status text, last_tested_at timestamptz, last_test_outcome text, last_test_error text, field_hints jsonb, updated_at timestamptz)
LANGUAGE sql SECURITY INVOKER STABLE SET search_path = public AS $$
  SELECT * FROM internal.list_integration_statuses_impl(_customer_id);
$$;

-- ============================================================
-- 4) redeem_live_access_code(_code text)
-- ============================================================
CREATE OR REPLACE FUNCTION internal.redeem_live_access_code_impl(_code text)
RETURNS TABLE(customer_id uuid, display_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.live_accounts%ROWTYPE; _hash text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _code IS NULL OR char_length(_code) < 5 THEN RETURN; END IF;
  _hash := encode(extensions.digest(_code, 'sha256'), 'hex');
  SELECT * INTO _row FROM public.live_accounts WHERE access_code_hash = _hash AND is_active = true LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.profiles
    SET last_mode = 'live', last_live_customer_id = _row.customer_id, updated_at = now()
    WHERE id = auth.uid();
  customer_id := _row.customer_id; display_name := _row.display_name; RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION internal.redeem_live_access_code_impl(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.redeem_live_access_code_impl(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_live_access_code(_code text)
RETURNS TABLE(customer_id uuid, display_name text)
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM internal.redeem_live_access_code_impl(_code);
$$;

-- ============================================================
-- 5) set_account_mode(_mode text)
-- ============================================================
CREATE OR REPLACE FUNCTION internal.set_account_mode_impl(_mode text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _mode NOT IN ('prototype','live') THEN RAISE EXCEPTION 'invalid mode'; END IF;
  UPDATE public.profiles SET last_mode = _mode, updated_at = now() WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION internal.set_account_mode_impl(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.set_account_mode_impl(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_account_mode(_mode text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT internal.set_account_mode_impl(_mode);
$$;

-- ============================================================
-- 6) tenant_compliance_evidence_status(_customer_id uuid)
-- ============================================================
CREATE OR REPLACE FUNCTION internal.tenant_compliance_evidence_status_impl(_customer_id uuid)
RETURNS TABLE(agreement_type text, status text, signed_at timestamptz, expires_at timestamptz, is_complete boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT la.agreement_type, la.status, la.signed_at, la.expires_at,
    (la.status = 'active' AND la.signed_at IS NOT NULL AND (la.expires_at IS NULL OR la.expires_at > now())) AS is_complete
  FROM public.legal_agreements la
  WHERE la.customer_id = _customer_id
    AND (
      public.has_role(auth.uid(), 'phaos_admin'::public.app_role)
      OR _customer_id = public.tenant_of(auth.uid())
      OR public.is_org_member(_customer_id, auth.uid())
    )
  ORDER BY la.agreement_type;
$$;
REVOKE ALL ON FUNCTION internal.tenant_compliance_evidence_status_impl(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.tenant_compliance_evidence_status_impl(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tenant_compliance_evidence_status(_customer_id uuid)
RETURNS TABLE(agreement_type text, status text, signed_at timestamptz, expires_at timestamptz, is_complete boolean)
LANGUAGE sql SECURITY INVOKER STABLE SET search_path = public AS $$
  SELECT * FROM internal.tenant_compliance_evidence_status_impl(_customer_id);
$$;

-- ============================================================
-- 7) tenant_compliance_summary(_customer_id uuid)
-- ============================================================
CREATE OR REPLACE FUNCTION internal.tenant_compliance_summary_impl(_customer_id uuid)
RETURNS TABLE(regulation_code text, regulation_name text, legal_agreement_status text, annex_generated boolean, controls_mapped integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.code, r.name,
    COALESCE((SELECT la.status FROM public.legal_agreements la
      WHERE la.customer_id = _customer_id AND la.agreement_type = r.code
      ORDER BY la.created_at DESC LIMIT 1), 'none') AS legal_agreement_status,
    EXISTS (SELECT 1 FROM public.customer_compliance_annexes a
      WHERE a.customer_id = _customer_id AND r.code = ANY(a.in_scope_regulations)) AS annex_generated,
    (SELECT count(*)::int FROM public.control_mappings cm WHERE cm.regulation_code = r.code) AS controls_mapped
  FROM public.regulation_registry r
  WHERE (
    public.has_role(auth.uid(), 'phaos_admin'::public.app_role)
    OR _customer_id = public.tenant_of(auth.uid())
    OR public.is_org_member(_customer_id, auth.uid())
  )
  ORDER BY r.code;
$$;
REVOKE ALL ON FUNCTION internal.tenant_compliance_summary_impl(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.tenant_compliance_summary_impl(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tenant_compliance_summary(_customer_id uuid)
RETURNS TABLE(regulation_code text, regulation_name text, legal_agreement_status text, annex_generated boolean, controls_mapped integer)
LANGUAGE sql SECURITY INVOKER STABLE SET search_path = public AS $$
  SELECT * FROM internal.tenant_compliance_summary_impl(_customer_id);
$$;

-- Re-grant on the public wrappers
GRANT EXECUTE ON FUNCTION public.get_my_live_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_sandbox(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_integration_statuses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_live_access_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_account_mode(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_compliance_evidence_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_compliance_summary(uuid) TO authenticated;

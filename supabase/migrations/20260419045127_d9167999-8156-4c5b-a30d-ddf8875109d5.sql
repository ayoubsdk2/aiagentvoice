-- ─── WS3.3: Hash live_accounts.access_code ─────────────────────────
ALTER TABLE public.live_accounts
  ADD COLUMN IF NOT EXISTS access_code_hash text;

-- Backfill: SHA-256 of existing plaintext codes
UPDATE public.live_accounts
SET access_code_hash = encode(digest(access_code, 'sha256'), 'hex')
WHERE access_code_hash IS NULL;

ALTER TABLE public.live_accounts
  ALTER COLUMN access_code_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS live_accounts_access_code_hash_idx
  ON public.live_accounts (access_code_hash);

-- Rewrite redeem RPC to compare hashes
CREATE OR REPLACE FUNCTION public.redeem_live_access_code(_code text)
RETURNS TABLE(customer_id uuid, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.live_accounts%ROWTYPE;
  _hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF _code IS NULL OR char_length(_code) < 5 THEN
    RETURN;
  END IF;

  _hash := encode(digest(_code, 'sha256'), 'hex');

  SELECT * INTO _row
  FROM public.live_accounts
  WHERE access_code_hash = _hash AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET last_mode = 'live',
      last_live_customer_id = _row.customer_id,
      updated_at = now()
  WHERE id = auth.uid();

  customer_id := _row.customer_id;
  display_name := _row.display_name;
  RETURN NEXT;
END;
$$;

-- Drop plaintext column LAST
ALTER TABLE public.live_accounts DROP COLUMN access_code;

-- ─── WS3.2: Audit triggers on sensitive tables ─────────────────────
CREATE OR REPLACE FUNCTION public.audit_sensitive_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cid uuid;
  _rid text;
BEGIN
  -- Resolve customer_id and resource id from row
  IF TG_OP = 'DELETE' THEN
    BEGIN _cid := OLD.customer_id; EXCEPTION WHEN undefined_column THEN _cid := NULL; END;
    _rid := OLD.id::text;
  ELSE
    BEGIN _cid := NEW.customer_id; EXCEPTION WHEN undefined_column THEN _cid := NULL; END;
    _rid := NEW.id::text;
  END IF;

  INSERT INTO public.audit_events (
    customer_id, actor_user_id, actor_type, action, resource_type, resource_id, metadata
  ) VALUES (
    _cid, auth.uid(), 'user',
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME, _rid,
    jsonb_build_object('op', TG_OP, 'at', now())
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_live_accounts ON public.live_accounts;
CREATE TRIGGER audit_live_accounts
AFTER INSERT OR UPDATE OR DELETE ON public.live_accounts
FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

DROP TRIGGER IF EXISTS audit_compliance_settings ON public.compliance_settings;
CREATE TRIGGER audit_compliance_settings
AFTER INSERT OR UPDATE OR DELETE ON public.compliance_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

DROP TRIGGER IF EXISTS audit_kill_switches ON public.kill_switches;
CREATE TRIGGER audit_kill_switches
AFTER INSERT OR UPDATE OR DELETE ON public.kill_switches
FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

-- ─── WS4.3: Field-level audit on profiles (role/customer_id) ───────
CREATE OR REPLACE FUNCTION public.audit_profile_sensitive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.last_live_customer_id IS DISTINCT FROM OLD.last_live_customer_id THEN
    INSERT INTO public.audit_events (
      customer_id, actor_user_id, actor_type, action, resource_type, resource_id, metadata
    ) VALUES (
      NEW.customer_id, auth.uid(), 'user',
      'profile.tenant_change', 'profile', NEW.id::text,
      jsonb_build_object(
        'old_customer_id', OLD.customer_id,
        'new_customer_id', NEW.customer_id,
        'old_live_customer_id', OLD.last_live_customer_id,
        'new_live_customer_id', NEW.last_live_customer_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_profile_sensitive();

-- ─── WS3.1: Suspicious login activity view ─────────────────────────
CREATE OR REPLACE VIEW public.suspicious_login_activity
WITH (security_invoker = true) AS
SELECT
  date_trunc('minute', created_at) AS minute_bucket,
  ip_address,
  count(*) AS failed_attempts,
  count(DISTINCT user_id) AS distinct_users,
  max(created_at) AS last_attempt_at
FROM public.user_activity_sessions
WHERE event_type = 'login_failed'
  AND created_at > now() - interval '24 hours'
GROUP BY 1, 2
HAVING count(*) >= 5;

REVOKE ALL ON public.suspicious_login_activity FROM PUBLIC;
GRANT SELECT ON public.suspicious_login_activity TO authenticated;

-- ─── WS6: system_health_checks table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  status text NOT NULL CHECK (status IN ('up','degraded','down')),
  latency_ms integer,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS system_health_checks_component_checked_idx
  ON public.system_health_checks (component, checked_at DESC);

ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all authenticated read health"
ON public.system_health_checks FOR SELECT TO authenticated
USING (true);

CREATE POLICY "phaos admin manages health"
ON public.system_health_checks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'phaos_admin'))
WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'));

-- ─── WS4.1/4.2: DSAR RPCs (admin or tenant manager) ────────────────
CREATE OR REPLACE FUNCTION public.dsar_export_subject(
  _customer_id uuid, _email text DEFAULT NULL, _phone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _result jsonb;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'phaos_admin')
    OR (_customer_id = public.tenant_of(auth.uid())
        AND public.has_role(auth.uid(), 'customer_admin'))
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  _result := jsonb_build_object(
    'subject', jsonb_build_object('email', _email, 'phone', _phone),
    'customer_id', _customer_id,
    'exported_at', now(),
    'consent_records', COALESCE((
      SELECT jsonb_agg(to_jsonb(c)) FROM public.consent_records c
      WHERE c.customer_id = _customer_id
        AND ((_email IS NOT NULL AND c.contact_email = _email)
          OR (_phone IS NOT NULL AND c.contact_phone = _phone))
    ), '[]'::jsonb),
    'leads', COALESCE((
      SELECT jsonb_agg(to_jsonb(l)) FROM public.leads l
      WHERE l.customer_id = _customer_id
        AND ((_email IS NOT NULL AND l.customer_email = _email)
          OR (_phone IS NOT NULL AND l.customer_phone = _phone))
    ), '[]'::jsonb),
    'calls', COALESCE((
      SELECT jsonb_agg(to_jsonb(ca)) FROM public.calls ca
      WHERE ca.customer_id = _customer_id
        AND (_phone IS NOT NULL AND ca.customer_phone = _phone)
    ), '[]'::jsonb),
    'orchestrator_leads', COALESCE((
      SELECT jsonb_agg(to_jsonb(o)) FROM public.orchestrator_leads o
      WHERE o.customer_id = _customer_id
        AND ((_email IS NOT NULL AND o.email = _email)
          OR (_phone IS NOT NULL AND o.phone = _phone))
    ), '[]'::jsonb)
  );

  PERFORM public.log_audit_event(
    'dsar.export', 'dsar', NULL,
    jsonb_build_object('email', _email, 'phone', _phone),
    _customer_id
  );
  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.dsar_redact_subject(
  _customer_id uuid, _email text DEFAULT NULL, _phone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _redacted_count int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'phaos_admin') THEN
    RAISE EXCEPTION 'phaos_admin required for redaction';
  END IF;

  UPDATE public.leads
  SET customer_email = NULL, customer_phone = NULL,
      customer_name = '[REDACTED]', raw_excerpt = '[REDACTED]'
  WHERE customer_id = _customer_id
    AND ((_email IS NOT NULL AND customer_email = _email)
      OR (_phone IS NOT NULL AND customer_phone = _phone));
  GET DIAGNOSTICS _redacted_count = ROW_COUNT;

  UPDATE public.calls
  SET customer_phone = NULL, caller_name = '[REDACTED]',
      transcript_url = NULL, recording_url = NULL
  WHERE customer_id = _customer_id
    AND _phone IS NOT NULL AND customer_phone = _phone;

  UPDATE public.orchestrator_leads
  SET email = NULL, phone = NULL, contact_name = '[REDACTED]'
  WHERE customer_id = _customer_id
    AND ((_email IS NOT NULL AND email = _email)
      OR (_phone IS NOT NULL AND phone = _phone));

  PERFORM public.log_audit_event(
    'dsar.redact', 'dsar', NULL,
    jsonb_build_object('email', _email, 'phone', _phone, 'rows_redacted_leads', _redacted_count),
    _customer_id
  );
  RETURN jsonb_build_object('ok', true, 'leads_redacted', _redacted_count);
END;
$$;

-- ─── WS4.4: Retention sweep (DRY-RUN MODE) ─────────────────────────
CREATE OR REPLACE FUNCTION public.data_retention_sweep_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _report jsonb := '[]'::jsonb;
  _row record;
  _cutoff timestamptz;
  _count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'phaos_admin') THEN
    RAISE EXCEPTION 'phaos_admin required';
  END IF;

  FOR _row IN SELECT customer_id, data_retention_hours FROM public.compliance_settings LOOP
    _cutoff := now() - make_interval(hours => _row.data_retention_hours);

    SELECT count(*) INTO _count FROM public.audit_events
    WHERE customer_id = _row.customer_id AND created_at < _cutoff;
    _report := _report || jsonb_build_object(
      'customer_id', _row.customer_id, 'table', 'audit_events',
      'cutoff', _cutoff, 'would_delete', _count, 'mode', 'dry_run'
    );

    SELECT count(*) INTO _count FROM public.ai_actions
    WHERE customer_id = _row.customer_id AND created_at < _cutoff;
    _report := _report || jsonb_build_object(
      'customer_id', _row.customer_id, 'table', 'ai_actions',
      'cutoff', _cutoff, 'would_delete', _count, 'mode', 'dry_run'
    );
  END LOOP;

  PERFORM public.log_audit_event(
    'retention.dry_run', 'retention', NULL,
    jsonb_build_object('report', _report), NULL
  );
  RETURN _report;
END;
$$;

-- ─── WS9.3: Custom KPI dashboard support ───────────────────────────
CREATE TABLE IF NOT EXISTS public.kpi_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  display_label text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, metric_key)
);

ALTER TABLE public.kpi_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own kpi pins"
ON public.kpi_pins FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix admin_user_activity_summary so it works when called from an edge function
-- using the service-role client (where auth.uid() is NULL). We pass the caller's
-- user id explicitly and gate on that, instead of relying on auth.uid().
--
-- Also: fall back to auth.users.last_sign_in_at when no user_activity_sessions
-- rows exist yet, so the admin dashboard shows real "Recent Login" data even
-- before we wire up custom session tracking.

CREATE OR REPLACE FUNCTION public.admin_user_activity_summary(_caller uuid DEFAULT auth.uid())
RETURNS TABLE(
  user_id uuid,
  email text,
  display_name text,
  role app_role,
  signed_up_at timestamptz,
  last_login_at timestamptz,
  login_success_count bigint,
  login_failed_count bigint,
  total_session_seconds bigint,
  sandbox_call_count bigint,
  sandbox_total_seconds bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    u.email::text AS email,
    p.display_name,
    (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = u.id LIMIT 1) AS role,
    u.created_at AS signed_up_at,
    COALESCE(
      (SELECT max(s.created_at) FROM public.user_activity_sessions s
         WHERE s.user_id = u.id AND s.event_type = 'login_success'),
      u.last_sign_in_at
    ) AS last_login_at,
    GREATEST(
      (SELECT count(*) FROM public.user_activity_sessions s
         WHERE s.user_id = u.id AND s.event_type = 'login_success'),
      CASE WHEN u.last_sign_in_at IS NOT NULL THEN 1 ELSE 0 END
    ) AS login_success_count,
    (SELECT count(*) FROM public.user_activity_sessions s
       WHERE s.user_id = u.id AND s.event_type = 'login_failed') AS login_failed_count,
    COALESCE((SELECT sum(duration_seconds) FROM public.user_activity_sessions s
       WHERE s.user_id = u.id AND s.event_type = 'session_end'), 0) AS total_session_seconds,
    (SELECT count(*) FROM public.sandbox_usage_events e
       WHERE e.user_id = u.id AND e.event_type = 'call_started') AS sandbox_call_count,
    COALESCE((SELECT sum(duration_seconds) FROM public.sandbox_usage_events e
       WHERE e.user_id = u.id AND e.event_type = 'call_ended'), 0) AS sandbox_total_seconds
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE public.has_role(_caller, 'phaos_admin'::app_role)
  ORDER BY u.created_at DESC;
$$;
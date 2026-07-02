
CREATE TABLE public.industry_invite_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id text NOT NULL,
  industry_name text NOT NULL,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_email text NOT NULL,
  sender_name text,
  recipients_to text[] NOT NULL DEFAULT '{}',
  recipients_cc text[] NOT NULL DEFAULT '{}',
  recipients_bcc text[] NOT NULL DEFAULT '{}',
  recipient_count integer NOT NULL DEFAULT 0,
  subject text NOT NULL,
  message text NOT NULL,
  link text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','failed')),
  error_message text,
  resend_id text,
  ip_address inet,
  user_agent text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_industry_invite_logs_created_at ON public.industry_invite_logs (created_at DESC);
CREATE INDEX idx_industry_invite_logs_industry_id ON public.industry_invite_logs (industry_id);
CREATE INDEX idx_industry_invite_logs_sender_user_id ON public.industry_invite_logs (sender_user_id);
CREATE INDEX idx_industry_invite_logs_ip_address ON public.industry_invite_logs (ip_address);

GRANT SELECT ON public.industry_invite_logs TO authenticated;
GRANT ALL ON public.industry_invite_logs TO service_role;

ALTER TABLE public.industry_invite_logs ENABLE ROW LEVEL SECURITY;

-- Only Phaos admins can read; inserts are performed by service_role via edge function.
CREATE POLICY "industry_invite_logs_admin_read"
ON public.industry_invite_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

-- Block any client write paths; service_role bypasses RLS for the edge-function inserts.
CREATE POLICY "industry_invite_logs_no_client_write"
ON public.industry_invite_logs
FOR INSERT
TO authenticated
WITH CHECK (false);

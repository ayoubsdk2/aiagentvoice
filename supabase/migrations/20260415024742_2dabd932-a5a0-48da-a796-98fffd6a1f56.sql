-- Drop overly permissive public SELECT policies
DROP POLICY IF EXISTS "Allow public read of leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public read of service tickets" ON public.service_tickets;

-- Replace with authenticated-only SELECT
CREATE POLICY "Authenticated read leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated read service_tickets"
  ON public.service_tickets FOR SELECT
  TO authenticated
  USING (true);

-- Also allow service_role full access (for edge functions inserting via service key)
CREATE POLICY "Service role full access leads"
  ON public.leads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access service_tickets"
  ON public.service_tickets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
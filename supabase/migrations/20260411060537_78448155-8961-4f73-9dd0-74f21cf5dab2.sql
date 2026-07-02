
-- Drop overly permissive INSERT/UPDATE policies on leads
DROP POLICY IF EXISTS "Allow public insert of leads" ON public.leads;
DROP POLICY IF EXISTS "Allow public update quote_status on leads" ON public.leads;

-- Recreate as authenticated-only
CREATE POLICY "Authenticated insert leads"
ON public.leads FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated update leads"
ON public.leads FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Drop overly permissive INSERT on service_tickets
DROP POLICY IF EXISTS "Allow service role insert" ON public.service_tickets;

CREATE POLICY "Authenticated insert service_tickets"
ON public.service_tickets FOR INSERT
TO authenticated
WITH CHECK (true);

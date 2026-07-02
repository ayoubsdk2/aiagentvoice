
ALTER TABLE public.leads ADD COLUMN lead_score integer NOT NULL DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN quote_status text NOT NULL DEFAULT 'none';

CREATE POLICY "Allow public update quote_status on leads"
ON public.leads
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id TEXT NOT NULL,
  customer_name TEXT DEFAULT 'Unknown',
  customer_phone TEXT,
  customer_email TEXT,
  print_specs JSONB DEFAULT '{}',
  raw_excerpt TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of leads"
ON public.leads
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public insert of leads"
ON public.leads
FOR INSERT
TO public
WITH CHECK (true);
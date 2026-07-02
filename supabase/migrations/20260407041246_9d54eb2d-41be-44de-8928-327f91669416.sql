CREATE TABLE public.service_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id TEXT NOT NULL,
  transcript TEXT,
  summary TEXT,
  machine_model TEXT DEFAULT 'Not identified',
  error_code TEXT DEFAULT 'None',
  resolution_status TEXT DEFAULT 'pending',
  duration_seconds INTEGER DEFAULT 0,
  ended_reason TEXT DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of service tickets"
ON public.service_tickets
FOR SELECT
USING (true);

CREATE POLICY "Allow service role insert"
ON public.service_tickets
FOR INSERT
WITH CHECK (true);
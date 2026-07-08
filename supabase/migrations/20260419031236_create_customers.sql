CREATE TABLE public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    primary_contact_email text,
    timezone text NOT NULL DEFAULT 'America/New_York',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS to be safe, even if specific policies are added later
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

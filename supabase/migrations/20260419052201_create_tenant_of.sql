CREATE OR REPLACE FUNCTION public.tenant_of(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT NULL::uuid;
$$;

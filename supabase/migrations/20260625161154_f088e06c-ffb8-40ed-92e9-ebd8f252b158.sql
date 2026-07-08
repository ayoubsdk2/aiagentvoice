DROP POLICY IF EXISTS "users update own profile (non-customer fields)" ON public.profiles;
CREATE POLICY "users update own profile (non-customer fields)" ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND NOT (customer_id IS DISTINCT FROM (SELECT p.customer_id FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (last_live_customer_id IS DISTINCT FROM (SELECT p.last_live_customer_id FROM public.profiles p WHERE p.id = auth.uid()))
);
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

DROP POLICY IF EXISTS "org branding owner upload" ON storage.objects;
DROP POLICY IF EXISTS "org branding owner update" ON storage.objects;

CREATE POLICY "org branding owner upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-branding'
  AND public.has_org_role(
    ((storage.foldername(name))[1])::uuid,
    ARRAY['owner'::public.org_member_role, 'admin'::public.org_member_role]
  )
);

CREATE POLICY "org branding owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'org-branding'
  AND public.has_org_role(
    ((storage.foldername(name))[1])::uuid,
    ARRAY['owner'::public.org_member_role, 'admin'::public.org_member_role]
  )
)
WITH CHECK (
  bucket_id = 'org-branding'
  AND public.has_org_role(
    ((storage.foldername(name))[1])::uuid,
    ARRAY['owner'::public.org_member_role, 'admin'::public.org_member_role]
  )
);

REVOKE SELECT (card_last4, card_brand, card_exp_month, card_exp_year, stripe_payment_method_id)
  ON public.organizations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_org_billing_card(_org_id uuid)
RETURNS TABLE (
  card_brand text,
  card_last4 text,
  card_exp_month integer,
  card_exp_year integer,
  stripe_payment_method_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.card_brand, o.card_last4, o.card_exp_month, o.card_exp_year, o.stripe_payment_method_id
  FROM public.organizations o
  WHERE o.id = _org_id
    AND (
      public.has_org_role(_org_id, ARRAY['owner'::public.org_member_role, 'admin'::public.org_member_role])
      OR public.is_internal_operator(auth.uid())
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_org_billing_card(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_org_billing_card(uuid) TO authenticated;
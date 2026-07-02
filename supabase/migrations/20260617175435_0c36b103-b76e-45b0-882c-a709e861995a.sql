
-- 1) Fix content-lab-images storage policies (replace hardcoded email with role check)
DROP POLICY IF EXISTS "daniel referrizer reads content-lab-images" ON storage.objects;
DROP POLICY IF EXISTS "daniel referrizer updates content-lab-images" ON storage.objects;
DROP POLICY IF EXISTS "daniel referrizer deletes content-lab-images" ON storage.objects;
DROP POLICY IF EXISTS "daniel referrizer uploads content-lab-images" ON storage.objects;

CREATE POLICY "phaos admin reads content-lab-images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'content-lab-images' AND public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "phaos admin uploads content-lab-images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'content-lab-images' AND public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "phaos admin updates content-lab-images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'content-lab-images' AND public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
WITH CHECK (bucket_id = 'content-lab-images' AND public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "phaos admin deletes content-lab-images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'content-lab-images' AND public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

-- 2) Lock down Stripe/card columns on organizations. RLS allows row reads to org members,
--    but column-level privilege revocation prevents PostgREST from selecting these columns.
--    Reads continue to work through the SECURITY DEFINER function public.get_org_billing_card,
--    which checks for owner/admin role.
REVOKE SELECT (
  stripe_customer_id,
  stripe_payment_method_id,
  stripe_payment_method_verified,
  card_brand,
  card_last4,
  card_exp_month,
  card_exp_year
) ON public.organizations FROM anon, authenticated;

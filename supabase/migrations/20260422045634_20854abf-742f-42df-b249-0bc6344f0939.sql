-- Replace email-restricted policies on brand_vault
DROP POLICY IF EXISTS "daniel referrizer full access brand_vault" ON public.brand_vault;
CREATE POLICY "content lab admin full access brand_vault"
ON public.brand_vault
FOR ALL
TO authenticated
USING (public.is_email('daniel@phaosai.com'))
WITH CHECK (public.is_email('daniel@phaosai.com'));

-- Replace email-restricted policies on content_queue
DROP POLICY IF EXISTS "daniel referrizer full access content_queue" ON public.content_queue;
CREATE POLICY "content lab admin full access content_queue"
ON public.content_queue
FOR ALL
TO authenticated
USING (public.is_email('daniel@phaosai.com'))
WITH CHECK (public.is_email('daniel@phaosai.com'));
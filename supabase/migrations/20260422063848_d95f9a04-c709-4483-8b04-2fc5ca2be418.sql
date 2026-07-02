-- Replace the single FOR ALL policy with explicit per-command policies on content_queue
DROP POLICY IF EXISTS "content_queue admin all" ON public.content_queue;

CREATE POLICY "content_queue admin select"
  ON public.content_queue FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "content_queue admin insert"
  ON public.content_queue FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "content_queue admin update"
  ON public.content_queue FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "content_queue admin delete"
  ON public.content_queue FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

-- Same treatment for brand_vault
DROP POLICY IF EXISTS "brand_vault admin all" ON public.brand_vault;

CREATE POLICY "brand_vault admin select"
  ON public.brand_vault FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "brand_vault admin insert"
  ON public.brand_vault FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "brand_vault admin update"
  ON public.brand_vault FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "brand_vault admin delete"
  ON public.brand_vault FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

-- Same treatment for content_lab_settings
DROP POLICY IF EXISTS "content_lab_settings admin all" ON public.content_lab_settings;

CREATE POLICY "content_lab_settings admin select"
  ON public.content_lab_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "content_lab_settings admin insert"
  ON public.content_lab_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "content_lab_settings admin update"
  ON public.content_lab_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

CREATE POLICY "content_lab_settings admin delete"
  ON public.content_lab_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));
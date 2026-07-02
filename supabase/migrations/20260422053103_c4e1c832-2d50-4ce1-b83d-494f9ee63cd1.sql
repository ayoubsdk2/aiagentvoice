-- Replace fragile is_email() policies with the proven has_role(_, 'phaos_admin') pattern
-- used elsewhere in the project. Daniel's account is auto-assigned phaos_admin via handle_new_user_role().

-- content_queue
DROP POLICY IF EXISTS "content lab admin full access content_queue" ON public.content_queue;
CREATE POLICY "content_queue admin all"
  ON public.content_queue
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

-- brand_vault
DROP POLICY IF EXISTS "content lab admin full access brand_vault" ON public.brand_vault;
CREATE POLICY "brand_vault admin all"
  ON public.brand_vault
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));

-- content_lab_settings
DROP POLICY IF EXISTS "content lab admin full access settings" ON public.content_lab_settings;
CREATE POLICY "content_lab_settings admin all"
  ON public.content_lab_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'phaos_admin'::public.app_role));
CREATE POLICY "Tenant customer_admins can view their action_router_config"
ON public.action_router_config
FOR SELECT
TO authenticated
USING (
  customer_id = public.tenant_of(auth.uid())
  AND public.has_role(auth.uid(), 'customer_admin'::public.app_role)
);
-- Allow the original requester to read their own DSAR request status.
-- Manager and admin policies remain in force; this only adds a self-scoped SELECT.
CREATE POLICY "user reads own dsar requests"
ON public.dsar_requests
FOR SELECT
TO authenticated
USING (requested_by = auth.uid());
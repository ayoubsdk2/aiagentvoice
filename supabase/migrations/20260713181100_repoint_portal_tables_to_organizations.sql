-- ==========================================================================
-- Step 4: Repoint portal_calls, portal_audit_events, portal_locations
--         FKs from portal_organizations → organizations
--         AND fix RLS policies to use working organization_members helpers
-- ==========================================================================

-- ── 1. portal_calls ──────────────────────────────────────────────────────

-- 1a. Swap FK
ALTER TABLE public.portal_calls
  DROP CONSTRAINT IF EXISTS portal_calls_org_id_fkey;

ALTER TABLE public.portal_calls
  ADD CONSTRAINT portal_calls_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.organizations(id)
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.portal_calls
  VALIDATE CONSTRAINT portal_calls_org_id_fkey;

-- 1b. Replace RLS policies
--   Old: portal_is_org_member(auth.uid(), org_id)  ← broken no-op
--   New: is_org_member(org_id)                      ← working, defaults user to auth.uid()
DROP POLICY IF EXISTS "members read calls" ON public.portal_calls;
CREATE POLICY "members read calls" ON public.portal_calls
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

-- "internal operator full calls" uses is_internal_operator() which is
-- already restored and working — leave it untouched.


-- ── 2. portal_audit_events ───────────────────────────────────────────────

-- 2a. Swap FK (note: ON DELETE SET NULL, not CASCADE)
ALTER TABLE public.portal_audit_events
  DROP CONSTRAINT IF EXISTS portal_audit_events_org_id_fkey;

ALTER TABLE public.portal_audit_events
  ADD CONSTRAINT portal_audit_events_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.organizations(id)
    ON DELETE SET NULL
    NOT VALID;

ALTER TABLE public.portal_audit_events
  VALIDATE CONSTRAINT portal_audit_events_org_id_fkey;

-- 2b. Replace RLS policies
DROP POLICY IF EXISTS "members read own audit" ON public.portal_audit_events;
CREATE POLICY "members read own audit" ON public.portal_audit_events
  FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_member(org_id));

-- "internal operator full audit" — already working, leave untouched.


-- ── 3. portal_locations ──────────────────────────────────────────────────

-- 3a. Swap FK
ALTER TABLE public.portal_locations
  DROP CONSTRAINT IF EXISTS portal_locations_org_id_fkey;

ALTER TABLE public.portal_locations
  ADD CONSTRAINT portal_locations_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.organizations(id)
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.portal_locations
  VALIDATE CONSTRAINT portal_locations_org_id_fkey;

-- 3b. Replace RLS policies
--   "members read locations": portal_is_org_member → is_org_member
DROP POLICY IF EXISTS "members read locations" ON public.portal_locations;
CREATE POLICY "members read locations" ON public.portal_locations
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

--   "admins insert locations": portal_has_org_role(uid, org, 'owner'/'admin')
--     → has_org_role(org, ARRAY['owner','admin'])
DROP POLICY IF EXISTS "admins insert locations" ON public.portal_locations;
CREATE POLICY "admins insert locations" ON public.portal_locations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_member_role[]));

--   "admins update locations"
DROP POLICY IF EXISTS "admins update locations" ON public.portal_locations;
CREATE POLICY "admins update locations" ON public.portal_locations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_member_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_member_role[]));

--   "admins delete locations"
DROP POLICY IF EXISTS "admins delete locations" ON public.portal_locations;
CREATE POLICY "admins delete locations" ON public.portal_locations
  FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner','admin']::public.org_member_role[]));

-- "internal operator full locations" — already working, leave untouched.

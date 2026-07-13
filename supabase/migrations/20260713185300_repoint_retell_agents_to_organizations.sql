-- ==========================================================================
-- Step 5: Repoint retell_agents from customers → organizations
--         Rename customer_id → org_id, update FK, UNIQUE, RLS, and
--         the set_active_tools RPC that references this column.
-- ==========================================================================

-- ── 1. Drop existing FK and UNIQUE constraint ────────────────────────────
ALTER TABLE public.retell_agents
  DROP CONSTRAINT IF EXISTS retell_agents_customer_id_fkey;

ALTER TABLE public.retell_agents
  DROP CONSTRAINT IF EXISTS retell_agents_customer_id_retell_agent_id_key;

-- ── 2. Rename column ─────────────────────────────────────────────────────
ALTER TABLE public.retell_agents
  RENAME COLUMN customer_id TO org_id;

-- ── 3. Add new FK → organizations(id) ───────────────────────────────────
ALTER TABLE public.retell_agents
  ADD CONSTRAINT retell_agents_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.organizations(id)
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.retell_agents
  VALIDATE CONSTRAINT retell_agents_org_id_fkey;

-- ── 4. Restore UNIQUE constraint with new column name ────────────────────
ALTER TABLE public.retell_agents
  ADD CONSTRAINT retell_agents_org_id_retell_agent_id_key
    UNIQUE (org_id, retell_agent_id);

-- ── 5. Replace RLS policy ────────────────────────────────────────────────
--   Old: customer_id = public.tenant_of(auth.uid()) OR has_role(…, 'phaos_admin')
--        (tenant_of is a no-op — broken)
--   New: is_org_member(org_id) OR has_role(…, 'phaos_admin')
DROP POLICY IF EXISTS "retell_agents_select_own_tenant" ON public.retell_agents;
CREATE POLICY "retell_agents_select_own_org" ON public.retell_agents
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id) OR public.has_role(auth.uid(), 'phaos_admin'));

-- ── 6. Update set_active_tools RPC ───────────────────────────────────────
--   This function references customer_id → now org_id
DROP FUNCTION IF EXISTS public.set_active_tools(uuid, text, jsonb);
CREATE OR REPLACE FUNCTION public.set_active_tools(
  _org_id uuid,
  _retell_agent_id text,
  _tools jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'phaos_admin')
       OR public.is_org_member(_org_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_org_id::text, 0));
  UPDATE public.retell_agents
     SET active_tools = COALESCE(_tools, '[]'::jsonb),
         updated_at = now()
   WHERE org_id = _org_id
     AND retell_agent_id = _retell_agent_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_active_tools(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_tools(uuid, text, jsonb) TO authenticated, service_role;


-- Phase 1: Retell-native refactor foundation

-- 1. pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. tenant_secrets (encrypted at rest by edge functions; columns hold ciphertext)
CREATE TABLE IF NOT EXISTS public.tenant_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  retell_api_key text,
  telnyx_api_key text,
  qstash_token text,
  qstash_signing_key text,
  firecrawl_api_key text,
  render_action_router_secret text,
  langfuse_public_key text,
  langfuse_secret_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tenant_secrets TO service_role;
ALTER TABLE public.tenant_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_secrets_deny_public" ON public.tenant_secrets
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 3. knowledge_chunks (pgvector-backed RAG store)
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  source_url text,
  chunk_hash text,
  text_chunk text NOT NULL,
  embedding vector(1536),
  tokens int,
  last_synced timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, chunk_hash)
);
GRANT SELECT ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_chunks_select_own_tenant" ON public.knowledge_chunks
  FOR SELECT TO authenticated
  USING (customer_id = public.tenant_of(auth.uid()) OR public.has_role(auth.uid(), 'phaos_admin'));

CREATE INDEX IF NOT EXISTS knowledge_chunks_customer_synced_idx
  ON public.knowledge_chunks (customer_id, last_synced DESC);
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON public.knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 4. provisioning_jobs (idempotent QStash work queue mirror)
CREATE TABLE IF NOT EXISTS public.provisioning_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  stripe_event_id text UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','rolled_back')),
  attempts int NOT NULL DEFAULT 0,
  last_error jsonb,
  created_resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.provisioning_jobs TO service_role;
ALTER TABLE public.provisioning_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provisioning_jobs_admin_select" ON public.provisioning_jobs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'phaos_admin'));

-- 5. retell_agents (per-tenant Retell agent binding)
CREATE TABLE IF NOT EXISTS public.retell_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  retell_agent_id text NOT NULL,
  retell_llm_id text,
  phone_e164 text,
  label text,
  is_primary boolean NOT NULL DEFAULT false,
  active_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, retell_agent_id)
);
GRANT SELECT ON public.retell_agents TO authenticated;
GRANT ALL ON public.retell_agents TO service_role;
ALTER TABLE public.retell_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "retell_agents_select_own_tenant" ON public.retell_agents
  FOR SELECT TO authenticated
  USING (customer_id = public.tenant_of(auth.uid()) OR public.has_role(auth.uid(), 'phaos_admin'));

-- 6. Add Retell columns alongside legacy Vapi columns (purge of Vapi columns
-- happens in a follow-up migration after backend swap is verified live).
ALTER TABLE public.sandbox_instances
  ADD COLUMN IF NOT EXISTS retell_agent_id text;
ALTER TABLE public.live_account_agents
  ADD COLUMN IF NOT EXISTS retell_agent_id text;
ALTER TABLE public.live_accounts
  ADD COLUMN IF NOT EXISTS retell_agent_id_primary text;

-- 7. set_active_tools RPC (atomic per-tenant tool config writer)
CREATE OR REPLACE FUNCTION public.set_active_tools(
  _customer_id uuid,
  _retell_agent_id text,
  _tools jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'phaos_admin')
       OR _customer_id = public.tenant_of(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_customer_id::text, 0));
  UPDATE public.retell_agents
     SET active_tools = COALESCE(_tools, '[]'::jsonb),
         updated_at = now()
   WHERE customer_id = _customer_id
     AND retell_agent_id = _retell_agent_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_active_tools(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_tools(uuid, text, jsonb) TO authenticated, service_role;

-- 8. match_knowledge RPC (semantic top-K for runtime context)
CREATE OR REPLACE FUNCTION public.match_knowledge(
  _customer_id uuid,
  _query_embedding vector(1536),
  _k int DEFAULT 5
) RETURNS TABLE (id uuid, text_chunk text, source_url text, similarity float)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, text_chunk, source_url,
         1 - (embedding <=> _query_embedding) AS similarity
    FROM public.knowledge_chunks
   WHERE customer_id = _customer_id
     AND embedding IS NOT NULL
   ORDER BY embedding <=> _query_embedding
   LIMIT GREATEST(_k, 1);
$$;
REVOKE ALL ON FUNCTION public.match_knowledge(uuid, vector, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_knowledge(uuid, vector, int) TO service_role;

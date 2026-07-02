
REVOKE EXECUTE ON FUNCTION public.set_active_tools(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_knowledge(uuid, vector, int) FROM PUBLIC, anon, authenticated;

-- Move pgvector out of public into a dedicated extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, service_role;
ALTER EXTENSION vector SET SCHEMA extensions;
-- Keep search_path predictable for callers
ALTER FUNCTION public.match_knowledge(uuid, extensions.vector, int) SET search_path = public, extensions;

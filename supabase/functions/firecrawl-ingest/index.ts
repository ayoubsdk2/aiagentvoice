// Firecrawl ingestion: scrape a URL, chunk the content, embed each chunk,
// and upsert into the per-tenant knowledge_chunks store.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { chunkText } from "../_shared/chunker.ts";
import { assertSafePublicUrl } from "../_shared/url-safety.ts";
import { embedTexts } from "../_shared/embeddings.ts";
import { createLogger } from "../_shared/secure-logger.ts";

const log = createLogger("firecrawl-ingest");

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const BodySchema = z.object({
  customer_id: z.string().uuid(),
  url: z.string().url(),
});

async function scrape(url: string): Promise<string> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) throw new Error("FIRECRAWL_API_KEY missing");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`firecrawl ${res.status}: ${body.slice(0, 300)}`);
  const json = JSON.parse(body);
  return json?.data?.markdown ?? json?.markdown ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  // Require a valid JWT and verify the caller belongs to customer_id.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userRes } = await userClient.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400 });
  }
  const { customer_id, url } = parsed.data;

  try {
    assertSafePublicUrl(url, "url");
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Tenant check: caller's tenant must match customer_id, OR caller is phaos_admin.
  const { data: tenantId } = await userClient.rpc("tenant_of", { _user_id: userId });
  const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: userId, _role: "phaos_admin" });
  if (tenantId !== customer_id && !isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const markdown = await scrape(url);
    const chunks = await chunkText(markdown, url);
    if (chunks.length === 0) {
      return new Response(JSON.stringify({ ok: true, chunks: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Embed in batches of 64 to stay under OpenAI request limits.
    const rows: any[] = [];
    for (let i = 0; i < chunks.length; i += 64) {
      const batch = chunks.slice(i, i + 64);
      const vectors = await embedTexts(batch.map((c) => c.text));
      batch.forEach((c, idx) => {
        rows.push({
          customer_id,
          source_url: url,
          chunk_hash: c.hash,
          text_chunk: c.text,
          embedding: vectors[idx] as any,
          tokens: c.tokens,
          last_synced: new Date().toISOString(),
        });
      });
    }
    const { error } = await admin
      .from("knowledge_chunks")
      .upsert(rows, { onConflict: "customer_id,chunk_hash" });
    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ ok: true, chunks: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log.error("ingest failed", { err: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

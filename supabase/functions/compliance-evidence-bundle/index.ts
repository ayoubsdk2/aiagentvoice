import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  // Caller's tenant (admin gets ?customer_id=...)
  const url = new URL(req.url);
  const requestedCid = url.searchParams.get("customer_id");

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userResp.user.id, _role: "phaos_admin" });
  let cid = requestedCid;
  if (!isAdmin) {
    const { data: tid } = await supabase.rpc("tenant_of", { _user_id: userResp.user.id });
    cid = tid as string | null;
  }
  if (!cid) {
    return new Response(JSON.stringify({ error: "No tenant resolved" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const [summary, evidence, agreements, annexes, subprocessors] = await Promise.all([
    supabase.rpc("tenant_compliance_summary", { _customer_id: cid }),
    supabase.rpc("tenant_compliance_evidence_status", { _customer_id: cid }),
    supabase.from("legal_agreements").select("*").eq("customer_id", cid),
    supabase.from("customer_compliance_annexes").select("*").eq("customer_id", cid),
    supabase.from("sub_processors").select("*"),
  ]);

  const bundle = {
    generated_at: new Date().toISOString(),
    customer_id: cid,
    summary: summary.data ?? [],
    evidence_status: evidence.data ?? [],
    legal_agreements: agreements.data ?? [],
    annexes: annexes.data ?? [],
    sub_processors: subprocessors.data ?? [],
  };

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Content-Disposition": `attachment; filename="compliance-evidence-${cid}.json"` },
  });
});

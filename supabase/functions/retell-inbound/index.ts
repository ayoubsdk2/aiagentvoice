// Retell inbound-call webhook.
//
// Retell POSTs { event: "call_inbound", call_inbound: { from_number, to_number,
// agent_id, ... } } when a call lands on any of our imported numbers. We MUST
// respond 2xx within 10s. We look up the line by to_number, then return
// override_agent_id (the shared base agent for that line) plus the per-tenant
// dynamic_variables persisted at provisioning time.
//
// If the number is not found or the account is inactive we still respond 200,
// but with an empty body so Retell rejects the call cleanly.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Public webhook — Retell doesn't send our JWT. No CORS needed (server->server).
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { /* respond 200 with empty */ }

  const event = String(payload.event ?? "");
  const call = (payload.call_inbound ?? {}) as Record<string, unknown>;
  const toNumber = String(call.to_number ?? "").trim();

  if (event !== "call_inbound" || !toNumber) {
    return new Response("{}", { headers: { "Content-Type": "application/json" } });
  }

  // Locate the line by E.164, then load its agent row + parent live_account.
  const { data: phoneRow } = await admin
    .from("live_account_phone_numbers")
    .select("id, customer_id, agent_id")
    .eq("e164", toNumber)
    .maybeSingle();

  if (!phoneRow?.agent_id) {
    return new Response("{}", { headers: { "Content-Type": "application/json" } });
  }

  const { data: agentRow } = await admin
    .from("live_account_agents")
    .select("base_agent_id, retell_agent_id, dynamic_vars, custom_instructions, is_primary, line_label")
    .eq("id", phoneRow.agent_id)
    .maybeSingle();

  const { data: liveAccount } = await admin
    .from("live_accounts")
    .select("display_name, is_active, transfer_number, supply_team_number, vip_greeting")
    .eq("customer_id", phoneRow.customer_id)
    .maybeSingle();

  if (!agentRow || !liveAccount || liveAccount.is_active === false) {
    return new Response("{}", { headers: { "Content-Type": "application/json" } });
  }

  const baseAgentId = agentRow.base_agent_id
    ?? agentRow.retell_agent_id
    ?? "agent_281c022afc5fd87515a3a7956a";

  // Merge the stored per-line dynamic_vars with any freshly-updated
  // account-level fields (transfer number, VIP greeting, supply team number).
  const stored = (agentRow.dynamic_vars ?? {}) as Record<string, string>;
  const merged: Record<string, string> = {
    ...stored,
    company_name: stored.company_name || liveAccount.display_name || "",
    custom_instructions: agentRow.custom_instructions ?? stored.custom_instructions ?? "",
    vip_greeting: liveAccount.vip_greeting ?? stored.vip_greeting ?? "",
    transfer_number: liveAccount.transfer_number ?? stored.transfer_number ?? "",
  };
  if (baseAgentId === "agent_33d6c5549eb8ed8203fd5b6537") {
    merged.supply_team_number = liveAccount.supply_team_number ?? stored.supply_team_number ?? "";
  }

  return new Response(JSON.stringify({
    call_inbound: {
      override_agent_id: baseAgentId,
      dynamic_variables: merged,
    },
  }), { headers: { "Content-Type": "application/json" } });
});

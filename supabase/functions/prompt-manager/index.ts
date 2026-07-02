/**
 * Prompt Manager Edge Function
 * Stores and retrieves the system prompt for the Phoebe voice agent.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function authenticateRequest(req: Request): Promise<{ userId: string; isAdmin: boolean } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  const userId = data.claims.sub as string;

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: isAdmin } = await service.rpc("has_role", {
    _user_id: userId,
    _role: "phaos_admin",
  });
  return { userId, isAdmin: Boolean(isAdmin) };
}

let systemPrompt = `You are Phoebe, a Technical Operations Architect at Smart Office Automation (SOA) — powered by the Phaos AI Core Engine. Your tone is razor-sharp, efficient, and authoritative.

YOUR IDENTITY:
- You are Phoebe. Never break character.
- You work for Smart Office Automation (SOA).
- You are powered by proprietary Phaos AI technology.
- Never mention any third-party AI providers, speech engines, or infrastructure vendors.

PHONETIC ENGINE — ZERO-ROBOTICS PRONUNCIATION:
- UNIVERSAL RULE: Never say "minus," "dash," or "hyphen" when reading model numbers.
- Group numbers naturally: "70" = "seventy", "65" = "sixty five", "3501" = "thirty five oh one", "4500" = "forty five hundred", "1200" = "twelve hundred".
- Spell out all letters individually: "MX" = "M X", "BP" = "B P".
- Examples:
  - MX-M353N → "M X M three fifty three N"
  - BP-70C65 → "B P seventy C sixty five"
  - BP-1200C → "B P twelve hundred C"
  - BP-50M26 → "B P fifty M twenty six"
  - 3501 → "thirty five oh one"
  - 4500 → "forty five hundred"
- Apply this pattern to ALL alphanumeric strings in conversation.

CAPABILITIES:
- Diagnose error codes and dispatch technicians via trigger_service_dispatch
- Check toner levels and trigger auto-replenishment via verify_toner_levels
- Collect and validate meter readings for billing via collect_meter_reading
- Answer questions about Sharp device specifications and compatibility
- Query E-Automate for service history, contract details, and device telemetry
- Query Sales Chain for pricing, availability, and supply chain data

INTEGRATION ROLEPLAY (E-Automate & Sales Chain):
- When the caller mentions service, toner, contracts, supplies, or parts:
  1. Say "One moment while I query E-Automate..." or "Let me pull that from Sales Chain..."
  2. Pause briefly (simulate a lookup)
  3. Provide a realistic, hypothetical data point (e.g., "I've pulled the telemetry; your cyan toner is at 14%", "Your service contract expires March 2027", "Last service call was 47 days ago for a paper jam in tray 3")

INDUSTRY TERMINOLOGY:
- Use "Substrate" instead of "paper type" when discussing media
- Use "GSM" (Grams per Square Meter) for substrate weight references
- Use "Click Rate" or "Cost per Click" for per-page pricing
- Use "Duty Cycle" for maximum monthly page capacity
- Use "PPM" for pages per minute
- Use "Toner Yield" for cartridge page estimates

SHARP MFP EXPERTISE:
- BP-70C Series: Advanced color MFPs with retractable keyboard, 10.1" touchscreen, Sharp OSA 5.5, up to 6300 sheet capacity, 300 GSM max substrate, finisher options include Inner Finisher, Staple/Stacker, Saddle Stitch
- MX Series: Production-class MFPs with 15.4" touchscreen (on 5071/6071), up to 6600 sheet capacity, Inserter options, Multi-fold Unit, Fiery Controller compatible
- Key differentiator: MX series offers larger touchscreens, more finisher options (including inserter), and higher standard paper capacity vs BP-70C

ASSET ID COLLECTION:
- When you need to identify a device, say: "Please provide the Asset ID number found on the silver Smart Office sticker on the front of the device."

RULES:
- Always confirm the device serial number or Asset ID before taking action
- If a customer is frustrated, acknowledge it before problem-solving
- Never fabricate error codes or technician information
- Escalate to a human agent if the issue is safety-related or involves physical damage
- Keep responses concise — you are razor-sharp and efficient`;

let toolConfig: Record<string, boolean> = {
  trigger_service_dispatch: true,
  verify_toner_levels: true,
  collect_meter_reading: true,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await authenticateRequest(req);
  if (!auth) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { action } = body;

    if ((action === "save_prompt" || action === "save_tool_config") && !auth.isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: phaos_admin required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "get_prompt":
        return new Response(
          JSON.stringify({ prompt: systemPrompt, tool_config: toolConfig }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "save_prompt": {
        const { prompt } = body;
        if (typeof prompt === "string" && prompt.trim().length > 0) {
          systemPrompt = prompt.trim();
        }
        return new Response(
          JSON.stringify({ success: true, prompt: systemPrompt }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "save_tool_config": {
        const { config } = body;
        if (config && typeof config === "object") {
          toolConfig = { ...toolConfig, ...config };
        }
        return new Response(
          JSON.stringify({ success: true, tool_config: toolConfig }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

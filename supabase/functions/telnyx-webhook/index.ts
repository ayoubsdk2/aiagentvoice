/**
 * Telnyx inbound webhook receiver.
 *
 * - Verifies Ed25519 signature using TELNYX_PUBLIC_KEY (per
 *   https://developers.telnyx.com/docs/api/v2/overview#webhook-signing)
 * - Persists every event to telnyx_call_events (append-only)
 * - On call.initiated: inserts a new row into `calls`. Inbound calls are
 *   routed to the Retell agent via the Telnyx ↔ Retell number binding set
 *   up during provisioning; no in-flight transfer is needed here.
 * - On call.hangup: closes the matching `calls` row with duration
 *
 * Public endpoint (no JWT) — signature is the only auth.
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyTelnyxSignature(
  body: string,
  signatureB64: string,
  timestampStr: string,
  publicKeyB64: string,
): Promise<boolean> {
  try {
    const ageSec = Math.abs(Date.now() / 1000 - Number(timestampStr));
    if (!Number.isFinite(ageSec) || ageSec > 300) return false; // 5-min replay window
    const message = new TextEncoder().encode(`${timestampStr}|${body}`);
    const sig = b64decode(signatureB64);
    const pkBytes = b64decode(publicKeyB64);
    const key = await crypto.subtle.importKey(
      "raw", pkBytes, { name: "Ed25519" }, false, ["verify"],
    );
    return await crypto.subtle.verify("Ed25519", key, sig, message);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("telnyx-signature-ed25519") ?? "";
  const ts = req.headers.get("telnyx-timestamp") ?? "";
  const publicKey = Deno.env.get("TELNYX_PUBLIC_KEY") ?? "";

  // Require signature verification when a public key is configured.
  // Only allow unsigned requests in dev (no public key set).
  let verified = false;
  if (publicKey) {
    if (!sig || !ts) {
      return new Response(JSON.stringify({ error: "missing signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    verified = await verifyTelnyxSignature(rawBody, sig, ts, publicKey);
    if (!verified) {
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    console.warn("TELNYX_PUBLIC_KEY not configured — accepting request unverified (dev mode)");
  }

  let event: Record<string, unknown>;
  try { event = JSON.parse(rawBody); }
  catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = (event.data ?? {}) as Record<string, unknown>;
  const payload = (data.payload ?? {}) as Record<string, unknown>;
  const eventType = String(data.event_type ?? "unknown");
  const callControlId = String(payload.call_control_id ?? "");
  const callLegId = String(payload.call_leg_id ?? "");
  const fromNumber = String(payload.from ?? "");
  const toNumber = String(payload.to ?? "");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Look up tenant by destination number → numbers table → customer_id
  let customerId: string | null = null;
  if (toNumber) {
    const { data: numRow } = await admin
      .from("numbers")
      .select("customer_id, agent_id")
      .eq("twilio_number", toNumber)
      .maybeSingle();
    customerId = numRow?.customer_id ?? null;
  }

  // 1. Append-only event log
  await admin.from("telnyx_call_events").insert({
    customer_id: customerId,
    telnyx_call_control_id: callControlId || null,
    telnyx_call_leg_id: callLegId || null,
    event_type: eventType,
    from_number: fromNumber || null,
    to_number: toNumber || null,
    signature_verified: verified,
    signature_timestamp: ts ? new Date(Number(ts) * 1000).toISOString() : null,
    raw_payload: event,
  });

  // 2. Map to calls table
  if (eventType === "call.initiated" && customerId) {
    await admin.from("calls").insert({
      customer_id: customerId,
      customer_phone: fromNumber || null,
      twilio_number: toNumber || null,
      started_at: new Date().toISOString(),
      intent: "inbound_telnyx",
    });

    // Inbound calls are routed to Retell via the Telnyx → Retell number
    // binding set up by provision-worker (importPhoneNumber). No call-control
    // transfer is required from this handler.
  } else if (eventType === "call.hangup" && customerId) {
    const startTime = payload.start_time ? new Date(String(payload.start_time)).getTime() : Date.now();
    const endTime = payload.end_time ? new Date(String(payload.end_time)).getTime() : Date.now();
    const duration = Math.max(0, Math.round((endTime - startTime) / 1000));
    await admin
      .from("calls")
      .update({ ended_at: new Date().toISOString(), duration_sec: duration })
      .eq("customer_id", customerId)
      .eq("customer_phone", fromNumber)
      .is("ended_at", null);
  }

  return new Response(JSON.stringify({ ok: true, verified }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

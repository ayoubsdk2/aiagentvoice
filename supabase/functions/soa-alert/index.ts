// SOA alert email dispatcher. Token-gated (admin HMAC) and routes
// all notifications through Resend to daniel@phaosai.com by default.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SESSION_SECRET = Deno.env.get("ADMIN_SESSION_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

function b64urlToBytes(b64: string): Uint8Array {
  const s = b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacB64Url(message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  let s = ""; for (const b of new Uint8Array(sig)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verifyToken(token: string): Promise<boolean> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  if ((await hmacB64Url(body)) !== sig) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
    return payload.sub === "phaos_admin" && typeof payload.exp === "number" && payload.exp >= Math.floor(Date.now() / 1000);
  } catch { return false; }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!SESSION_SECRET) return json({ error: "not_configured" }, 500);
  if (!RESEND_API_KEY || !LOVABLE_API_KEY) return json({ error: "resend_not_configured" }, 500);

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || !(await verifyToken(token))) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({})) as {
    subject?: string; html?: string; text?: string; to?: string | string[]; tag?: string;
  };

  const subject = body.subject?.trim() || "Phaos AI · SOA Notification";
  const html = body.html ?? `<p>${(body.text ?? "Test notification from Phaos AI SOA console.").replace(/</g, "&lt;")}</p>`;
  const to = Array.isArray(body.to) ? body.to : [body.to?.trim() || "daniel@phaosai.com"];

  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: "Phaos AI <onboarding@resend.dev>",
      to, subject, html,
      tags: body.tag ? [{ name: "category", value: body.tag }] : undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: "resend_failed", detail: data }, 502);
  return json({ ok: true, id: (data as { id?: string }).id ?? null });
});

// Sends a password-reset assistance request to the platform admin (Daniel).
// Public endpoint — no JWT required (a user who can't log in needs to use it).
// Rate-limited per email + IP to prevent abuse.

import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAIL = "Daniel@PhaosAI.com";
const FROM_EMAIL = "Phaos AI Security <security@notify.www.phaosai.com>";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  reason: z.string().trim().max(500).optional(),
});

// Very small in-memory rate limiter (per cold start). Good enough as a soft guard;
// the real guard is the user already failing self-serve reset.
const recentRequests = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60_000;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const last = recentRequests.get(key) ?? 0;
  if (now - last < RATE_LIMIT_WINDOW_MS) return true;
  recentRequests.set(key, now);
  // Periodic cleanup
  if (recentRequests.size > 200) {
    for (const [k, t] of recentRequests) {
      if (now - t > RATE_LIMIT_WINDOW_MS * 5) recentRequests.delete(k);
    }
  }
  return false;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { email, reason } = parsed.data;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  if (rateLimited(`${email.toLowerCase()}|${ip}`)) {
    // Always return 200 to avoid leaking which emails exist / who is rate-limited
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("[request-password-reset-help] Missing RESEND_API_KEY");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const safeEmail = escapeHtml(email);
  const safeReason = reason ? escapeHtml(reason) : "(none provided)";
  const safeIp = escapeHtml(ip);
  const safeUa = escapeHtml(userAgent);
  const timestamp = new Date().toISOString();

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0a0a;">
      <h2 style="margin:0 0 16px;font-size:18px;color:#0a0a0a;">Password reset assistance requested</h2>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#333;">
        A user reports they did not receive the self-serve password reset email and is asking for admin help.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
        <tr><td style="padding:6px 8px;background:#f6f6f8;font-weight:600;width:140px;">User email</td><td style="padding:6px 8px;background:#f6f6f8;">${safeEmail}</td></tr>
        <tr><td style="padding:6px 8px;font-weight:600;">Reason</td><td style="padding:6px 8px;">${safeReason}</td></tr>
        <tr><td style="padding:6px 8px;background:#f6f6f8;font-weight:600;">Requested at</td><td style="padding:6px 8px;background:#f6f6f8;">${timestamp}</td></tr>
        <tr><td style="padding:6px 8px;font-weight:600;">IP</td><td style="padding:6px 8px;">${safeIp}</td></tr>
        <tr><td style="padding:6px 8px;background:#f6f6f8;font-weight:600;">User agent</td><td style="padding:6px 8px;background:#f6f6f8;font-size:11px;">${safeUa}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#666;">
        Verify identity through an out-of-band channel before triggering a manual reset.
      </p>
    </div>
  `;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [ADMIN_EMAIL],
      reply_to: email,
      subject: `[Phaos AI] Password reset help request — ${email}`,
      html,
    }),
  });

  if (!resendRes.ok) {
    const text = await resendRes.text().catch(() => "");
    console.error(
      "[request-password-reset-help] Resend error",
      resendRes.status,
      text
    );
    return new Response(
      JSON.stringify({ error: "Could not deliver request" }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

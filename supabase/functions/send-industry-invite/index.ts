import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Universal tracking BCC — every send is silently copied here for visibility.
const TRACKING_BCC = "Daniel@PhaosAI.com";

// Lovable Emails verified sender (delegated subdomain). The sender MUST be on
// this verified domain — spoofing the user's own address causes SPF/DKIM
// failures and spam classification (the prior behavior).
const SENDER_DOMAIN = "notify.voice.phaosai.com";
const FROM_DOMAIN = "voice.phaosai.com";
const SITE_NAME = "Phaos AI";

interface Payload {
  to: string[];
  subject: string;
  message: string;
  industryId: string;
  industryName: string;
  link: string;
  replyToEmail: string;   // user's email — used as Reply-To only
  replyToName?: string;
}

function bad(status: number, error: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error, ...(extra ?? {}) }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "method_not_allowed");

  const started = Date.now();
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? null;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE) return bad(500, "server_misconfigured");

  let user: { id: string; email: string | null } | null = null;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || !ANON) return bad(401, "unauthorized");
  try {
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data } = await userClient.auth.getUser();
    if (data?.user) user = { id: data.user.id, email: data.user.email ?? null };
  } catch { /* fallthrough */ }
  if (!user) return bad(401, "unauthorized");

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let body: Payload;
  try { body = await req.json() as Payload; } catch { return bad(400, "invalid_json"); }

  const toList = (body.to ?? []).filter((s) => typeof s === "string" && s.trim() !== "");
  if (toList.length === 0) return bad(400, "missing_to");

  const replyTo = (body.replyToEmail ?? user?.email ?? "").trim();
  if (!replyTo || !EMAIL_RE.test(replyTo)) return bad(400, "invalid_reply_to_email");

  // Tracking BCC — added as an additional recipient (separate send).
  const recipientSet = new Map<string, string>();
  for (const e of toList) recipientSet.set(e.toLowerCase(), e);
  recipientSet.set(TRACKING_BCC.toLowerCase(), TRACKING_BCC);
  const allRecipients = [...recipientSet.values()];

  const badAddr = allRecipients.find((e) => !EMAIL_RE.test(e));
  if (badAddr) return bad(400, "invalid_email", { value: badAddr });
  if (allRecipients.length > 50) return bad(400, "too_many_recipients");
  if (!body.subject?.trim()) return bad(400, "missing_subject");
  if (!body.message?.trim()) return bad(400, "missing_message");
  if (body.subject.length > 300) return bad(400, "subject_too_long");
  if (body.message.length > 20000) return bad(400, "message_too_long");

  const senderName = body.replyToName?.trim() || replyTo;
  const messageHtml = escapeHtml(body.message).replace(/\n/g, "<br/>");
  const linkSafe = escapeHtml(body.link);
  const industrySafe = escapeHtml(body.industryName);
  const subject = body.subject.trim();

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111">
      <p style="margin:0 0 4px;color:#666;font-size:12px">Shared by <strong>${escapeHtml(senderName)}</strong> &lt;${escapeHtml(replyTo)}&gt;</p>
      <h2 style="margin:8px 0 16px">${industrySafe} — Phaos AI Voice Agent</h2>
      <div style="white-space:pre-wrap;line-height:1.5">${messageHtml}</div>
      <p style="margin:24px 0 8px">
        <a href="${linkSafe}" style="display:inline-block;padding:12px 20px;background:#f5c542;color:#000;text-decoration:none;font-weight:bold;border-radius:8px">
          Try the ${industrySafe} Voice Agent
        </a>
      </p>
      <p style="margin:8px 0 0;color:#666;font-size:12px">Direct link: <a href="${linkSafe}">${linkSafe}</a></p>
    </div>`;
  const plainText = `Shared by ${senderName} <${replyTo}>\n\n${body.message}\n\nTry it live: ${body.link}`;

  // Sender = verified domain (required for SPF/DKIM alignment, no spam).
  // Reply-To = the user's address, so recipients can reply directly to them.
  const fromHeader = `${SITE_NAME} <noreply@${FROM_DOMAIN}>`;

  function generateToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function getUnsubscribeToken(email: string): Promise<string | null> {
    const normalized = email.toLowerCase();
    const { data: existing } = await adminClient
      .from("email_unsubscribe_tokens")
      .select("token, used_at")
      .eq("email", normalized)
      .maybeSingle();
    if (existing?.token && !existing.used_at) return existing.token;
    if (existing?.used_at) return null;
    const token = generateToken();
    await adminClient
      .from("email_unsubscribe_tokens")
      .upsert({ token, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
    const { data: stored } = await adminClient
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalized)
      .maybeSingle();
    return stored?.token ?? null;
  }

  let enqueued = 0;
  const enqueueErrors: string[] = [];
  for (const recipient of allRecipients) {
    const messageId = crypto.randomUUID();
    const unsubscribeToken = await getUnsubscribeToken(recipient);
    if (!unsubscribeToken) {
      enqueueErrors.push(`${recipient}: suppressed`);
      continue;
    }
    const { error } = await adminClient.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: recipient,
        from: fromHeader,
        reply_to: replyTo,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text: plainText,
        purpose: "transactional",
        label: "industry_invite",
        idempotency_key: messageId,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) {
      enqueueErrors.push(`${recipient}: ${error.message}`);
    } else {
      enqueued += 1;
      await adminClient.from("email_send_log").insert({
        message_id: messageId,
        template_name: "industry_invite",
        recipient_email: recipient,
        status: "pending",
      });
    }
  }

  const ok = enqueued > 0 && enqueueErrors.length === 0;
  const errMsg = enqueueErrors.length ? enqueueErrors.join("; ") : null;

  adminClient.from("industry_invite_logs").insert({
    industry_id: body.industryId,
    industry_name: body.industryName,
    sender_user_id: user?.id ?? null,
    sender_email: replyTo,
    sender_name: body.replyToName ?? null,
    recipients_to: toList,
    recipients_cc: [],
    recipients_bcc: [TRACKING_BCC],
    recipient_count: allRecipients.length,
    subject,
    message: body.message,
    link: body.link,
    status: ok ? "sent" : "failed",
    error_message: errMsg,
    resend_id: null,
    ip_address: ip,
    user_agent: ua,
    duration_ms: Date.now() - started,
  }).then(({ error }: { error: unknown }) => {
    if (error) console.error("invite_log_insert_failed", error);
  });

  if (!ok) return bad(502, "send_failed", { details: errMsg ?? "enqueue_failed" });

  return new Response(JSON.stringify({ ok: true, enqueued }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

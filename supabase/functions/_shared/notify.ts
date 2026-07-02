// Slack + Resend notification helpers shared across billing functions.

const SLACK_WEBHOOK = Deno.env.get("SLACK_INTERNAL_WEBHOOK_URL");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

export async function notifySlack(
  text: string,
  blocks?: unknown[],
): Promise<void> {
  if (!SLACK_WEBHOOK) {
    console.log("[notifySlack] No webhook configured, skipping:", text);
    return;
  }
  try {
    await fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    });
  } catch (e) {
    console.error("[notifySlack] failed:", e);
  }
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log("[sendEmail] No RESEND_API_KEY, skipping:", opts.subject);
    return;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opts.from || "Phaos AI <onboarding@resend.dev>",
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!r.ok) console.error("[sendEmail]", r.status, await r.text());
  } catch (e) {
    console.error("[sendEmail] failed:", e);
  }
}

export function brandedEmail(content: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e5e5e5;padding:32px;border-radius:16px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#a855f7,#7c3aed);"></div>
      <div style="font-weight:700;font-size:18px;color:#fff;">Phaos AI</div>
    </div>
    ${content}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #222;font-size:11px;color:#666;">
      Phaos AI · Voice Intelligence for Print &amp; Copier
    </div>
  </div>`;
}

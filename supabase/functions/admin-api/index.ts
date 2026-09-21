// Token-gated admin CRUD API. Verifies HMAC tokens issued by `admin-gate`
// and performs writes server-side with the service-role key so the
// /admin password alone unlocks Live Account management — no second
// Supabase sign-in is required.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptCredentials, encryptCredentials } from "../_shared/integration-crypto.ts";
import { runIntegrationTest, REQUIRED_FIELDS } from "../_shared/integration-tests.ts";
import { assertSafePublicUrl } from "../_shared/url-safety.ts";

const URL_CRED_FIELDS = new Set([
  "base_url",
  "endpoint_url",
  "server_url",
  "instance_url",
  "webhook_url",
]);

/** Throws if any URL-shaped credential field points at a private/internal address. */
function assertCredentialsSsrfSafe(creds: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(creds)) {
    if (!URL_CRED_FIELDS.has(k)) continue;
    const val = typeof v === "string" ? v.trim() : "";
    if (!val) continue;
    assertSafePublicUrl(val, k);
  }
}

const SESSION_SECRET = Deno.env.get("ADMIN_SESSION_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function b64urlToBytes(b64: string): Uint8Array {
  const s = b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacB64Url(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verifyToken(token: string): Promise<boolean> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = await hmacB64Url(body);
  if (expected !== sig) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
    if (payload.sub !== "phaos_admin") return false;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const E164_RE = /^\+[1-9]\d{6,14}$/;

function trimCredentialValues(credentials: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(credentials ?? {})
      .map(([k, v]) => [k, String(v ?? "").trim()])
      .filter(([, v]) => v.length > 0),
  );
}

async function decryptStoredCredentials(row: Record<string, unknown> | null | undefined): Promise<Record<string, string>> {
  if (!row?.ciphertext || !row?.iv || !row?.auth_tag) return {};
  const decrypted = await decryptCredentials<Record<string, unknown>>({
    ciphertext: String(row.ciphertext),
    iv: String(row.iv),
    auth_tag: String(row.auth_tag),
  });
  return Object.fromEntries(
    Object.entries(decrypted)
      .map(([k, v]) => [k, String(v ?? "").trim()])
      .filter(([, v]) => v.length > 0),
  );
}

async function decryptHubSpotServiceKey(value: unknown): Promise<string> {
  const encrypted = String(value ?? "");
  if (!encrypted.startsWith("enc:v2:")) return "";
  const blob = JSON.parse(encrypted.slice("enc:v2:".length));
  const decrypted = await decryptCredentials<Record<string, unknown>>(blob);
  return String(decrypted.private_app_token ?? "").trim();
}

interface DetailedElement { key: string; label: string; ok: boolean; reason: string }
interface DetailedResult { elements: DetailedElement[]; allOk: boolean; summary: string }

const FETCH_TIMEOUT_MS = 8000;
async function fetchWithTimeoutLocal(u: string, init: RequestInit = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try { return await fetch(u, { ...init, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

function isValidUrl(s: string) {
  try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}

async function runDetailedTest(id: string, c: Record<string, string>): Promise<DetailedResult> {
  const get = (k: string) => (c[k] ?? "").trim();
  const elements: DetailedElement[] = [];
  const finish = (): DetailedResult => {
    const allOk = elements.every((e) => e.ok);
    const okCount = elements.filter((e) => e.ok).length;
    const summary = allOk
      ? `All ${elements.length} credentials verified.`
      : `${elements.length - okCount} of ${elements.length} credentials failed validation.`;
    return { elements, allOk, summary };
  };

  if (id === "hubspot") {
    const guid = get("hubspot_form_guid");
    const pid = get("portal_id");
    const token = get("private_app_token");
    // Form GUID — format check
    if (/^[0-9a-f-]{20,}$/i.test(guid)) {
      elements.push({ key: "form_guid", label: "HubSpot Form GUID", ok: true, reason: "GUID is well-formed." });
    } else {
      elements.push({ key: "form_guid", label: "HubSpot Form GUID", ok: false, reason: "GUID is malformed — expected a HubSpot UUID." });
    }
    // Portal ID — numeric check + Forms submit test (validates both portal & GUID together)
    if (!/^\d{4,12}$/.test(pid)) {
      elements.push({ key: "portal_id", label: "HubSpot Portal ID", ok: false, reason: "Portal ID must be numeric (4–12 digits)." });
    } else if (elements[0].ok) {
      try {
        const r = await fetchWithTimeoutLocal(
          `https://api.hsforms.com/submissions/v3/integration/submit/${encodeURIComponent(pid)}/${encodeURIComponent(guid)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fields: [{ name: "email", value: "connection-test@phaosai.com" }],
              context: { pageUri: "https://aiagentvoice-ten.vercel.app/admin", pageName: "Phaos AI HubSpot Test" },
            }),
            redirect: "manual",
          },
        );
        const ok = r.status === 200 || r.status === 204 || r.status === 302 || (r.status >= 200 && r.status < 300);
        elements.push({
          key: "portal_id",
          label: "HubSpot Portal ID",
          ok,
          reason: ok ? "Portal accepted the form submission." : `HubSpot returned HTTP ${r.status}.`,
        });
      } catch (e) {
        elements.push({ key: "portal_id", label: "HubSpot Portal ID", ok: false, reason: `Network error: ${(e as Error).message}` });
      }
    } else {
      elements.push({ key: "portal_id", label: "HubSpot Portal ID", ok: false, reason: "Skipped — fix the Form GUID first." });
    }
    // Service Key — live auth ping
    if (!token) {
      elements.push({ key: "service_key", label: "HubSpot Service Key", ok: false, reason: "No service key supplied (and none saved)." });
    } else {
      try {
        const r = await fetchWithTimeoutLocal("https://api.hubapi.com/account-info/v3/details", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.status === 401 || r.status === 403) {
          elements.push({ key: "service_key", label: "HubSpot Service Key", ok: false, reason: "Service key rejected by HubSpot (401/403)." });
        } else if (r.ok) {
          elements.push({ key: "service_key", label: "HubSpot Service Key", ok: true, reason: "Token authenticated against HubSpot account-info." });
        } else {
          elements.push({ key: "service_key", label: "HubSpot Service Key", ok: false, reason: `HubSpot returned HTTP ${r.status}.` });
        }
      } catch (e) {
        elements.push({ key: "service_key", label: "HubSpot Service Key", ok: false, reason: `Network error: ${(e as Error).message}` });
      }
    }
    return finish();
  }

  if (id === "sales_chain") {
    const base = get("base_url"), tenant = get("tenant_id"), key = get("api_key");
    elements.push({
      key: "base_url", label: "Base URL",
      ok: isValidUrl(base),
      reason: isValidUrl(base) ? "URL is well-formed." : "URL is missing or malformed (expected https://…).",
    });
    elements.push({
      key: "tenant_id", label: "Tenant ID",
      ok: tenant.length > 0,
      reason: tenant.length > 0 ? "Tenant ID provided." : "Tenant ID is required.",
    });
    if (!key) {
      elements.push({ key: "api_key", label: "API Key", ok: false, reason: "API key is required." });
    } else if (!isValidUrl(base)) {
      elements.push({ key: "api_key", label: "API Key", ok: false, reason: "Skipped — fix the Base URL first." });
    } else {
      try {
        const u = new URL("/api/v1/ping", base).toString();
        const r = await fetchWithTimeoutLocal(u, { headers: { Authorization: `Bearer ${key}` } });
        if (r.status === 401 || r.status === 403) {
          elements.push({ key: "api_key", label: "API Key", ok: false, reason: "SalesChain rejected the API key (401/403)." });
        } else {
          elements.push({ key: "api_key", label: "API Key", ok: true, reason: `SalesChain accepted the API key (HTTP ${r.status}).` });
        }
      } catch (e) {
        elements.push({ key: "api_key", label: "API Key", ok: false, reason: `Cannot reach SalesChain: ${(e as Error).message}` });
      }
    }
    return finish();
  }

  if (id === "eautomate" || id === "printanista") {
    const vendor = id === "eautomate" ? "E-automate" : "Printanista";
    const base = get("base_url"), user = get("username"), pass = get("password");
    elements.push({
      key: "base_url", label: id === "eautomate" ? "Web Services URL" : "Tenant Base URL",
      ok: isValidUrl(base),
      reason: isValidUrl(base) ? "URL is well-formed." : "URL is missing or malformed.",
    });
    elements.push({
      key: "username", label: "Service-account Username",
      ok: user.length > 0,
      reason: user.length > 0 ? "Username provided." : "Username is required.",
    });
    if (!pass) {
      elements.push({ key: "password", label: "Service-account Password", ok: false, reason: "Password is required." });
    } else if (!isValidUrl(base) || !user) {
      elements.push({ key: "password", label: "Service-account Password", ok: false, reason: "Skipped — fix URL and username first." });
    } else {
      try {
        const probePath = id === "eautomate" ? "/odata/v1/$metadata" : "/api/v1/devices?limit=1";
        const u = new URL(probePath, base).toString();
        const auth = btoa(`${user}:${pass}`);
        const r = await fetchWithTimeoutLocal(u, { headers: { Authorization: `Basic ${auth}` } });
        if (r.status === 401 || r.status === 403) {
          elements.push({ key: "password", label: "Service-account Password", ok: false, reason: `${vendor} rejected the service-account credentials (401/403).` });
        } else if (r.ok || r.status === 404) {
          elements.push({ key: "password", label: "Service-account Password", ok: true, reason: `${vendor} accepted the service-account credentials (HTTP ${r.status}).` });
        } else {
          elements.push({ key: "password", label: "Service-account Password", ok: false, reason: `${vendor} returned HTTP ${r.status}.` });
        }
      } catch (e) {
        elements.push({ key: "password", label: "Service-account Password", ok: false, reason: `Cannot reach ${vendor}: ${(e as Error).message}` });
      }
    }
    return finish();
  }

  // Generic fallback for any other integration in the registry
  const reqMap = REQUIRED_FIELDS[id] ?? [];
  for (const k of reqMap) {
    const v = (c[k] ?? "").trim();
    elements.push({
      key: k,
      label: k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
      ok: v.length > 0,
      reason: v.length > 0 ? "Value provided." : "Field is required.",
    });
  }
  if (elements.every((e) => e.ok)) {
    const live = await runIntegrationTest(id, c);
    if (!live.ok) {
      elements.push({ key: "_live", label: "Live Authentication", ok: false, reason: live.message ?? "Live test failed." });
    } else {
      elements.push({ key: "_live", label: "Live Authentication", ok: true, reason: live.message ?? "Authenticated successfully." });
    }
  }
  return finish();
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!SESSION_SECRET || !SERVICE_ROLE) return json({ error: "not_configured" }, 500);

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || !(await verifyToken(token))) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/admin-api/, "") || "/";
  const method = req.method.toUpperCase();
  const body = method === "GET" || method === "DELETE" ? {} : await req.json().catch(() => ({}));

  try {
    // ---- Customers ----
    if (path === "/customers" && method === "GET") {
      const { data, error } = await supabase.from("customers").select("id,name").order("name");
      if (error) throw error;
      return json({ customers: data });
    }

    if (path === "/customers" && method === "POST") {
      const { name } = body as Record<string, string>;
      const clean = (name ?? "").trim();
      if (!clean) return json({ error: "Company name required" }, 400);
      // Try to find an existing customer by case-insensitive name to avoid duplicates.
      const { data: existing } = await supabase
        .from("customers")
        .select("id,name")
        .ilike("name", clean)
        .limit(1)
        .maybeSingle();
      if (existing) return json({ customer: existing });
      const { data, error } = await supabase
        .from("customers")
        .insert({ name: clean })
        .select("id,name")
        .single();
      if (error) throw error;
      return json({ customer: data });
    }

    // ---- Live Accounts ----
    if (path === "/live-accounts" && method === "GET") {
      const { data, error } = await supabase
        .from("live_accounts")
        .select("id, customer_id, display_name, access_code_hash, is_active, notes, notification_email, system_prompt, vapi_assistant_id_primary, created_at, provisioning_status, provisioning_error, needs_manual_review, contact_name, contact_email, website_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ accounts: data });
    }

    if (path === "/live-accounts" && method === "POST") {
      // Empty-record creation is deprecated; LIVE accounts must be provisioned
      // via the provision-client edge function (Create LIVE Account button).
      return json({ error: "use_provision_client", detail: "POST /live-accounts is disabled. Use provision-client to create LIVE accounts." }, 410);
    }

    const liveAcctMatch = path.match(/^\/live-accounts\/([0-9a-f-]+)$/i);
    if (liveAcctMatch) {
      const id = liveAcctMatch[1];
      if (method === "PATCH") {
        const patch: Record<string, unknown> = {};
        if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
        if (typeof body.notification_email === "string") patch.notification_email = body.notification_email.trim() || null;
        if (typeof body.system_prompt === "string") patch.system_prompt = body.system_prompt;
        if (typeof body.vapi_assistant_id_primary === "string") patch.vapi_assistant_id_primary = body.vapi_assistant_id_primary.trim() || null;
        if (typeof body.notes === "string") patch.notes = body.notes;
        if (body.notification_config && typeof body.notification_config === "object") {
          patch.notification_config = body.notification_config;
        }
        if (typeof body.access_code === "string" && body.access_code.length >= 5) {
          patch.access_code_hash = await sha256Hex(body.access_code.trim());
        }
        const { error } = await supabase.from("live_accounts").update(patch).eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      if (method === "DELETE") {
        const { error } = await supabase.from("live_accounts").delete().eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
    }

    // ---- Agents ----
    if (path === "/agents" && method === "GET") {
      const customer_id = url.searchParams.get("customer_id") ?? "";
      const { data, error } = await supabase
        .from("live_account_agents")
        .select("*")
        .eq("customer_id", customer_id)
        .order("is_primary", { ascending: false })
        .order("created_at");
      if (error) throw error;
      return json({ agents: data });
    }
    if (path === "/agents" && method === "POST") {
      const { customer_id, vapi_assistant_id, label, is_primary } = body as Record<string, unknown>;
      // Retell agent ids look like `agent_33d6c5549eb8ed8203fd5b6537`; older
      // records may still be UUIDs. Accept either.
      const assistantId = String(vapi_assistant_id ?? "").trim();
      const RETELL_ID_RE = /^agent_[a-z0-9]{6,}$/i;
      if (!UUID_RE.test(String(customer_id)) || !(RETELL_ID_RE.test(assistantId) || UUID_RE.test(assistantId))) {
        return json({ error: "invalid_input" }, 400);
      }
      if (is_primary) {
        await supabase.from("live_account_agents").update({ is_primary: false }).eq("customer_id", customer_id);
      }
      const { data, error } = await supabase.from("live_account_agents").insert({
        customer_id,
        vapi_assistant_id: assistantId,
        retell_agent_id: RETELL_ID_RE.test(assistantId) ? assistantId : null,
        label: (label as string)?.trim() || null,
        is_primary: !!is_primary,
      }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ agent: data });
    }
    const agentMatch = path.match(/^\/agents\/([0-9a-f-]+)$/i);
    if (agentMatch) {
      const id = agentMatch[1];
      if (method === "PATCH") {
        if (body.is_primary === true) {
          const { data: agent } = await supabase.from("live_account_agents").select("customer_id").eq("id", id).single();
          if (agent?.customer_id) {
            await supabase.from("live_account_agents").update({ is_primary: false }).eq("customer_id", agent.customer_id);
          }
        }
        const patch: Record<string, unknown> = {};
        if (typeof body.is_primary === "boolean") patch.is_primary = body.is_primary;
        if (typeof body.label === "string") patch.label = body.label;
        if (typeof body.system_prompt === "string") patch.system_prompt = body.system_prompt;
        if (typeof body.vapi_assistant_id === "string") {
          const RETELL_ID_RE = /^agent_[a-z0-9]{6,}$/i;
          const v = body.vapi_assistant_id.trim();
          if (RETELL_ID_RE.test(v) || UUID_RE.test(v)) {
            patch.vapi_assistant_id = v;
            if (RETELL_ID_RE.test(v)) patch.retell_agent_id = v;
          }
        }
        if (typeof body.voice_id === "string") patch.voice_id = body.voice_id.trim() || null;
        if (typeof body.voice_provider === "string") patch.voice_provider = body.voice_provider.trim() || null;
        const { error } = await supabase.from("live_account_agents").update(patch).eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      if (method === "DELETE") {
        const { error } = await supabase.from("live_account_agents").delete().eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
    }

    // ---- Phones ----
    if (path === "/phones" && method === "GET") {
      const customer_id = url.searchParams.get("customer_id") ?? "";
      const { data, error } = await supabase
        .from("live_account_phone_numbers").select("*").eq("customer_id", customer_id).order("created_at");
      if (error) throw error;
      return json({ phones: data });
    }
    if (path === "/phones" && method === "POST") {
      const { customer_id, agent_id, e164, provider } = body as Record<string, string>;
      if (!UUID_RE.test(customer_id) || !UUID_RE.test(agent_id) || !E164_RE.test(e164)) {
        return json({ error: "invalid_input" }, 400);
      }
      const { data, error } = await supabase.from("live_account_phone_numbers").insert({
        customer_id, agent_id, e164, provider: provider?.trim() || null,
      }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ phone: data });
    }
    const phoneMatch = path.match(/^\/phones\/([0-9a-f-]+)$/i);
    if (phoneMatch && method === "DELETE") {
      const { error } = await supabase.from("live_account_phone_numbers").delete().eq("id", phoneMatch[1]);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---- SOA Vendor Integrations ----
    if (path === "/vendors" && method === "GET") {
      const customer_id = url.searchParams.get("customer_id") ?? "";
      const { data, error } = await supabase
        .from("soa_vendor_integrations").select("*").eq("customer_id", customer_id).order("vendor_key");
      if (error) throw error;
      return json({ vendors: data });
    }
    const vendorMatch = path.match(/^\/vendors\/([0-9a-f-]+)$/i);
    if (vendorMatch && method === "PATCH") {
      const id = vendorMatch[1];
      const allowed = ["status", "mode", "kill_switch", "manual_review", "config", "secret_refs", "failure_summary"];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (k in body) patch[k] = (body as Record<string, unknown>)[k];
      const { error } = await supabase.from("soa_vendor_integrations").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---- Test connection (stubbed validator) ----
    const vendorTestMatch = path.match(/^\/vendors\/([0-9a-f-]+)\/test$/i);
    if (vendorTestMatch && method === "POST") {
      const id = vendorTestMatch[1];
      const { data: vendor } = await supabase.from("soa_vendor_integrations").select("*").eq("id", id).single();
      if (!vendor) return json({ error: "not_found" }, 404);

      // Minimal validation: require API key + base URL in config; production wiring lives in validate-integration.
      const cfg = (vendor.config ?? {}) as Record<string, unknown>;
      const refs = (vendor.secret_refs ?? {}) as Record<string, unknown>;
      const missing: string[] = [];
      if (!refs.api_key_ref) missing.push("API key");
      if (!cfg.base_url) missing.push("Base URL");
      if (!cfg.callback_url) missing.push("Callback URL");

      let outcome: "verified" | "failed" = "verified";
      let error_msg: string | null = null;
      let summary: Record<string, unknown> | null = null;

      if (missing.length) {
        outcome = "failed";
        error_msg = `Missing required fields: ${missing.join(", ")}`;
        summary = {
          missing,
          next_steps: [
            `Provide the ${missing.join(", ")} in the setup wizard.`,
            "Save the card, then click Test Connection again.",
            "If validation still fails, the card will move to MANUAL REVIEW and Daniel will receive an alert.",
          ],
          vendor: vendor.vendor_key,
        };
      }

      await supabase.from("soa_vendor_integrations").update({
        last_test_at: new Date().toISOString(),
        last_test_outcome: outcome,
        last_test_error: error_msg,
        failure_summary: summary,
        status: outcome === "verified" ? "on" : "manual_review",
      }).eq("id", id);

      return json({ outcome, error: error_msg, summary });
    }

    // ---- Action Router ----
    if (path === "/action-router" && method === "GET") {
      const customer_id = url.searchParams.get("customer_id") ?? "";
      const { data } = await supabase.from("action_router_config").select("*").eq("customer_id", customer_id).maybeSingle();
      return json({ config: data });
    }
    if (path === "/action-router" && method === "PUT") {
      const { customer_id, endpoint_url, auth_secret_ref, retry_max, retry_backoff_seconds, manual_review_destination, vendor_priority, enabled } = body as Record<string, unknown>;
      if (!UUID_RE.test(String(customer_id))) return json({ error: "invalid_customer_id" }, 400);
      const { error } = await supabase.from("action_router_config").upsert({
        customer_id,
        endpoint_url: (endpoint_url as string) ?? null,
        auth_secret_ref: (auth_secret_ref as string) ?? null,
        retry_max: typeof retry_max === "number" ? retry_max : 3,
        retry_backoff_seconds: typeof retry_backoff_seconds === "number" ? retry_backoff_seconds : 30,
        manual_review_destination: (manual_review_destination as string) ?? null,
        vendor_priority: vendor_priority ?? ["email", "integration", "portal_automation"],
        enabled: enabled === true,
      }, { onConflict: "customer_id" });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---- Manual review queue ----
    if (path === "/intents" && method === "GET") {
      const customer_id = url.searchParams.get("customer_id") ?? "";
      const { data } = await supabase
        .from("service_ticket_intents").select("*").eq("customer_id", customer_id)
        .order("created_at", { ascending: false }).limit(200);
      return json({ intents: data ?? [] });
    }

    // ---- HubSpot integration (per-company) ----
    if (path === "/integrations/hubspot" && method === "GET") {
      const customer_id = url.searchParams.get("customer_id") ?? "";
      if (!UUID_RE.test(customer_id)) return json({ error: "invalid_customer_id" }, 400);
      const { data } = await supabase
        .from("integration_credentials")
        .select("hubspot_form_guid, hubspot_portal_id, hubspot_private_app_token_encrypted, status, last_tested_at, last_test_outcome, last_test_error, field_hints, updated_at")
        .eq("customer_id", customer_id)
        .eq("integration_id", "hubspot")
        .maybeSingle();
      if (!data) return json({ record: null });
      const sanitizedHints = {
        ...((data.field_hints ?? {}) as Record<string, unknown>),
        hubspot_form_guid: !!data.hubspot_form_guid,
        portal_id_saved: /^\d{4,12}$/.test(String(data.hubspot_portal_id ?? "")),
        private_app_token_saved: !!data.hubspot_private_app_token_encrypted,
      };
      const { hubspot_private_app_token_encrypted: _redacted, ...safeRecord } = data;
      void _redacted;
      return json({ record: { ...safeRecord, field_hints: sanitizedHints } });
    }
    if (path === "/integrations/hubspot/test" && method === "POST") {
      const { customer_id, hubspot_form_guid, portal_id } = body as Record<string, string>;
      if (!UUID_RE.test(customer_id || "")) return json({ error: "invalid_customer_id" }, 400);
      const guid = (hubspot_form_guid || "").trim();
      if (!/^[0-9a-f-]{20,}$/i.test(guid)) {
        return json({ ok: false, error: "Form GUID looks malformed (expected a HubSpot UUID)." }, 200);
      }
      let pid = (portal_id || "").trim();
      if (!pid) {
        const { data: cred } = await supabase
          .from("integration_credentials")
          .select("hubspot_portal_id, field_hints")
          .eq("customer_id", customer_id)
          .eq("integration_id", "hubspot")
          .maybeSingle();
        pid = String(cred?.hubspot_portal_id ?? "");
      }
      if (!pid) {
        return json({
          ok: false,
          error: "HubSpot Portal ID is not configured for this company. Add it under Integrations → HubSpot first.",
        }, 200);
      }
      const endpoint = `https://api.hsforms.com/submissions/v3/integration/submit/${encodeURIComponent(pid)}/${encodeURIComponent(guid)}`;
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      try {
        const hsRes = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctl.signal,
          redirect: "manual",
          body: JSON.stringify({
            fields: [
              { name: "email", value: "connection-test@phaosai.com" },
              { name: "firstname", value: "Phaos" },
              { name: "lastname", value: "Connection Test" },
            ],
            context: { pageUri: "https://aiagentvoice-ten.vercel.app/admin", pageName: "Phaos AI Admin · HubSpot Connection Test" },
          }),
        });
        clearTimeout(timer);
        // Treat 200, 204, 302, and any 2xx as a successful HubSpot submission.
        const okStatus = hsRes.status === 204 || hsRes.status === 302 || (hsRes.status >= 200 && hsRes.status < 300);
        if (!okStatus) {
          const text = await hsRes.text().catch(() => "");
          return json({ ok: false, status: hsRes.status, error: text.slice(0, 500) || `HubSpot returned HTTP ${hsRes.status}` });
        }
        return json({ ok: true, status: hsRes.status });
      } catch (e) {
        clearTimeout(timer);
        return json({ ok: false, error: e instanceof Error ? e.message : "HubSpot request failed or timed out." });
      }
    }
    if (path === "/integrations/hubspot/save" && method === "POST") {
      const { customer_id, hubspot_form_guid, portal_id, private_app_token, allow_partial } = body as Record<string, unknown>;
      if (!UUID_RE.test(String(customer_id || ""))) return json({ error: "invalid_customer_id" }, 400);
      const guid = (typeof hubspot_form_guid === "string" ? hubspot_form_guid : "").trim();
      const pid = (typeof portal_id === "string" ? portal_id : "").trim();
      const token = (typeof private_app_token === "string" ? private_app_token : "").trim();

      const { data: existing } = await supabase
        .from("integration_credentials")
        .select("hubspot_form_guid, hubspot_private_app_token_encrypted, hubspot_portal_id, field_hints")
        .eq("customer_id", customer_id)
        .eq("integration_id", "hubspot")
        .maybeSingle();

      const effectiveGuid = guid || String(existing?.hubspot_form_guid ?? "");
      const existingPid = String(existing?.hubspot_portal_id ?? "").trim();
      const effectivePid = pid || (/^\d{4,12}$/.test(existingPid) ? existingPid : "");
      const hadSavedToken = !!existing?.hubspot_private_app_token_encrypted;

      // Partial save: any combination is OK, preserving prior values.
      if (!allow_partial) {
        if (!effectiveGuid) return json({ error: "Form GUID is required." }, 400);
        if (!effectivePid) return json({ error: "HubSpot Portal ID is required." }, 400);
        if (!token && !hadSavedToken) {
          return json({ error: "HubSpot Service Key is required on first save." }, 400);
        }
      }

      let tokenEncrypted: string | null;
      if (token) {
        const blob = await encryptCredentials({ private_app_token: token });
        tokenEncrypted = `enc:v2:${JSON.stringify(blob)}`;
      } else {
        tokenEncrypted = existing?.hubspot_private_app_token_encrypted ?? null;
      }

      const prevHints = (existing?.field_hints ?? {}) as Record<string, unknown>;
      const nextHints: Record<string, unknown> = {
        ...prevHints,
        ...(effectiveGuid ? { hubspot_form_guid: true } : {}),
        ...(effectivePid ? { portal_id_saved: true } : {}),
        private_app_token_saved: !!tokenEncrypted,
      };

      // Saves never auto-activate — only a successful Test Connection flips status.
      const { error } = await supabase.from("integration_credentials").upsert({
        customer_id,
        integration_id: "hubspot",
        hubspot_form_guid: effectiveGuid || null,
        hubspot_portal_id: effectivePid || null,
        hubspot_private_app_token_encrypted: tokenEncrypted,
        ciphertext: null,
        iv: null,
        auth_tag: null,
        field_hints: nextHints,
        // Don't change status here; Test Connection owns it.
      }, { onConflict: "customer_id,integration_id" });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, saved: true });
    }

    const hubspotDetailedTest = path === "/integrations/hubspot/test-detailed";
    if (hubspotDetailedTest && method === "POST") {
      const { customer_id, credentials } = body as {
        customer_id?: string; credentials?: Record<string, string>;
      };
      if (!customer_id || !UUID_RE.test(customer_id)) return json({ error: "invalid_customer_id" }, 400);

      const typedCredentials = trimCredentialValues(credentials);
      const { data: existing } = await supabase
        .from("integration_credentials")
        .select("hubspot_form_guid, hubspot_portal_id, hubspot_private_app_token_encrypted, field_hints, status")
        .eq("customer_id", customer_id)
        .eq("integration_id", "hubspot")
        .maybeSingle();

      const mergedCredentials: Record<string, string> = {
        hubspot_form_guid: typedCredentials.hubspot_form_guid || String(existing?.hubspot_form_guid ?? ""),
        portal_id: typedCredentials.portal_id || (/^\d{4,12}$/.test(String(existing?.hubspot_portal_id ?? "").trim()) ? String(existing?.hubspot_portal_id ?? "").trim() : ""),
        private_app_token: typedCredentials.private_app_token,
      };
      if (!mergedCredentials.private_app_token && existing?.hubspot_private_app_token_encrypted) {
        try {
          mergedCredentials.private_app_token = await decryptHubSpotServiceKey(existing.hubspot_private_app_token_encrypted);
        } catch {
          mergedCredentials.private_app_token = "";
        }
      }

      const result = await runDetailedTest("hubspot", mergedCredentials);
      let tokenEncrypted = existing?.hubspot_private_app_token_encrypted ?? null;
      if (typedCredentials.private_app_token) {
        const blob = await encryptCredentials({ private_app_token: typedCredentials.private_app_token });
        tokenEncrypted = `enc:v2:${JSON.stringify(blob)}`;
      }
      const persistedPortalId = /^\d{4,12}$/.test(mergedCredentials.portal_id) ? mergedCredentials.portal_id : null;
      const prevHints = (existing?.field_hints ?? {}) as Record<string, unknown>;
      const nextHints: Record<string, unknown> = {
        ...prevHints,
        ...(mergedCredentials.hubspot_form_guid ? { hubspot_form_guid: true } : {}),
        ...(persistedPortalId ? { portal_id_saved: true } : {}),
        private_app_token_saved: !!tokenEncrypted,
      };
      await supabase.from("integration_credentials").upsert({
        customer_id,
        integration_id: "hubspot",
        hubspot_form_guid: mergedCredentials.hubspot_form_guid || null,
        hubspot_portal_id: persistedPortalId,
        hubspot_private_app_token_encrypted: tokenEncrypted,
        field_hints: nextHints,
        status: result.allOk ? "active" : "failed",
        last_tested_at: new Date().toISOString(),
        last_test_outcome: result.allOk ? "ok" : "failed",
        last_test_error: result.allOk ? null : result.summary,
      }, { onConflict: "customer_id,integration_id" });

      return json({ ...result, savedActive: result.allOk });
    }


    if (path === "/integrations/hubspot" && method === "DELETE") {
      const customer_id = url.searchParams.get("customer_id") ?? "";
      if (!UUID_RE.test(customer_id)) return json({ error: "invalid_customer_id" }, 400);
      const { error } = await supabase
        .from("integration_credentials")
        .update({ hubspot_form_guid: null, status: "disabled" })
        .eq("customer_id", customer_id)
        .eq("integration_id", "hubspot");
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---- Per-client Integration Credentials (encrypted) ----
    if (path === "/integration-credentials" && method === "GET") {
      const customer_id = url.searchParams.get("customer_id") ?? "";
      if (!UUID_RE.test(customer_id)) return json({ error: "invalid_customer_id" }, 400);
      const { data, error } = await supabase
        .from("integration_credentials")
        .select("integration_id, status, field_hints, last_tested_at, last_test_outcome, last_test_error, updated_at")
        .eq("customer_id", customer_id);
      if (error) return json({ error: error.message }, 400);
      return json({ records: data ?? [] });
    }
    if (path === "/integration-credentials" && method === "POST") {
      const { customer_id, integration_id, credentials } = body as {
        customer_id?: string; integration_id?: string; credentials?: Record<string, string>;
      };
      if (!customer_id || !UUID_RE.test(customer_id)) return json({ error: "invalid_customer_id" }, 400);
      if (!integration_id || typeof credentials !== "object" || credentials === null) {
        return json({ error: "integration_id and credentials required" }, 400);
      }
      const required = REQUIRED_FIELDS[integration_id] ?? [];
      const missing = required.filter((f) => !credentials[f] || String(credentials[f]).trim() === "");
      if (missing.length > 0) {
        return json({ status: "failed", message: `Missing required fields: ${missing.join(", ")}`, missingFields: missing }, 400);
      }
      try {
        assertCredentialsSsrfSafe(credentials);
      } catch (e) {
        return json({ status: "failed", message: (e as Error).message }, 400);
      }
      let blob;
      try {
        blob = await encryptCredentials(credentials);
      } catch (e) {
        return json({ status: "failed", message: (e as Error).message }, 500);
      }
      const test = await runIntegrationTest(integration_id, credentials);
      const fieldHints = Object.fromEntries(Object.keys(credentials).map((k) => [k, true]));
      const { error: upsertErr } = await supabase.from("integration_credentials").upsert({
        customer_id,
        integration_id,
        ciphertext: blob.ciphertext,
        iv: blob.iv,
        auth_tag: blob.auth_tag,
        field_hints: fieldHints,
        status: test.ok ? "active" : "failed",
        last_tested_at: new Date().toISOString(),
        last_test_outcome: test.ok ? "ok" : "failed",
        last_test_error: test.ok ? null : (test.message ?? "unknown"),
      }, { onConflict: "customer_id,integration_id" });
      if (upsertErr) return json({ status: "failed", message: upsertErr.message }, 500);
      return json({ status: test.ok ? "active" : "failed", message: test.message });
    }
    const credMatch = path.match(/^\/integration-credentials\/([a-z0-9_]+)$/i);
    if (credMatch && method === "DELETE") {
      const customer_id = url.searchParams.get("customer_id") ?? "";
      const hard = url.searchParams.get("hard") === "1";
      if (!UUID_RE.test(customer_id)) return json({ error: "invalid_customer_id" }, 400);
      const integration_id = credMatch[1];
      if (hard) {
        const { error } = await supabase
          .from("integration_credentials")
          .delete()
          .eq("customer_id", customer_id)
          .eq("integration_id", integration_id);
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await supabase
          .from("integration_credentials")
          .update({ status: "disabled" })
          .eq("customer_id", customer_id)
          .eq("integration_id", integration_id);
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    // ---- Integration Pins (Search & Add persistent list) ----
    if (path === "/integration-pins" && method === "GET") {
      const customer_id = url.searchParams.get("customer_id") ?? "";
      if (!UUID_RE.test(customer_id)) return json({ error: "invalid_customer_id" }, 400);
      const { data, error } = await supabase
        .from("integration_pins")
        .select("integration_id, created_at")
        .eq("customer_id", customer_id)
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 400);
      return json({ pins: data ?? [] });
    }
    if (path === "/integration-pins" && method === "POST") {
      const { customer_id, integration_id } = body as { customer_id?: string; integration_id?: string };
      if (!customer_id || !UUID_RE.test(customer_id)) return json({ error: "invalid_customer_id" }, 400);
      if (!integration_id || !/^[a-z0-9_-]+$/i.test(integration_id)) {
        return json({ error: "invalid_integration_id" }, 400);
      }
      const { error } = await supabase
        .from("integration_pins")
        .upsert({ customer_id, integration_id }, { onConflict: "customer_id,integration_id" });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    const pinMatch = path.match(/^\/integration-pins\/([a-z0-9_-]+)$/i);
    if (pinMatch && method === "DELETE") {
      const customer_id = url.searchParams.get("customer_id") ?? "";
      if (!UUID_RE.test(customer_id)) return json({ error: "invalid_customer_id" }, 400);
      const { error } = await supabase
        .from("integration_pins")
        .delete()
        .eq("customer_id", customer_id)
        .eq("integration_id", pinMatch[1]);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---- Per-element Test Connection (used by bespoke integration cards) ----
    // POST /integrations/:id/test-detailed
    //   body: { customer_id, credentials: { key: value, ... } }
    //   response: { elements: [{key,label,ok,reason}], allOk, summary, savedActive }
    const detailedTestMatch = path.match(/^\/integrations\/([a-z0-9_-]+)\/test-detailed$/i);
    if (detailedTestMatch && method === "POST") {
      const integrationId = detailedTestMatch[1];
      if (integrationId === "hubspot") {
        return json({ error: "hubspot route unavailable" }, 404);
      }
      const { customer_id, credentials } = body as {
        customer_id?: string; credentials?: Record<string, string>;
      };
      if (!customer_id || !UUID_RE.test(customer_id)) return json({ error: "invalid_customer_id" }, 400);
      if (!credentials || typeof credentials !== "object") return json({ error: "credentials required" }, 400);

      const typedCredentials = trimCredentialValues(credentials);
      const { data: existing } = await supabase
        .from("integration_credentials")
        .select("status, field_hints, ciphertext, iv, auth_tag")
        .eq("customer_id", customer_id)
        .eq("integration_id", integrationId)
        .maybeSingle();
      let storedCredentials: Record<string, string> = {};
      try {
        storedCredentials = await decryptStoredCredentials(existing as Record<string, unknown> | null);
      } catch {
        storedCredentials = {};
      }
      const mergedCredentials = { ...storedCredentials, ...typedCredentials };

      try {
        assertCredentialsSsrfSafe(mergedCredentials);
      } catch (e) {
        return json({
          elements: [{ key: "_url", label: "URL Safety", ok: false, reason: (e as Error).message }],
          allOk: false,
          summary: (e as Error).message,
        }, 400);
      }

      const result = await runDetailedTest(integrationId, mergedCredentials);

      // Persist credentials (encrypted) on every test attempt so the user does not lose what they typed.
      try {
        const blob = await encryptCredentials(mergedCredentials);
        const existingHints = (existing?.field_hints ?? {}) as Record<string, unknown>;
        const fieldHints = {
          ...existingHints,
          ...Object.fromEntries(Object.keys(mergedCredentials).map((k) => [k, true])),
        };
        await supabase.from("integration_credentials").upsert({
          customer_id,
          integration_id: integrationId,
          ciphertext: blob.ciphertext,
          iv: blob.iv,
          auth_tag: blob.auth_tag,
          field_hints: fieldHints,
          status: result.allOk ? "active" : "failed",
          last_tested_at: new Date().toISOString(),
          last_test_outcome: result.allOk ? "ok" : "failed",
          last_test_error: result.allOk ? null : result.summary,
        }, { onConflict: "customer_id,integration_id" });
      } catch (e) {
        return json({ ...result, savedActive: false, persistError: (e as Error).message }, 200);
      }

      return json({ ...result, savedActive: result.allOk });
    }

    // POST /integrations/:id/save  → save credentials without flipping status to active
    const saveOnlyMatch = path.match(/^\/integrations\/([a-z0-9_-]+)\/save$/i);
    if (saveOnlyMatch && method === "POST") {
      const integrationId = saveOnlyMatch[1];
      const { customer_id, credentials } = body as {
        customer_id?: string; credentials?: Record<string, string>;
      };
      if (!customer_id || !UUID_RE.test(customer_id)) return json({ error: "invalid_customer_id" }, 400);
      if (!credentials || typeof credentials !== "object") return json({ error: "credentials required" }, 400);

      try {
        const typedCredentials = trimCredentialValues(credentials);
        // Preserve existing status if already active and nothing critical changed; otherwise mark pending.
        const { data: existing } = await supabase
          .from("integration_credentials")
          .select("status, field_hints, ciphertext, iv, auth_tag")
          .eq("customer_id", customer_id)
          .eq("integration_id", integrationId)
          .maybeSingle();

        let storedCredentials: Record<string, string> = {};
        try {
          storedCredentials = await decryptStoredCredentials(existing as Record<string, unknown> | null);
        } catch {
          storedCredentials = {};
        }
        const mergedCredentials = { ...storedCredentials, ...typedCredentials };
        const blob = Object.keys(mergedCredentials).length > 0
          ? await encryptCredentials(mergedCredentials)
          : null;
        const existingHints = (existing?.field_hints ?? {}) as Record<string, unknown>;
        const fieldHints = {
          ...existingHints,
          ...Object.fromEntries(Object.keys(mergedCredentials).map((k) => [k, true])),
        };
        const nextStatus = existing?.status === "active" ? "active" : "pending";
        const { error } = await supabase.from("integration_credentials").upsert({
          customer_id,
          integration_id: integrationId,
          ciphertext: blob?.ciphertext ?? null,
          iv: blob?.iv ?? null,
          auth_tag: blob?.auth_tag ?? null,
          field_hints: fieldHints,
          status: nextStatus,
        }, { onConflict: "customer_id,integration_id" });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, saved: true });
      } catch (e) {
        return json({ error: (e as Error).message }, 500);
      }
    }


    // ---- SEND Audit Log (industry invite logs) ----
    if (path === "/send-audit" && method === "GET") {
      const { data, error } = await supabase
        .from("industry_invite_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) return json({ error: error.message }, 400);
      return json({ logs: data ?? [] });
    }

    return json({ error: "not_found", path, method }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/**
 * Per-integration connection tests. Each tester receives the decrypted
 * credential payload and returns { ok, message? }. Tests must:
 *  - never throw on remote failures (catch & return ok:false)
 *  - never log credentials
 *  - timeout in ≤ 8s (signal AbortController)
 */

export interface TestResult {
  ok: boolean;
  message?: string;
}

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

type Creds = Record<string, string>;

const testers: Record<string, (c: Creds) => Promise<TestResult>> = {
  telnyx: async (c) => {
    if (!c.api_key) return { ok: false, message: "api_key required" };
    try {
      const r = await fetchWithTimeout("https://api.telnyx.com/v2/phone_numbers?page[size]=1", {
        headers: { Authorization: `Bearer ${c.api_key}` },
      });
      if (r.status === 401 || r.status === 403) return { ok: false, message: "Invalid Telnyx API key" };
      if (!r.ok) return { ok: false, message: `Telnyx returned HTTP ${r.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: `Network error: ${(e as Error).message}` };
    }
  },

  sales_chain: async (c) => {
    if (!c.base_url || !c.api_key) {
      return { ok: false, message: "base_url and api_key required" };
    }
    try {
      const u = new URL("/api/v1/ping", c.base_url).toString();
      const r = await fetchWithTimeout(u, { headers: { Authorization: `Bearer ${c.api_key}` } });
      // Sales Chain ping doesn't always exist; treat 404 with auth header accepted as "creds shape OK"
      if (r.status === 401 || r.status === 403) return { ok: false, message: "Invalid Sales Chain credentials" };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: `Cannot reach ${c.base_url}: ${(e as Error).message}` };
    }
  },

  eautomate: async (c) => {
    if (!c.base_url || !c.username || !c.password) {
      return { ok: false, message: "base_url, username and password required" };
    }
    try {
      const u = new URL("/odata/v1/$metadata", c.base_url).toString();
      const auth = btoa(`${c.username}:${c.password}`);
      const r = await fetchWithTimeout(u, { headers: { Authorization: `Basic ${auth}`, Accept: "application/xml" } });
      if (r.status === 401 || r.status === 403) return { ok: false, message: "Invalid E-Automate service account" };
      if (!r.ok) return { ok: false, message: `E-Automate OData returned HTTP ${r.status}` };
      const txt = await r.text();
      if (!txt.includes("EntityType")) return { ok: false, message: "Unexpected OData metadata response" };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: `Cannot reach ${c.base_url}: ${(e as Error).message}` };
    }
  },

  hubspot: async (c) => {
    if (!c.access_token) return { ok: false, message: "access_token required" };
    try {
      const r = await fetchWithTimeout("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
        headers: { Authorization: `Bearer ${c.access_token}` },
      });
      if (r.status === 401) return { ok: false, message: "Invalid HubSpot access token" };
      if (!r.ok) return { ok: false, message: `HubSpot returned HTTP ${r.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: `Network error: ${(e as Error).message}` };
    }
  },

  salesforce: async (c) => {
    if (!c.instance_url || !c.access_token) {
      return { ok: false, message: "instance_url and access_token required" };
    }
    try {
      const u = new URL("/services/data/v59.0/", c.instance_url).toString();
      const r = await fetchWithTimeout(u, { headers: { Authorization: `Bearer ${c.access_token}` } });
      if (r.status === 401) return { ok: false, message: "Invalid Salesforce session" };
      if (!r.ok) return { ok: false, message: `Salesforce returned HTTP ${r.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: `Network error: ${(e as Error).message}` };
    }
  },

  zapier: async (c) => {
    if (!c.webhook_url) return { ok: false, message: "webhook_url required" };
    try {
      const r = await fetchWithTimeout(c.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaosai_test: true, ts: new Date().toISOString() }),
      });
      if (!r.ok) return { ok: false, message: `Zapier hook returned HTTP ${r.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: `Cannot reach hook: ${(e as Error).message}` };
    }
  },

  slack: async (c) => {
    if (!c.webhook_url) return { ok: false, message: "webhook_url required" };
    try {
      const r = await fetchWithTimeout(c.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "PhaosAI integration test ✓" }),
      });
      if (!r.ok) return { ok: false, message: `Slack returned HTTP ${r.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: `Cannot reach Slack: ${(e as Error).message}` };
    }
  },

  sendgrid: async (c) => {
    if (!c.api_key) return { ok: false, message: "api_key required" };
    try {
      const r = await fetchWithTimeout("https://api.sendgrid.com/v3/scopes", {
        headers: { Authorization: `Bearer ${c.api_key}` },
      });
      if (r.status === 401) return { ok: false, message: "Invalid SendGrid API key" };
      if (!r.ok) return { ok: false, message: `SendGrid returned HTTP ${r.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: `Network error: ${(e as Error).message}` };
    }
  },
};

/** Generic fallback: any integration without a specific tester just validates required fields. */
export const REQUIRED_FIELDS: Record<string, string[]> = {
  telnyx: ["api_key"],
  sales_chain: ["base_url", "api_key"],
  eautomate: ["base_url", "username", "password"],
  hubspot: ["access_token"],
  salesforce: ["instance_url", "access_token"],
  zapier: ["webhook_url"],
  slack: ["webhook_url"],
  microsoft_teams: ["webhook_url"],
  sendgrid: ["api_key"],
  zendesk: ["subdomain", "api_token", "email"],
  gohighlevel: ["api_key", "location_id"],
  sms_gateway: ["provider", "api_key"],
  quickbooks: ["realm_id", "access_token"],
  docusign: ["account_id", "access_token"],
  papercut: ["base_url", "auth_token"],
  connectwise: ["base_url", "company_id", "public_key", "private_key"],
  freshservice: ["domain", "api_key"],
  servicenow: ["instance_url", "username", "password"],
  cal_com: ["api_key"],
  printanista: ["base_url", "api_key"],
  remote_tech: ["base_url", "api_key"],
  onedrive: ["tenant_id", "client_id", "client_secret"],
  sharp_odms: ["base_url", "api_key"],
};

export async function runIntegrationTest(
  integrationId: string,
  creds: Creds,
): Promise<TestResult> {
  const tester = testers[integrationId];
  if (tester) return tester(creds);

  // Generic field validation only
  const required = REQUIRED_FIELDS[integrationId] ?? [];
  const missing = required.filter((f) => !creds[f] || String(creds[f]).trim() === "");
  if (missing.length > 0) {
    return { ok: false, message: `Missing fields: ${missing.join(", ")}` };
  }
  return {
    ok: true,
    message: "Credentials saved (no live test available for this integration)",
  };
}

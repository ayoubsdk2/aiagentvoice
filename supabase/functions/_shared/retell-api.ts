// Thin REST client for Retell AI. Uses fetch + npm: pins only.
// Docs: https://docs.retellai.com/api-references

const RETELL_BASE = "https://api.retellai.com";

function authHeaders(): HeadersInit {
  const key = Deno.env.get("RETELL_API_KEY");
  if (!key) throw new Error("RETELL_API_KEY missing");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function retell<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${RETELL_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`retell ${init.method ?? "GET"} ${path} ${res.status}: ${body.slice(0, 500)}`);
  }
  return (body ? JSON.parse(body) : {}) as T;
}

export interface RetellAgent {
  agent_id: string;
  agent_name?: string;
  response_engine?: Record<string, unknown>;
  voice_id?: string;
  language?: string;
  webhook_url?: string;
  [k: string]: unknown;
}

export function getAgent(agentId: string): Promise<RetellAgent> {
  return retell<RetellAgent>(`/get-agent/${agentId}`);
}

// NOTE: Retell forbids creating new agents from a cloned base object (it errors
// with "Cannot specify version > 0 for new agent"). LIVE provisioning uses two
// shared base agents and never mints per-customer agents; per-tenant data is
// injected at call time via dynamic_variables. `updateAgent` scrubs read-only
// fields defensively for any residual admin usage.
const RETELL_READONLY_FIELDS = [
  "version",
  "agent_id",
  "last_modification_timestamp",
  "is_published",
] as const;

function stripReadonly(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  for (const k of RETELL_READONLY_FIELDS) delete out[k];
  const re = out.response_engine as Record<string, unknown> | undefined;
  if (re && typeof re === "object") {
    const { version: _v, ...rest } = re;
    out.response_engine = rest;
  }
  return out;
}

export function updateAgent(agentId: string, patch: Record<string, unknown>): Promise<RetellAgent> {
  return retell<RetellAgent>(`/update-agent/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(stripReadonly(patch)),
  });
}

export function deleteAgent(agentId: string): Promise<void> {
  return retell<void>(`/delete-agent/${agentId}`, { method: "DELETE" });
}

// Mint a short-lived WebRTC access token for browser sandbox calls.
export interface RetellWebCall {
  access_token: string;
  call_id: string;
  sample_rate?: number;
}

export function createWebCall(
  agentId: string,
  metadata?: Record<string, unknown>,
  retellLlmDynamicVariables?: Record<string, string>,
  overrides?: { agent_override?: Record<string, unknown> },
): Promise<RetellWebCall> {
  const body: Record<string, unknown> = { agent_id: agentId, metadata: metadata ?? {} };
  if (retellLlmDynamicVariables && Object.keys(retellLlmDynamicVariables).length) {
    body.retell_llm_dynamic_variables = retellLlmDynamicVariables;
  }
  if (overrides?.agent_override && Object.keys(overrides.agent_override).length) {
    // Per-call agent override — never mutates the saved agent.
    body.agent_override = overrides.agent_override;
  }
  return retell<RetellWebCall>("/v2/create-web-call", {
    method: "POST",
    body: JSON.stringify(body),
  });
}


// Phone-number BYO (Telnyx) registration with Retell. Retell binds each imported
// number to a shared base agent via inbound_agent_id / outbound_agent_id. No
// per-customer agent is created.
export interface RetellPhoneNumber {
  phone_number: string;
  agent_id?: string;
}

export function importPhoneNumber(args: {
  phone_number: string;
  termination_uri: string;
  sip_trunk_auth_username?: string;
  sip_trunk_auth_password?: string;
  nickname?: string;
  inbound_agent_id: string;
  outbound_agent_id?: string;
  inbound_webhook_url?: string;
}): Promise<RetellPhoneNumber> {
  return retell<RetellPhoneNumber>("/import-phone-number", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export function deletePhoneNumber(e164: string): Promise<void> {
  return retell<void>(`/delete-phone-number/${encodeURIComponent(e164)}`, { method: "DELETE" });
}

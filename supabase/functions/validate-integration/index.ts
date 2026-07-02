// Live-mode integration validator.
// In prototype mode the front-end never calls this function.
// In live mode the front-end calls it whenever a user toggles an integration ON.
// We perform a stub validation today (config completeness only) and persist
// is_active on the integrations table when validation succeeds.
//
// The shape of the response is stable so the UI can branch on `status`:
//   { status: "ok",     integrationId, message }
//   { status: "blocked", integrationId, reason: "missing_config" | "test_failed",
//       missingFields?: string[], failureMessage?: string,
//       manualInstructions: string[] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mirror of src/lib/integration-registry.ts (server-authoritative copy).
// Keep field keys in sync with the client registry.
type Field = { key: string; secret?: boolean };
type Def = {
  id: string;
  displayName: string;
  integrationType:
    | "sales_chain" | "eautomate" | "microsoft_365" | "google_workspace"
    | "webhook" | "telemetry_provider" | null;
  requiredConfigFields: Field[];
  manualInstructions: string[];
};

const INTEGRATION_DEFS: Record<string, Def> = {
  sales_chain: {
    id: "sales_chain", displayName: "Sales Chain", integrationType: "sales_chain",
    requiredConfigFields: [
      { key: "base_url" }, { key: "tenant_id" }, { key: "api_key", secret: true },
    ],
    manualInstructions: [
      "In Sales Chain, open Admin → API Keys and create a service key with lead.write scope.",
      "Copy the tenant ID from Admin → Account Settings.",
      "Have a Phaos admin save these values on the customer record, then click Retry validation.",
    ],
  },
  eautomate: {
    id: "eautomate", displayName: "EAutomate (ECI)", integrationType: "eautomate",
    requiredConfigFields: [
      { key: "host" }, { key: "username" }, { key: "password", secret: true },
    ],
    manualInstructions: [
      "Create a dedicated EAutomate service account with dispatch read/write permissions.",
      "Confirm the EAutomate host is reachable from Phaos infrastructure.",
      "Have a Phaos admin store the credentials and re-run validation.",
    ],
  },
  sharp_odms: {
    id: "sharp_odms", displayName: "Sharp ODMS", integrationType: "telemetry_provider",
    requiredConfigFields: [{ key: "tenant_id" }, { key: "api_key", secret: true }],
    manualInstructions: [
      "Request a Sharp ODMS API key for this customer's fleet.",
      "Provide the tenant ID and API key to Phaos; we'll store and validate them.",
    ],
  },
  printanista: {
    id: "printanista", displayName: "Printanista", integrationType: "telemetry_provider",
    requiredConfigFields: [{ key: "account_id" }, { key: "api_token", secret: true }],
    manualInstructions: [
      "From Printanista → Settings → API, generate an integration token.",
      "Send the account ID and token to Phaos for secure storage.",
    ],
  },
  remote_tech: {
    id: "remote_tech", displayName: "Remote Tech", integrationType: "telemetry_provider",
    requiredConfigFields: [{ key: "endpoint_url" }, { key: "api_key", secret: true }],
    manualInstructions: [
      "Provision a Remote Tech integration user and copy the endpoint URL + API key.",
      "Phaos will save the credentials and re-test the connection.",
    ],
  },
  onedrive: {
    id: "onedrive", displayName: "OneDrive", integrationType: "microsoft_365",
    requiredConfigFields: [
      { key: "tenant_id" }, { key: "client_id" }, { key: "client_secret", secret: true },
    ],
    manualInstructions: [
      "In Entra ID, register a new app and grant Files.ReadWrite.All (application).",
      "Generate a client secret and provide all three values to a Phaos admin.",
    ],
  },
  zapier: {
    id: "zapier", displayName: "Zapier", integrationType: "webhook",
    requiredConfigFields: [{ key: "webhook_url" }],
    manualInstructions: [
      "In Zapier, create a Zap that starts with 'Webhooks by Zapier → Catch Hook' and copy the URL.",
      "Paste the URL into the Phaos integration record, then retry validation.",
    ],
  },
  hubspot: {
    id: "hubspot", displayName: "HubSpot", integrationType: "webhook",
    requiredConfigFields: [{ key: "portal_id" }, { key: "private_app_token", secret: true }],
    manualInstructions: [
      "In HubSpot, create a Private App with crm.objects.contacts.write scope.",
      "Save the portal ID and access token on the customer record.",
    ],
  },
  salesforce: {
    id: "salesforce", displayName: "Salesforce", integrationType: "webhook",
    requiredConfigFields: [
      { key: "instance_url" }, { key: "client_id" },
      { key: "client_secret", secret: true }, { key: "refresh_token", secret: true },
    ],
    manualInstructions: [
      "Create a Connected App in Salesforce with API + refresh_token scopes.",
      "Run the OAuth flow once to obtain a refresh token, then hand all values to Phaos.",
    ],
  },
  zendesk: {
    id: "zendesk", displayName: "Zendesk", integrationType: "webhook",
    requiredConfigFields: [{ key: "subdomain" }, { key: "email" }, { key: "api_token", secret: true }],
    manualInstructions: ["Generate a Zendesk API token for the integration user and send it to Phaos."],
  },
  slack: {
    id: "slack", displayName: "Slack", integrationType: "webhook",
    requiredConfigFields: [{ key: "webhook_url", secret: true }],
    manualInstructions: [
      "In Slack, install the 'Incoming Webhooks' app and create a webhook for the target channel.",
      "Paste the webhook URL into the customer record and retry validation.",
    ],
  },
  microsoft_teams: {
    id: "microsoft_teams", displayName: "Microsoft Teams", integrationType: "webhook",
    requiredConfigFields: [{ key: "webhook_url", secret: true }],
    manualInstructions: ["Add an Incoming Webhook connector to a Teams channel and provide the URL."],
  },
  gohighlevel: {
    id: "gohighlevel", displayName: "GoHighLevel", integrationType: "webhook",
    requiredConfigFields: [{ key: "location_id" }, { key: "api_key", secret: true }],
    manualInstructions: ["From GHL, copy the API key under Settings → Business Info."],
  },
  sms_gateway: {
    id: "sms_gateway", displayName: "SMS Gateway", integrationType: "webhook",
    requiredConfigFields: [
      { key: "provider" }, { key: "account_sid" },
      { key: "auth_token", secret: true }, { key: "from_number" },
    ],
    manualInstructions: [
      "Provision an outbound number with your carrier and create an API user.",
      "Provide credentials and the E.164 from-number to Phaos.",
    ],
  },
  sendgrid: {
    id: "sendgrid", displayName: "SendGrid", integrationType: "webhook",
    requiredConfigFields: [{ key: "api_key", secret: true }, { key: "from_email" }],
    manualInstructions: ["Create a SendGrid API key with mail.send scope and verify the sender email."],
  },
  quickbooks: {
    id: "quickbooks", displayName: "QuickBooks", integrationType: "webhook",
    requiredConfigFields: [{ key: "realm_id" }, { key: "refresh_token", secret: true }],
    manualInstructions: ["Complete the QuickBooks OAuth flow once and store the refresh token + realm ID."],
  },
  docusign: {
    id: "docusign", displayName: "DocuSign", integrationType: "webhook",
    requiredConfigFields: [
      { key: "account_id" }, { key: "integration_key" }, { key: "user_id" },
      { key: "private_key", secret: true },
    ],
    manualInstructions: ["Create a DocuSign integration key and configure JWT auth for the service user."],
  },
  papercut: {
    id: "papercut", displayName: "PaperCut", integrationType: "webhook",
    requiredConfigFields: [{ key: "server_url" }, { key: "auth_token", secret: true }],
    manualInstructions: ["Enable Web Services on your PaperCut server and provision an auth token."],
  },
  connectwise: {
    id: "connectwise", displayName: "ConnectWise", integrationType: "webhook",
    requiredConfigFields: [
      { key: "site" }, { key: "company_id" },
      { key: "public_key" }, { key: "private_key", secret: true },
    ],
    manualInstructions: ["Create an API member in ConnectWise and copy the public/private key pair."],
  },
  freshservice: {
    id: "freshservice", displayName: "FreshService", integrationType: "webhook",
    requiredConfigFields: [{ key: "domain" }, { key: "api_key", secret: true }],
    manualInstructions: ["Generate a FreshService API key from the agent profile and send it to Phaos."],
  },
  servicenow: {
    id: "servicenow", displayName: "ServiceNow", integrationType: "webhook",
    requiredConfigFields: [
      { key: "instance_url" }, { key: "username" }, { key: "password", secret: true },
    ],
    manualInstructions: ["Create a dedicated ServiceNow integration user with rest_service role."],
  },
  cal_com: {
    id: "cal_com", displayName: "Cal.com", integrationType: "webhook",
    requiredConfigFields: [{ key: "api_key", secret: true }],
    manualInstructions: ["Generate an API key in Cal.com → Settings → Developer."],
  },
};

async function authenticateRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = await authenticateRequest(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { customerId?: string; integrationId?: string; action?: "enable" | "disable" };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { customerId, integrationId, action = "enable" } = body;
  if (!customerId || !integrationId) {
    return badRequest("customerId and integrationId are required");
  }

  const def = INTEGRATION_DEFS[integrationId];
  if (!def) return badRequest(`Unknown integration: ${integrationId}`);

  // Cross-tenant guard: caller must belong to customerId or be phaos_admin.
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
  );
  const { data: tenantId } = await userClient.rpc("tenant_of", { _user_id: userId });
  const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: userId, _role: "phaos_admin" });
  if (tenantId !== customerId && !isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service-role client for cross-tenant writes (RLS bypass for is_active update)
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ─── DISABLE branch ──────────────────────────────────────
  if (action === "disable") {
    if (def.integrationType) {
      await admin.from("integrations").update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("customer_id", customerId).eq("type", def.integrationType);
    }
    await admin.rpc("log_audit_event", {
      _action: "integration.disabled",
      _resource_type: "integration",
      _resource_id: integrationId,
      _customer_id: customerId,
      _metadata: { integration_id: integrationId, by_user: userId },
    });
    return new Response(JSON.stringify({ status: "ok", integrationId, message: "Disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── ENABLE branch ───────────────────────────────────────
  // Step 1: load existing config (if any) for this customer + type.
  let configJson: Record<string, unknown> = {};
  if (def.integrationType) {
    const { data } = await admin.from("integrations").select("config_json")
      .eq("customer_id", customerId).eq("type", def.integrationType).maybeSingle();
    if (data?.config_json && typeof data.config_json === "object") {
      configJson = data.config_json as Record<string, unknown>;
    }
  }

  // Step 2: completeness check.
  const missing: string[] = [];
  for (const f of def.requiredConfigFields) {
    const v = configJson[f.key];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      missing.push(f.key);
    }
  }

  if (missing.length > 0) {
    await admin.rpc("log_audit_event", {
      _action: "integration.enable_blocked",
      _resource_type: "integration",
      _resource_id: integrationId,
      _customer_id: customerId,
      _metadata: {
        integration_id: integrationId,
        outcome: "blocked_missing_config",
        missing_fields: missing,           // field NAMES only, never values
        by_user: userId,
      },
    });
    return new Response(JSON.stringify({
      status: "blocked",
      integrationId,
      reason: "missing_config",
      missingFields: missing,
      manualInstructions: def.manualInstructions,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Step 3: stub auth-ping. In a future pass this will become a real HTTP call
  // per integration. For now the presence of all required fields is enough.
  // (Real validators must NEVER log secret values — only outcome + duration.)
  const testPassed = true;
  const failureMessage: string | null = null;

  if (!testPassed) {
    await admin.rpc("log_audit_event", {
      _action: "integration.enable_blocked",
      _resource_type: "integration",
      _resource_id: integrationId,
      _customer_id: customerId,
      _metadata: {
        integration_id: integrationId,
        outcome: "blocked_test_failure",
        failure_message: failureMessage,
        by_user: userId,
      },
    });
    return new Response(JSON.stringify({
      status: "blocked",
      integrationId,
      reason: "test_failed",
      failureMessage,
      manualInstructions: def.manualInstructions,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Step 4: persist is_active = true. Upsert by (customer_id, type).
  if (def.integrationType) {
    const { data: existing } = await admin.from("integrations").select("id")
      .eq("customer_id", customerId).eq("type", def.integrationType).maybeSingle();
    if (existing?.id) {
      await admin.from("integrations").update({
        is_active: true, updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await admin.from("integrations").insert({
        customer_id: customerId, type: def.integrationType, is_active: true, config_json: configJson,
      });
    }
  }

  await admin.rpc("log_audit_event", {
    _action: "integration.enabled",
    _resource_type: "integration",
    _resource_id: integrationId,
    _customer_id: customerId,
    _metadata: { integration_id: integrationId, outcome: "success", by_user: userId },
  });

  return new Response(JSON.stringify({
    status: "ok", integrationId, message: `${def.displayName} enabled`,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

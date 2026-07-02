/**
 * Central registry of integration definitions for live-mode validation.
 * Each entry describes the config fields a customer must provide and the
 * test procedure used to confirm the integration is actually wired up.
 *
 * The same `id` value is sent to the `validate-integration` edge function;
 * keep this list in sync with the server-side INTEGRATION_DEFS map.
 */

export type IntegrationKind = "erp" | "available";

export interface IntegrationConfigField {
  /** key inside integrations.config_json */
  key: string;
  label: string;
  /** true → value is treated as a secret and never echoed back */
  secret?: boolean;
  example?: string;
}

export type TestProcedure =
  | { kind: "config_only"; description: string }
  | { kind: "auth_ping"; description: string; endpointHint?: string }
  | { kind: "manual"; description: string };

export interface IntegrationDefinition {
  id: string;                        // stable id used by UI + edge function
  displayName: string;
  kind: IntegrationKind;
  /** maps to public.integration_type enum; null → not persisted yet */
  integrationType:
    | "sales_chain" | "eautomate" | "microsoft_365" | "google_workspace"
    | "webhook" | "telemetry_provider" | null;
  requiredConfigFields: IntegrationConfigField[];
  testProcedure: TestProcedure;
  /** Plain‑English steps shown when validation is blocked. */
  manualInstructions: string[];
}

export const INTEGRATION_DEFINITIONS: IntegrationDefinition[] = [
  // ─── ERP & Industry ────────────────────────────────────────
  {
    id: "sales_chain",
    displayName: "SalesChain",
    kind: "erp",
    integrationType: "sales_chain",
    requiredConfigFields: [
      { key: "base_url", label: "SalesChain Base URL", example: "https://api.saleschain.com" },
      { key: "tenant_id", label: "Tenant / Account ID", example: "e.g. acme-corp" },
      { key: "api_key", label: "Personal API Key", secret: true, example: "Generated under Settings → Integrations → API" },
    ],
    testProcedure: {
      kind: "auth_ping",
      description: "Authenticate against SalesChain and confirm the tenant ID resolves.",
    },
    manualInstructions: [
      "In SalesChain, open Settings → Integrations → API and create a personal API key with lead.write scope.",
      "Copy your account/tenant ID from Settings → Account.",
      "Paste the base URL, tenant ID, and key here, then click Test Connection.",
    ],
  },
  {
    id: "eautomate",
    displayName: "E-automate",
    kind: "erp",
    integrationType: "eautomate",
    requiredConfigFields: [
      { key: "base_url", label: "Web Services URL", example: "https://eautomate.yourco.com/api" },
      { key: "username", label: "Service-account Username", example: "phaos_integration" },
      { key: "password", label: "Service-account Password", secret: true, example: "••••••••" },
    ],
    testProcedure: {
      kind: "auth_ping",
      description: "Open an OData session against E-automate Web Services and verify the service account is active.",
    },
    manualInstructions: [
      "Your IT admin enables E-automate Web Services on your own server (System Tables → Web Services).",
      "Create a dedicated integration user with read/write rights — no ECI ticket required.",
      "Paste the URL + credentials here and click Test Connection.",
    ],
  },
  {
    id: "printanista",
    displayName: "Printanista",
    kind: "erp",
    integrationType: "telemetry_provider",
    requiredConfigFields: [
      { key: "base_url", label: "Tenant Base URL", example: "https://yourco.printanista.net" },
      { key: "username", label: "Integration-user Username", example: "phaos_integration" },
      { key: "password", label: "Integration-user Password", secret: true, example: "••••••••" },
    ],
    testProcedure: {
      kind: "auth_ping",
      description: "Authenticate against the Printanista tenant and list devices.",
    },
    manualInstructions: [
      "Your Printanista admin creates an integration user under Settings → Users (no ECI ticket required).",
      "Copy the tenant base URL from your browser address bar.",
      "Paste the URL + credentials here and click Test Connection.",
    ],
  },

  {
    id: "remote_tech",
    displayName: "Remote Tech",
    kind: "erp",
    integrationType: "telemetry_provider",
    requiredConfigFields: [
      { key: "endpoint_url", label: "Remote Tech endpoint URL" },
      { key: "api_key", label: "API key", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "Authenticate against the Remote Tech control plane." },
    manualInstructions: [
      "Provision a Remote Tech integration user and copy the endpoint URL + API key.",
      "Phaos will save the credentials and re-test the connection.",
    ],
  },
  {
    id: "onedrive",
    displayName: "OneDrive",
    kind: "erp",
    integrationType: "microsoft_365",
    requiredConfigFields: [
      { key: "tenant_id", label: "Microsoft tenant ID" },
      { key: "client_id", label: "App registration client ID" },
      { key: "client_secret", label: "Client secret", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "Acquire an app-only token from Microsoft Identity." },
    manualInstructions: [
      "In Entra ID, register a new app and grant Files.ReadWrite.All (application).",
      "Generate a client secret and provide all three values to a Phaos admin.",
    ],
  },

  // ─── Available integrations ────────────────────────────────
  {
    id: "zapier",
    displayName: "Zapier",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "webhook_url", label: "Zapier catch-hook URL", example: "https://hooks.zapier.com/..." },
    ],
    testProcedure: { kind: "auth_ping", description: "POST a sample payload to the catch hook." },
    manualInstructions: [
      "In Zapier, create a Zap that starts with 'Webhooks by Zapier → Catch Hook' and copy the URL.",
      "Paste the URL into the Phaos integration record, then retry validation.",
    ],
  },
  {
    id: "hubspot",
    displayName: "HubSpot",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "hubspot_form_guid", label: "HubSpot Form GUID", example: "9xxxxxx9-99x9-9x99-9999-9x9999x99xxx" },
      { key: "portal_id", label: "HubSpot Portal ID", example: "123456789" },
      { key: "private_app_token", label: "HubSpot Service Key", secret: true, example: "xxx-xx9-xxx99999-x99x-99x9-x999-99xx999x99xx" },
    ],
    testProcedure: { kind: "auth_ping", description: "Call HubSpot /account-info/v3/details with the token." },
    manualInstructions: [
      "In HubSpot, create a Private App with crm.objects.contacts.write scope.",
      "Save the portal ID and access token on the customer record.",
    ],
  },
  {
    id: "salesforce",
    displayName: "Salesforce",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "instance_url", label: "Salesforce instance URL" },
      { key: "client_id", label: "Connected app client ID" },
      { key: "client_secret", label: "Connected app secret", secret: true },
      { key: "refresh_token", label: "OAuth refresh token", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "Exchange the refresh token for an access token." },
    manualInstructions: [
      "Create a Connected App in Salesforce with API + refresh_token scopes.",
      "Run the OAuth flow once to obtain a refresh token, then hand all values to Phaos.",
    ],
  },
  {
    id: "zendesk",
    displayName: "Zendesk",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "subdomain", label: "Zendesk subdomain" },
      { key: "email", label: "Agent email" },
      { key: "api_token", label: "API token", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "GET /api/v2/users/me with basic auth." },
    manualInstructions: ["Generate a Zendesk API token for the integration user and send it to Phaos."],
  },
  {
    id: "slack",
    displayName: "Slack",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "webhook_url", label: "Incoming webhook URL", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "POST a silent ping to the Slack webhook." },
    manualInstructions: [
      "In Slack, install the 'Incoming Webhooks' app and create a webhook for the target channel.",
      "Paste the webhook URL into the customer record and retry validation.",
    ],
  },
  {
    id: "microsoft_teams",
    displayName: "Microsoft Teams",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "webhook_url", label: "Incoming webhook URL", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "POST a silent ping to the Teams webhook." },
    manualInstructions: ["Add an Incoming Webhook connector to a Teams channel and provide the URL."],
  },
  {
    id: "gohighlevel",
    displayName: "GoHighLevel",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "location_id", label: "Location ID" },
      { key: "api_key", label: "API key", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "Validate the GHL API key against the location." },
    manualInstructions: ["From GHL, copy the API key under Settings → Business Info."],
  },
  {
    id: "sms_gateway",
    displayName: "SMS Gateway",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "provider", label: "Carrier name (e.g. Telnyx, Bandwidth)" },
      { key: "account_sid", label: "Account / API user" },
      { key: "auth_token", label: "Auth token", secret: true },
      { key: "from_number", label: "Outbound phone number (E.164)" },
    ],
    testProcedure: { kind: "auth_ping", description: "Authenticate against the carrier API." },
    manualInstructions: [
      "Provision an outbound number with your carrier and create an API user.",
      "Provide credentials and the E.164 from-number to Phaos.",
    ],
  },
  {
    id: "sendgrid",
    displayName: "SendGrid",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "api_key", label: "SendGrid API key", secret: true },
      { key: "from_email", label: "Verified sender email" },
    ],
    testProcedure: { kind: "auth_ping", description: "Call SendGrid /v3/scopes with the API key." },
    manualInstructions: ["Create a SendGrid API key with mail.send scope and verify the sender email."],
  },
  {
    id: "quickbooks",
    displayName: "QuickBooks",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "realm_id", label: "QuickBooks realm/company ID" },
      { key: "refresh_token", label: "OAuth refresh token", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "Refresh the QuickBooks OAuth token." },
    manualInstructions: ["Complete the QuickBooks OAuth flow once and store the refresh token + realm ID."],
  },
  {
    id: "docusign",
    displayName: "DocuSign",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "account_id", label: "DocuSign account ID" },
      { key: "integration_key", label: "Integration key" },
      { key: "user_id", label: "Impersonated user ID" },
      { key: "private_key", label: "RSA private key", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "Perform a JWT grant to obtain an access token." },
    manualInstructions: ["Create a DocuSign integration key and configure JWT auth for the service user."],
  },
  {
    id: "papercut",
    displayName: "PaperCut",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "server_url", label: "PaperCut server URL" },
      { key: "auth_token", label: "Web Services auth token", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "Call PaperCut Web Services API with the token." },
    manualInstructions: ["Enable Web Services on your PaperCut server and provision an auth token."],
  },
  {
    id: "connectwise",
    displayName: "ConnectWise",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "site", label: "ConnectWise site (e.g. na.myconnectwise.net)" },
      { key: "company_id", label: "Company ID" },
      { key: "public_key", label: "API public key" },
      { key: "private_key", label: "API private key", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "Authenticate against the ConnectWise REST API." },
    manualInstructions: ["Create an API member in ConnectWise and copy the public/private key pair."],
  },
  {
    id: "freshservice",
    displayName: "FreshService",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "domain", label: "Freshservice domain (e.g. acme.freshservice.com)" },
      { key: "api_key", label: "API key", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "GET /api/v2/agents/me with basic auth." },
    manualInstructions: ["Generate a FreshService API key from the agent profile and send it to Phaos."],
  },
  {
    id: "servicenow",
    displayName: "ServiceNow",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "instance_url", label: "ServiceNow instance URL" },
      { key: "username", label: "Service account username" },
      { key: "password", label: "Service account password", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "Authenticate to ServiceNow REST API." },
    manualInstructions: ["Create a dedicated ServiceNow integration user with rest_service role."],
  },
  {
    id: "cal_com",
    displayName: "Cal.com",
    kind: "available",
    integrationType: "webhook",
    requiredConfigFields: [
      { key: "api_key", label: "Cal.com API key", secret: true },
    ],
    testProcedure: { kind: "auth_ping", description: "GET /v1/me with the Cal.com API key." },
    manualInstructions: ["Generate an API key in Cal.com → Settings → Developer."],
  },
];

export function getIntegrationById(id: string): IntegrationDefinition | undefined {
  return INTEGRATION_DEFINITIONS.find((d) => d.id === id);
}


## Root cause

`provision-client` currently calls Retell `POST /create-agent` (via `cloneAgent`) for every "unique" line. Retell rejects that with `400 "Cannot specify version > 0 for new agent"` because the cloned body carries `version` from the base agent. That is why nothing provisions and no Telnyx number is purchased — the whole batch rolls back on the first Retell call.

Retell's own guidance: don't clone. Bind each Telnyx number to one of the two existing base agents and inject per‑customer data at call time via `dynamic_variables`.

## Answer to your question

**No, I don't need a new Telnyx API key from you.** Telnyx credentials are already wired (`TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`) and Telnyx is not what's failing — the batch dies at the Retell clone step before Telnyx billing settles the purchase, so the number gets released during rollback.

The only new secrets I need are the Retell↔Telnyx SIP trunk credentials so `import-phone-number` can be called with a `termination_uri` + trunk auth (per Retell's spec). If those already exist as Telnyx SIP trunk credentials on your account, I'll ask for them once via `add_secret` (`TELNYX_SIP_TERMINATION_URI`, `TELNYX_SIP_TRUNK_USERNAME`, `TELNYX_SIP_TRUNK_PASSWORD`). Nothing else.

## Changes

### 1. `supabase/functions/provision-client/index.ts` — remove cloning, bind shared agents

Per line:
1. `baseAgentId = resolveBaseAgentId(line.industry_id)` — Document Solutions → `agent_33d6c5549eb8ed8203fd5b6537`, everything else → `agent_281c022afc5fd87515a3a7956a`.
2. Telnyx: `searchNumberByAreaCode` → `purchaseNumber` → `attachToConnection` (unchanged).
3. Retell `POST /import-phone-number` with `phone_number`, `termination_uri`, `sip_trunk_auth_username/password`, `inbound_agent_id = baseAgentId`, `outbound_agent_id = baseAgentId`, `inbound_webhook_url = <SUPABASE_URL>/functions/v1/retell-inbound`, `nickname`. **No** `version`, `agent_id`, `is_published`, `last_modification_timestamp`, or `response_engine.version`.
4. "Clone of Line 1" routing → reuse Line 1's `baseAgentId` + variables + `custom_instructions`. Never mints an agent.
5. Persist per-line record keyed by E.164: `company_id`, `base_agent_id`, `industry_id`, `custom_instructions` (from the optional system-prompt override), plus dynamic-variable values (`company_name`, `assistant_name`, `vip_greeting`, `integration_base_url`, `integration_api_key`, `transfer_number`, and for the generic agent `industry` + `industry_addendum`, for Doc Solutions `supply_team_number`).
6. Rollback on any failure: release every Telnyx number bought in this batch AND `DELETE /delete-phone-number/<E164>` for every number already imported to Retell. Also delete `live_accounts` / `live_account_agents` / `live_account_phone_numbers` rows inserted this batch.
7. Also strip read‑only fields defensively from any remaining Retell create/update helpers in `_shared/retell-api.ts`.

### 2. `supabase/functions/_shared/retell-api.ts`

- Add `importPhoneNumber({ phone_number, termination_uri, sip_trunk_auth_username, sip_trunk_auth_password, inbound_agent_id, outbound_agent_id, inbound_webhook_url, nickname })`.
- Add `deletePhoneNumber(e164)`.
- Delete/mark‑unused `cloneAgent`. Any residual create/update path scrubs `version`, `agent_id`, `last_modification_timestamp`, `is_published`, `response_engine.version` before sending.

### 3. `supabase/functions/retell-inbound/index.ts` (create)

- Verify Retell signature.
- On `event = call_inbound`, look up `live_account_phone_numbers` by `call_inbound.to_number`.
- Not found / account inactive → `200` with `{ call_inbound: {} }` (rejects).
- Found → `200` with `{ call_inbound: { override_agent_id: <line.base_agent_id>, dynamic_variables: { …contract… } } }`. Never sends `general_prompt`.

### 4. DB (single small migration)

Add to `live_account_agents`:
- `base_agent_id text not null default 'agent_281c022afc5fd87515a3a7956a'`
- `custom_instructions text`
- `dynamic_vars jsonb not null default '{}'::jsonb`

Add to `live_accounts`:
- `integration_base_url text`, `integration_api_key text`, `transfer_number text`, `supply_team_number text`, `vip_greeting text`

Standard GRANTs + RLS unchanged (service‑role writes only from edge functions).

### 5. `src/components/admin/ProvisionClientDialog.tsx`

- Keep the industry dropdown + area-code tooltip.
- Change helper text: "Unique agent" = uses that industry's shared base agent with its own variables; "Clone of Line 1" = reuses Line 1's config. Nothing creates a Retell agent.
- After success, the per‑line panel edits `custom_instructions` (System prompt override), `assistant_name`, `vip_greeting`, `transfer_number`, and (for Doc Solutions) `supply_team_number` — all saved via `admin-api PATCH /agents/:id`.

### 6. `admin-api` — accept the new fields

`POST /agents` and `PATCH /agents/:id` accept `base_agent_id`, `industry_id`, `custom_instructions`, and the dynamic-variable fields. No agent-mint path.

### 7. Retell/Vapi UI copy sweep (LIVE Accounts only)

`LiveAccountsAdmin.tsx`, `LiveAccountIntegrationsPanel.tsx`, Routing & Prompt tab, tooltips, "Primary Vapi Assistant ID" → "Primary Retell Agent ID". Sandbox untouched.

### 8. Outbound (if/when used)

`create-phone-call` uses `override_agent_id = baseAgentId` + `retell_llm_dynamic_variables`. No cloning.

## Secrets I'll request (one add_secret round if missing)

- `TELNYX_SIP_TERMINATION_URI` (e.g. `sip.telnyx.com` or your subdomain)
- `TELNYX_SIP_TRUNK_USERNAME`
- `TELNYX_SIP_TRUNK_PASSWORD`

`RETELL_API_KEY`, `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, `SUPABASE_SERVICE_ROLE_KEY` already exist — I won't ask again.

## Verification

1. Provision "Test 1", area `407`, industry General Business, override "this is a test" → toast "Provisioned 1 line(s)", Telnyx number appears, Retell dashboard shows the number bound to `agent_281c022afc5fd87515a3a7956a` (no new agent created), row appears in `/admin/accounts`, top-bar Company dropdown shows Test 1.
2. Second run with Document Solutions → number bound to `agent_33d6c5549eb8ed8203fd5b6537`.
3. Force a Retell import failure → Telnyx number released, no orphan rows, no orphan Retell imports.
4. Place a real inbound call → `retell-inbound` returns `override_agent_id` + variables; call answers with the right `assistant_name` and `custom_instructions`.
5. Sandbox unchanged.

## Out of scope

Sandbox, Stripe webhook flow, renaming existing `vapi_assistant_id*` columns (kept for type stability — `retell_agent_id` mirrors it).

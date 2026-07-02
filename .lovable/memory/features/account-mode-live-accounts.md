---
name: account-mode-live-accounts
description: Prototype/Live account mode split unlocked by access codes managed by Phaos admin
type: feature
---
# Account Mode (Prototype ↔ Live)

## Schema
- **public.live_accounts**: customer_id → access_code mapping. Code is free-form text, min 5 chars (CHECK), unique, case-sensitive. Has `display_name`, `is_active`, `notes`. RLS: only `phaos_admin` role can SELECT/INSERT/UPDATE/DELETE.
- **profiles** extended with `last_mode` ('prototype' | 'live') and `last_live_customer_id` (FK customers, nullable, ON DELETE SET NULL).

## SECURITY DEFINER RPCs (only way for non-admins to interact)
- `redeem_live_access_code(_code text)` — validates code, sets profile to live + binds customer, returns `{customer_id, display_name}`. Returns empty if no match (never tells you which codes exist).
- `get_my_live_account()` — returns the bound live customer's display_name for the current user (no code exposed).
- `set_account_mode(_mode text)` — persists prototype/live preference on profile.

## Frontend
- `src/contexts/AccountModeContext.tsx` provides `useAccountMode()` exposing `mode`, `liveAccount`, `currentLiveCustomerId`, `liveUnlocked`, `redeemCode`, `setMode`, `clearLive`.
- Hybrid persistence: mode preference in localStorage `phaos:accountMode`; bound customer on profile via `get_my_live_account()`.
- Default mode for any new/anon user is **prototype**. Cannot enter live mode without a successfully redeemed code.
- `TopHeader.tsx` shows: code input (left of Operational dot), Mode pill, prototype/live toggle (only after unlock), and × to sign out of live.
- `LiveAccountsAdmin.tsx` (sidebar tab "Live Accounts", shown only to `phaos_admin`): create/rotate/disable/delete mappings.

## Orchestrator scoping (future)
- Read `currentLiveCustomerId` from `useAccountMode()` to pass into Vapi/orchestrator calls when implementing live wiring. Currently scaffold-only — Sandbox and dashboards still use demo data regardless of mode.

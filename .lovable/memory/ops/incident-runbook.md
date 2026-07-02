---
name: Incident Runbook
description: P1/P2 definitions, kill-switch usage, escalation paths
type: feature
---

# Incident Runbook

## Severity
- **P1 (15 min response):** Data breach, total auth outage, payment system failure.
- **P2 (1h response):** Sandbox down, compliance toggle malfunction, single tenant blocked.
- **P3 (next business day):** Cosmetic, single-user complaints, non-critical metric drift.

## Kill Switches (`public.kill_switches`)
- `panic_ai_disabled` → halts ALL AI invocations across tenants.
- `outbound_voice_paused` / `outbound_sms_paused` / `outbound_email_paused` → channel-specific stops.
- `payments_paused` → blocks billing flows.
- Toggle via Compliance Hub → Kill Switches section (customer_admin or phaos_admin).

## On-call (TODO — external)
- Set up PagerDuty/Opsgenie rotation for daniel@phaosai.com + future ops hires.
- Status page is hosted in-app at `/status` (admin-only initially).

## Forensics
- Query `audit_events` filtered by time window + actor_user_id.
- `suspicious_login_activity` view surfaces 5+ failed logins per IP in 24h.
- `notify-security-event` edge function emails admin on suspicious patterns.

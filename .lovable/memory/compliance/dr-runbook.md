---
name: Disaster Recovery Runbook
description: RTO/RPO targets, restore procedure, drill cadence, and ownership for Phaos AI
type: feature
---

# Disaster Recovery Runbook

## Targets
- **RTO (Recovery Time Objective):** ≤ 4 hours from declared incident to restored read/write capability for the production tenant set.
- **RPO (Recovery Point Objective):** ≤ 5 minutes via Supabase Point-in-Time Recovery (WAL streaming).
- **Tier-1 dependencies:** Lovable Cloud (Supabase), Vapi, ElevenLabs, Resend. Each has an independent SLA; an outage in one does NOT trigger DR for the others.

## Backup Inventory
| Asset | Mechanism | Retention | Owner |
|------|-----------|-----------|-------|
| Postgres (all tenants) | Supabase managed daily snapshots + PITR | 7 days (default plan); upgradeable to 28 days | Daniel @ Phaos AI |
| Edge function source | Git history (`supabase/functions/`) | Indefinite | Daniel @ Phaos AI |
| Application source | Git history + Lovable workspace | Indefinite | Daniel @ Phaos AI |
| Integration credentials | `integration_credentials` (AES-GCM in Postgres) — covered by DB backup | Same as DB | Daniel @ Phaos AI |
| Secrets (API keys) | Lovable Cloud Secrets Manager (encrypted) | Until rotated | Daniel @ Phaos AI |

## Restore Procedure (Severity-1 data loss)
1. **Declare incident** in `audit_events` with action `dr.incident.declared`.
2. **Engage kill switches**: set `panic_ai_disabled = true` and all `outbound_*_paused = true` on the affected tenant(s) to prevent further data divergence.
3. **Identify restore target**: a UTC timestamp within the PITR window, ideally ≤ 2 minutes before the incident's first symptom.
4. **Open Lovable Cloud → Database → Backups** (admin-only) and trigger Point-in-Time Restore to the chosen timestamp.
5. **Validate**: run `select count(*) from public.audit_events where created_at > '<restore_ts>'` — should be 0.
6. **Re-deploy edge functions** from `git rev-parse HEAD` to ensure code matches restored schema.
7. **Smoke test** via the `/status` page (admin) and `sandbox-health-check` edge function.
8. **Disengage kill switches** once smoke tests pass.
9. **Post-mortem within 72h**, filed under `governance_settings` doc_type `dr_postmortem`.

## Drill Cadence
- **Quarterly (every Q1/Q3):** Restore drill to a non-production project; record duration in `compliance_program_reviews` (scope: `dr_drill`).
- **Annually:** Cross-region failover tabletop exercise.
- **Last drill:** TODO — record once first drill is performed.

## Communication
- **Internal:** Slack #ops-incidents (TODO — channel not yet created).
- **External (customers):** Status page at `/status` + email blast via Resend to `customers.primary_contact_email`.
- **Regulator notification:** GDPR 72-hour breach window applies if EU PII is affected; HIPAA 60-day window for PHI. Coordinated through `dsar_requests` workflow.

## Rollback Triggers (auto-revert restore)
- Audit log row count after restore < 90% of pre-incident snapshot.
- Any RLS policy missing in `pg_policies` that was present pre-incident.
- More than 5% of `customers` rows missing.

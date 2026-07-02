---
name: Data Protection Policy
description: Backup, retention, RTO/RPO targets, and data-subject rights workflow
type: feature
---

# Data Protection Policy

## Backup & Recovery
- **Backup:** Supabase managed daily snapshots + point-in-time recovery (7-day window on default plan).
- **RTO target:** 4 hours for full restore.
- **RPO target:** ≤ 5 minutes via WAL streaming.

## Retention
- Per-tenant `compliance_settings.data_retention_hours` (default 720h / 30d).
- `data_retention_sweep_report()` produces a dry-run report — no automatic deletion until reviewed.
- Audit logs are append-only and retained beyond per-tenant retention for legal hold.

## Data Subject Rights (DSAR)
- Export: `dsar-export` edge function → JSON bundle of all subject records.
- Redaction: `dsar-delete` edge function (phaos_admin only) → irreversible PII removal across leads/calls/orchestrator_leads.
- All DSAR actions write to `audit_events` with action `dsar.export` / `dsar.redact`.

## Encryption
- In transit: TLS 1.2+ enforced.
- At rest: Postgres TDE (Supabase managed) + AES-256.
- Application-layer: `live_accounts.access_code` stored as SHA-256 hash; plaintext never persisted.

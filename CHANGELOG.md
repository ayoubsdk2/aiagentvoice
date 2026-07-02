# Changelog

## 2026-04-19 — Security & Compliance Hardening Pass 1

### Added
- SHA-256 hashing for `live_accounts.access_code`; plaintext column dropped.
- Audit triggers on `live_accounts`, `compliance_settings`, `kill_switches`, `profiles`.
- `suspicious_login_activity` view (5+ failed logins per IP / 24h).
- `system_health_checks` table + `sandbox-health-check` edge function (read-only Sandbox dependency monitor).
- DSAR edge functions: `dsar-export`, `dsar-delete` (admin-gated, audited).
- `data-retention-sweep` (dry-run only — reports what would be purged per tenant).
- `compliance-evidence-bundle` edge function (per-tenant evidence pack).
- `notify-security-event` edge function (emails admin on suspicious login patterns).
- Seed data for `regulation_registry` (HIPAA/GDPR/CCPA/TCPA/PCI-DSS/SOC2/ISO27001), `control_library` (12 NIST 800-53 controls), `control_mappings`, `evidence_catalog`.
- `kpi_pins` table for upcoming custom KPI dashboard.
- Memory: `compliance/data-protection-policy.md`, `ops/incident-runbook.md`.

### Changed
- `LiveAccountsAdmin.tsx` rewritten — codes are write-only with SubtleCrypto SHA-256; UI shows fingerprint not plaintext.
- `redeem_live_access_code()` RPC compares hashes server-side (signature unchanged for callers).
- HIBP password protection confirmed on; anonymous sign-ins disabled.

### Frozen (no changes)
- VapiSandbox + use-vapi + NeuralAuditTrail + ObservabilityWidget + LiveKitRoom.
- All Vapi/LiveKit/ElevenLabs/Deepgram edge functions.
- All visual tokens (index.css, tailwind.config.ts).

### Deferred (require external action or future turns)
- MFA enrollment UI (planned next turn).
- ComplianceOperations admin page, /status route, /trust route, /admin/kpi route (planned next turn).
- Vitest/Playwright/Deno test suites (planned next turn).
- Cloudflare Turnstile, CSP meta tags, driver.js — declined by user.
- SOC 2 Type I observation, third-party pen test, signed BAAs/DPAs — external workstreams.
- Backend rate limiting — platform gap, deferred until Lovable provides primitives.

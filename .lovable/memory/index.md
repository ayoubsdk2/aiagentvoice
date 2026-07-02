# Project Memory

## Core
- **White-Labeling**: Fully white-labeled "Phaos AI". Dark theme (#0a0a0a) with Electric Purple (#a855f7) glassmorphism. Never expose 3rd party infra.
- **Domain Focus**: Print & Copier industry. Persona: Phoebe (Sharp MFP technical expert).
- **Voice Infrastructure**: Use `@vapi-ai/web` WebRTC + Cartesia Sonic. `window.speechSynthesis` is STRICTLY FORBIDDEN.
- **Security**: All API keys managed via Supabase Edge Functions. RLS enforced on database tables.
- **Automation**: Vapi webhooks automatically parse transcripts into `service_tickets` and scored leads via Edge Functions.

## Memories
- [API Security](mem://architecture/api-security) — Server-side handling of third-party keys and RLS policies
- [DR Runbook](mem://compliance/dr-runbook) — RTO ≤4h / RPO ≤5min, restore procedure, drill cadence
- [Brand Identity](mem://style/brand-identity) — Core visual design rules, responsive layout, and white-labeling
- [Domain Knowledge](mem://industry/domain-knowledge) — Printing industry persona, technical focus, and phonetic TTS engine rules
- [Voice Engine](mem://features/voice-engine) — Core WebRTC infrastructure, SDK initialization, and Vapi state management
- [Post-Call Automation](mem://features/post-call-automation) — Webhook workflows for tickets, emails, and scored lead generation
- [UI Components](mem://features/vapi-ui-components) — 'Glass Box' command center, SOA Reasoning Terminal, and Neural Audit Trail
- [Outbound Telephony](mem://features/vapi-outbound-telephony) — Live Phone Test form for outbound SIP telephony and stress test parameters
- [Observability](mem://features/observability-metrics) — Real-time widget monitoring STT/LLM/TTS latency and VAD states
- [Analytics ROI](mem://features/analytics-roi) — 15+ performance metrics, visualizations, and comparative analytics tools
- [Agentic DNA](mem://features/agentic-dna) — Interface for syncing granular voice engine parameters and behavioral dynamics
- [Compliance Hub](mem://features/compliance-hub) — Management interface for HIPAA, PCI, TCPA, GDPR, and data scrubbing toggles
- [Integrations Hub](mem://features/integrations-hub) — 3-state toggles for general and ERP/Industry connections (e.g. Sharp ODMS)
- [Mock Integrations](mem://features/mock-integrations) — Simulated LIVE QUERY interface with 1.5s latency for realistic demoing
- [Agent Workflows](mem://features/agent-workflows-registry) — Registry toggles for industry-specific tools with live JSON schema previews
- [Visual Workflow Canvas](mem://features/visual-workflow-canvas) — Full reactflow node editor with drag-and-drop, snap-to-grid, undo/redo, conditional branching
- [System Prompt](mem://features/system-prompt-editor) — Dedicated editor for defining and syncing persona core operating rules
- [Industry Intelligence](mem://logic/vapi-industry-intelligence) — Real-time detection of printer terms and specs within live transcripts
- [Session Resilience](mem://logic/vapi-session-resilience) — WebRTC connection quality watchdog and 10s inactivity soft resets
- [Latency Masking](mem://logic/vapi-latency-masking) — Cycling technical filler strings deployed during audio processing gaps
- [TTS Sanitization](mem://logic/tts-sanitization) — Pre-processing utility to strip Markdown artifacts before text-to-speech output
- [Production Hardening](mem://style/production-hardening) — System health indicators, Shadcn skeletons, and ARIA compliance logic
- [Account Mode (Prototype/Live)](mem://features/account-mode-live-accounts) — Access-code unlocked tenant binding, admin-only live_accounts table, header pill/toggle

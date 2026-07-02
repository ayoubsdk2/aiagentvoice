import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Info,
  Lock,
  ScrollText,
  Database,
  EyeOff,
  MessageSquareWarning,
  Bot,
  FileCheck2,
  CheckCircle2,
} from "lucide-react";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ironclad Compliance — read-only controls overview.
 *
 * Design principle: compliance is enforced by architecture (RBAC, RLS, audit
 * logging, retention, PII handling) — NOT by user-facing toggles that imply
 * laws can be turned on/off. This page documents the always-on controls and,
 * in live mode, surfaces real customer-scoped settings + recent audit events
 * (constrained by RLS).
 */

type ControlItem = {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  status: "always-on" | "configured" | "audited";
};

const ALWAYS_ON_CONTROLS: ControlItem[] = [
  {
    icon: Lock,
    title: "RBAC + Row-Level Security",
    description:
      "Every tenant table enforces row-level security. Access is gated by role (phaos_admin, customer_admin, agent_manager, viewer) and bound to the caller's tenant.",
    status: "always-on",
  },
  {
    icon: ScrollText,
    title: "Comprehensive Audit Logging",
    description:
      "Calls, leads, dispatches, mode switches, and integration changes are written to an append-only audit_events log with actor, timestamp, and resource references.",
    status: "always-on",
  },
  {
    icon: Database,
    title: "Data Retention & Deletion",
    description:
      "Per-tenant retention windows govern voice recordings and transcripts. DSAR (data subject access request) workflows track deletion and export obligations.",
    status: "configured",
  },
  {
    icon: EyeOff,
    title: "PII Scrubbing in Transcripts",
    description:
      "Transcripts and UI surfaces redact phone numbers, emails, SSNs, and card patterns. Raw data stays in the database under RLS; only sanitized output is rendered.",
    status: "always-on",
  },
  {
    icon: MessageSquareWarning,
    title: "Consent & Disclosure Handling",
    description:
      "Recording disclosures and channel-level consent (voice / SMS / email) are captured in consent_records and checked before outbound contact.",
    status: "configured",
  },
  {
    icon: Bot,
    title: "AI Safety Controls",
    description:
      "Prompt-injection defenses, tool-invocation guardrails, restricted-term lists, kill switches, and per-tenant token caps protect against adversarial or runaway LLM behavior.",
    status: "always-on",
  },
];

const FRAMEWORKS = [
  { code: "SOC 2", scope: "Security, availability, confidentiality" },
  { code: "GDPR", scope: "Data minimization, DSAR, lawful basis" },
  { code: "HIPAA", scope: "PHI redaction, BAA-ready architecture" },
  { code: "TCPA", scope: "Consent capture, outbound suppression" },
  { code: "PCI-DSS", scope: "Recording pause on card capture" },
  { code: "CCPA / CPRA", scope: "Subject rights workflows" },
];

interface AuditRow {
  id: string;
  action: string;
  resource_type: string | null;
  created_at: string;
}

export function ComplianceHub() {
  const { mode, liveAccount, currentLiveCustomerId } = useAccountMode();
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // In live mode, fetch the most recent audit entries for the bound customer.
  // RLS already constrains visibility — this just renders what the user can see.
  useEffect(() => {
    if (mode !== "live" || !currentLiveCustomerId) {
      setAudit([]);
      return;
    }
    let cancelled = false;
    setLoadingAudit(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("audit_events")
          .select("id, action, resource_type, created_at")
          .eq("customer_id", currentLiveCustomerId)
          .order("created_at", { ascending: false })
          .limit(8);
        if (!cancelled) setAudit((data ?? []) as AuditRow[]);
      } finally {
        if (!cancelled) setLoadingAudit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, currentLiveCustomerId]);

  const isLive = mode === "live";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ShieldCheck size={24} className="text-primary" />
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">
              Ironclad Compliance
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Secure & governance-ready by default — no toggles required.
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${
            isLive
              ? "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]"
              : "bg-secondary/50 text-muted-foreground border-border/50"
          }`}
        >
          {isLive
            ? `Live · ${liveAccount?.displayName ?? "Customer"}`
            : "Prototype · Sample Controls"}
        </span>
      </div>

      {/* Disclaimer */}
      <div className="glass-card p-4 border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.05)]">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-[hsl(var(--warning))] shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Phaos AI provides a secure control framework</strong>{" "}
            to help support your compliance program. Customers remain responsible
            for their own policies, contracts, and regulatory obligations.
          </p>
        </div>
      </div>

      {/* Always-on controls grid */}
      <section aria-labelledby="always-on-heading">
        <h3
          id="always-on-heading"
          className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3"
        >
          Always-On Controls
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALWAYS_ON_CONTROLS.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="glass-card p-5 space-y-3 hover-lift"
                aria-label={`${c.title} – ${c.status}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-primary" />
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--success))]">
                    <CheckCircle2 size={12} />
                    {c.status === "configured" ? "PER TENANT" : "ENFORCED"}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-foreground leading-tight">
                  {c.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {c.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Compliance Program / Supporting Controls */}
      <section aria-labelledby="program-heading">
        <h3
          id="program-heading"
          className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3"
        >
          Compliance Program · Supporting Controls
        </h3>
        <div className="glass-card p-5">
          <div className="flex items-start gap-3 mb-4">
            <FileCheck2 size={18} className="text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Phaos AI's architecture is designed to support customer obligations
              across the following frameworks. Mapping to specific clauses lives
              in the customer compliance annex.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FRAMEWORKS.map((f) => (
              <div
                key={f.code}
                className="border border-border/50 rounded-lg p-3 bg-secondary/30"
              >
                <div className="text-sm font-bold text-foreground">{f.code}</div>
                <div className="text-xs text-muted-foreground mt-1">{f.scope}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent audit evidence (live) / sample (prototype) */}
      <section aria-labelledby="audit-heading">
        <h3
          id="audit-heading"
          className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3"
        >
          Recent Audit Activity {isLive ? "" : "· Sample"}
        </h3>
        <div className="glass-card p-5">
          {!isLive ? (
            <SampleAuditList />
          ) : loadingAudit ? (
            <div className="text-xs text-muted-foreground">Loading audit trail…</div>
          ) : audit.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No audit events recorded yet for{" "}
              <span className="text-foreground font-semibold">
                {liveAccount?.displayName}
              </span>
              . Events appear here as calls, leads, dispatches, integration
              changes, and mode switches are recorded.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {audit.map((row) => (
                <li
                  key={row.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-foreground truncate">
                      {row.action}
                    </div>
                    {row.resource_type && (
                      <div className="text-[11px] text-muted-foreground">
                        {row.resource_type}
                      </div>
                    )}
                  </div>
                  <time className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(row.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </motion.div>
  );
}

function SampleAuditList() {
  const samples = [
    { action: "call.started", resource_type: "call", ago: "2m ago" },
    { action: "lead.created", resource_type: "lead", ago: "5m ago" },
    { action: "integration.activated", resource_type: "integration", ago: "1h ago" },
    { action: "mode.switched", resource_type: "session", ago: "3h ago" },
    { action: "dispatch.created", resource_type: "dispatch", ago: "1d ago" },
  ];
  return (
    <ul className="divide-y divide-border/40">
      {samples.map((s) => (
        <li
          key={s.action + s.ago}
          className="py-2.5 flex items-center justify-between gap-3 text-sm"
        >
          <div className="min-w-0">
            <div className="font-mono text-xs text-foreground">{s.action}</div>
            <div className="text-[11px] text-muted-foreground">{s.resource_type}</div>
          </div>
          <span className="text-[11px] text-muted-foreground shrink-0">{s.ago}</span>
        </li>
      ))}
      <li className="pt-3 text-[11px] text-muted-foreground italic">
        Sample data — real events appear here in live mode, scoped to your tenant by RLS.
      </li>
    </ul>
  );
}

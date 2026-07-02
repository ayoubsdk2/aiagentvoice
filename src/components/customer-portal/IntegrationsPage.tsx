import { useMemo } from "react";
import { Loader2, Database, Plug } from "lucide-react";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import { INTEGRATION_DEFINITIONS, type IntegrationDefinition } from "@/lib/integration-registry";
import { LiveIntegrationToggle } from "@/components/command-center/integrations/LiveIntegrationToggle";

export default function IntegrationsPage() {
  const { org, status } = useCurrentOrg();

  const groups = useMemo(() => {
    const erp = INTEGRATION_DEFINITIONS.filter(d => d.kind === "erp");
    const available = INTEGRATION_DEFINITIONS.filter(d => d.kind === "available");
    return { erp, available };
  }, []);

  if (status === "loading") {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!org) return <div className="text-sm text-muted-foreground">No organization found.</div>;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Database className="h-3.5 w-3.5" /> Operations
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Connect Phaos AI to your CRM, ERP, ITSM, and dispatch systems. Toggle a connector on, paste credentials in the secure drawer, and we'll live-test before flipping the badge to active.
        </p>
      </header>

      <IntegrationGrid title="Industry & ERP" defs={groups.erp} customerId={org.id} />
      <IntegrationGrid title="Available connectors" defs={groups.available} customerId={org.id} />
    </div>
  );
}

function IntegrationGrid({ title, defs, customerId }: { title: string; defs: IntegrationDefinition[]; customerId: string }) {
  if (!defs.length) return null;
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Plug className="w-3.5 h-3.5 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        <span className="text-[10px] text-muted-foreground/70">({defs.length})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {defs.map(def => (
          <div
            key={def.id}
            className="rounded-2xl border border-border/60 bg-card/40 p-4 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{def.displayName}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {def.kind === "erp" ? "Industry / ERP" : "Connector"}
                </div>
              </div>
              <LiveIntegrationToggle def={def} customerId={customerId} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

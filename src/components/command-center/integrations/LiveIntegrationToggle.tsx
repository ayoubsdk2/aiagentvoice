import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, Settings2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { IntegrationDefinition } from "@/lib/integration-registry";
import { IntegrationCredentialDialog } from "./IntegrationCredentialDialog";

interface Props {
  def: IntegrationDefinition;
  customerId: string;
}

interface RemoteRow {
  status: "pending" | "active" | "failed" | "disabled";
  last_test_error: string | null;
  last_tested_at: string | null;
}

/**
 * Live-mode toggle that opens a credential drawer on ON, saves+encrypts+tests
 * via `save-integration-credentials`, and only flips green when the live test
 * passes. State is hydrated from `list_integration_statuses` RPC.
 */
export function LiveIntegrationToggle({ def, customerId }: Props) {
  const [row, setRow] = useState<RemoteRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_integration_statuses", {
      _customer_id: customerId,
    });
    setLoading(false);
    if (error) return;
    const found = (data ?? []).find((r: { integration_id: string }) => r.integration_id === def.id);
    if (found) {
      setRow({
        status: found.status as RemoteRow["status"],
        last_test_error: found.last_test_error,
        last_tested_at: found.last_tested_at,
      });
    } else {
      setRow(null);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [def.id, customerId]);

  const isOn = row?.status === "active";
  const isFailed = row?.status === "failed";

  const handleToggle = async (next: boolean) => {
    if (next) {
      setDialogOpen(true);
      return;
    }
    setWorking(true);
    const { error } = await supabase.functions.invoke("disable-integration", {
      body: { integrationId: def.id },
    });
    setWorking(false);
    if (error) {
      toast.error("Failed to disable", { description: error.message });
      return;
    }
    toast.success(`${def.displayName} disabled`);
    refresh();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Switch
          checked={isOn}
          disabled={loading || working}
          onCheckedChange={handleToggle}
          className={`scale-75 ${isOn ? "data-[state=checked]:bg-[hsl(var(--success))]" : ""}`}
          aria-label={`Toggle ${def.displayName}`}
        />
        {(loading || working) && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
        {isOn && <CheckCircle2 size={10} className="text-[hsl(var(--success))]" />}
        {isFailed && <AlertTriangle size={12} className="text-yellow-400" />}
        {(isOn || isFailed) && (
          <button
            onClick={() => setDialogOpen(true)}
            className="ml-1 text-muted-foreground hover:text-primary transition-colors"
            aria-label={`Reconfigure ${def.displayName}`}
            title="Update credentials"
          >
            <Settings2 size={11} />
          </button>
        )}
      </div>

      {isFailed && row?.last_test_error && (
        <p className="text-[10px] text-yellow-400/90 leading-tight max-w-[180px]">
          {row.last_test_error}
        </p>
      )}

      <IntegrationCredentialDialog
        def={def}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={refresh}
      />
    </div>
  );
}

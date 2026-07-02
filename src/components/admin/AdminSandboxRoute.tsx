import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setVoiceAgentOverride } from "@/hooks/use-vapi";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { Loader2, ShieldAlert } from "lucide-react";

const VapiSandbox = lazy(() =>
  import("@/components/command-center/VapiSandbox").then((m) => ({ default: m.VapiSandbox })),
);

/**
 * Admin-only wrapper for the Sandbox tab.
 * Resolves the currently-selected live account's PRIMARY agent from
 * `live_account_agents` and applies the per-sandbox override BEFORE
 * VapiSandbox mounts. Falls back to the default global assistant if
 * no agents have been registered yet for this account.
 */
export default function AdminSandboxRoute() {
  const { currentLiveCustomerId, liveAccount } = useAccountMode();
  const [resolved, setResolved] = useState<null | { assistantId: string | null; label: string | null }>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setResolved(null);
      setError(null);

      if (!currentLiveCustomerId) {
        // No live account selected — clear any prior override so admin sees default.
        setVoiceAgentOverride({ assistantId: null, publicKey: null });
        setResolved({ assistantId: null, label: null });
        return;
      }

      const { data, error: qErr } = await supabase
        .from("live_account_agents")
        .select("vapi_assistant_id, label, is_primary, created_at")
        .eq("customer_id", currentLiveCustomerId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1);

      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setResolved({ assistantId: null, label: null });
        return;
      }

      const row = (data ?? [])[0];
      if (row?.vapi_assistant_id) {
        setVoiceAgentOverride({ assistantId: row.vapi_assistant_id });
        setResolved({ assistantId: row.vapi_assistant_id, label: row.label ?? null });
      } else {
        setVoiceAgentOverride({ assistantId: null });
        setResolved({ assistantId: null, label: null });
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [currentLiveCustomerId]);

  if (resolved === null) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={16} /> Resolving voice agent…
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="uppercase tracking-widest">Sandbox agent:</span>
        {currentLiveCustomerId ? (
          resolved.assistantId ? (
            <>
              <span className="font-mono text-foreground">{resolved.assistantId.slice(0, 8)}…{resolved.assistantId.slice(-4)}</span>
              {resolved.label && <span className="text-foreground">· {resolved.label}</span>}
              <span>· {liveAccount?.displayName}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-400">
              <ShieldAlert size={12} /> No agent registered for {liveAccount?.displayName}. Falling back to default.
            </span>
          )
        ) : (
          <span>No live account selected — using default voice agent.</span>
        )}
        {error && <span className="text-destructive">· {error}</span>}
      </div>
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading sandbox…</div>}>
        <VapiSandbox key={resolved.assistantId ?? "default"} />
      </Suspense>
    </div>
  );
}

import { ShieldAlert, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import phaosCrown from "@/assets/phaos-crown-mark.png";

interface Props {
  status?: "suspended" | "deactivated";
}

export default function Suspended({ status = "suspended" }: Props) {
  const isDeactivated = status === "deactivated";
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-md p-8 text-center space-y-5">
        <img src={phaosCrown} alt="Phaos AI" className="h-10 mx-auto opacity-90" />
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight">
            {isDeactivated ? "Account deactivated" : "Access revoked"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isDeactivated
              ? "This account has been deactivated. Contact your organization administrator to restore access."
              : "Your Phaos AI account has been suspended. Please contact support@phaosai.com for assistance."}
          </p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut size={12} /> Sign out
        </button>
      </div>
    </div>
  );
}

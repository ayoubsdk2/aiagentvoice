import { Clock, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import phaosCrown from "@/assets/phaos-crown-mark.png";

export default function PendingApproval() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-md p-8 text-center space-y-5">
        <img src={phaosCrown} alt="Phaos AI" className="h-10 mx-auto opacity-90" />
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Clock className="w-6 h-6 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight">Approval pending</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your Phaos AI account is awaiting approval from the Phaos AI team.
            You will receive an email when access is granted. This typically
            takes one business day.
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

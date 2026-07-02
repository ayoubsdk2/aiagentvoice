import { lazy, Suspense, useState } from "react";
import { Send } from "lucide-react";
import { SandboxIndustryProvider, useSandboxIndustry } from "@/contexts/SandboxIndustryContext";
import { IndustryCombobox } from "@/components/command-center/sandbox/IndustryCombobox";
import { VoiceCombobox } from "@/components/command-center/sandbox/VoiceCombobox";
import { SandboxVoiceProvider } from "@/contexts/SandboxVoiceContext";
import { SendIndustryDialog } from "@/components/command-center/sandbox/SendIndustryDialog";
import { useUser } from "@/hooks/use-user";

const AdminSandboxRoute = lazy(() => import("@/components/admin/AdminSandboxRoute"));

function AdminSandboxToolbar() {
  const { industry } = useSandboxIndustry();
  const { user } = useUser();
  const [sendOpen, setSendOpen] = useState(false);
  const email = user?.email ?? "";
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
      <div className="flex items-center gap-2 min-w-0">
        <SandboxVoiceProvider>
          <VoiceCombobox />
        </SandboxVoiceProvider>
        <IndustryCombobox />
        <button
          type="button"
          onClick={() => setSendOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full bg-[#f5c542] hover:bg-[#f5c542]/90 text-black text-xs sm:text-sm font-bold uppercase tracking-wider shadow-md shadow-[#f5c542]/30 transition-colors"
          aria-label={`Send ${industry.name} voice agent invite`}
          title={`Send the ${industry.name} agent to a prospect`}
        >
          <Send size={13} />
          Send
        </button>
        <SendIndustryDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          industry={industry}
          fromEmail={email || undefined}
          fromName={displayName}
        />
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        Every SEND is silently BCC'd to Daniel@PhaosAI.com and logged in the SEND Audit Log.
      </p>
    </div>
  );
}

export default function AdminSandboxPage() {
  return (
    <SandboxIndustryProvider>
      <AdminSandboxToolbar />
      <Suspense fallback={<div className="p-6 text-muted-foreground text-sm">Loading sandbox…</div>}>
        <AdminSandboxRoute />
      </Suspense>
    </SandboxIndustryProvider>
  );
}

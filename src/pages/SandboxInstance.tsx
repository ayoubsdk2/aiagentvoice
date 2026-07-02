import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { setVoiceAgentOverride } from "@/hooks/use-vapi";
import { SidebarNav } from "@/components/command-center/SidebarNav";
import { TopHeader } from "@/components/command-center/TopHeader";
import { ExecutiveDashboard } from "@/components/command-center/ExecutiveDashboard";
import { SystemErrorBoundary } from "@/components/command-center/SystemErrorBoundary";
import NotFound from "@/pages/NotFound";

const VapiSandbox = lazy(() => import("@/components/command-center/VapiSandbox").then(m => ({ default: m.VapiSandbox })));
const AgenticDNA = lazy(() => import("@/components/command-center/AgenticDNA").then(m => ({ default: m.AgenticDNA })));
const ComplianceHub = lazy(() => import("@/components/command-center/ComplianceHub").then(m => ({ default: m.ComplianceHub })));
const IntegrationMap = lazy(() => import("@/components/command-center/IntegrationMap").then(m => ({ default: m.IntegrationMap })));
const AnalyticsROI = lazy(() => import("@/components/command-center/AnalyticsROI").then(m => ({ default: m.AnalyticsROI })));
const AgentWorkflows = lazy(() => import("@/components/command-center/AgentWorkflows").then(m => ({ default: m.AgentWorkflows })));
const CallHistory = lazy(() => import("@/components/command-center/CallHistory").then(m => ({ default: m.CallHistory })));
const LeadsDashboard = lazy(() => import("@/components/command-center/LeadsDashboard").then(m => ({ default: m.LeadsDashboard })));


interface SandboxInstanceRow {
  slug: string;
  company_name: string;
  vapi_assistant_id: string;
  vapi_public_key: string | null;
  is_active: boolean;
}

const TabFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function SandboxInstance() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; row: SandboxInstanceRow }
    | { status: "missing" }
  >({ status: "loading" });
  const [activeTab, setActiveTab] = useState("Sandbox");
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) { setState({ status: "missing" }); return; }
      const { data } = await supabase
        .rpc("get_public_sandbox", { p_slug: slug })
        .maybeSingle();
      if (cancelled) return;
      if (!data) { setState({ status: "missing" }); return; }
      setState({ status: "ready", row: data as SandboxInstanceRow });
    })();
    return () => {
      cancelled = true;
      setVoiceAgentOverride({ assistantId: null, publicKey: null });
    };
  }, [slug]);

  // Apply the override SYNCHRONOUSLY during render — before VapiSandbox mounts.
  // The voice instance is created later inside the user's Start click handler.
  if (state.status === "ready" && appliedRef.current !== state.row.slug) {
    setVoiceAgentOverride({
      assistantId: state.row.vapi_assistant_id,
      publicKey: state.row.vapi_public_key,
    });
    appliedRef.current = state.row.slug;
  }

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state.status === "missing") {
    return <NotFound />;
  }

  const { company_name } = state.row;

  return (
    <div className="flex h-screen bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden">
      <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} publicMode />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopHeader onNavigate={setActiveTab} publicMode brandLabel={company_name} />
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
          {activeTab === "Dashboard" && <ExecutiveDashboard key="dash" />}
          {activeTab === "DNA" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><AgenticDNA key="dna" /></Suspense></SystemErrorBoundary>
          )}
          {activeTab === "Workflows" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><AgentWorkflows key="workflows" /></Suspense></SystemErrorBoundary>
          )}
          {activeTab === "CallHistory" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><CallHistory key="callhistory" /></Suspense></SystemErrorBoundary>
          )}
          {activeTab === "Sandbox" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><VapiSandbox key="sandbox" /></Suspense></SystemErrorBoundary>
          )}
          {activeTab === "Leads" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><LeadsDashboard key="leads" /></Suspense></SystemErrorBoundary>
          )}
          {activeTab === "ERP" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><IntegrationMap key="erp" /></Suspense></SystemErrorBoundary>
          )}
          {activeTab === "Compliance" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><ComplianceHub key="compliance" /></Suspense></SystemErrorBoundary>
          )}
          {activeTab === "Analytics" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><AnalyticsROI key="analytics" /></Suspense></SystemErrorBoundary>
          )}
        </div>
      </main>
    </div>
  );
}

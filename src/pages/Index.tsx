import { useState, lazy, Suspense } from "react";
import { SidebarNav } from "@/components/command-center/SidebarNav";
import { TopHeader } from "@/components/command-center/TopHeader";
import { ExecutiveDashboard } from "@/components/command-center/ExecutiveDashboard";
import { SystemErrorBoundary } from "@/components/command-center/SystemErrorBoundary";

const VapiSandbox = lazy(() => import("@/components/command-center/VapiSandbox").then(m => ({ default: m.VapiSandbox })));
const AgenticDNA = lazy(() => import("@/components/command-center/AgenticDNA").then(m => ({ default: m.AgenticDNA })));
const ComplianceHub = lazy(() => import("@/components/command-center/ComplianceHub").then(m => ({ default: m.ComplianceHub })));
const IntegrationMap = lazy(() => import("@/components/command-center/IntegrationMap").then(m => ({ default: m.IntegrationMap })));

const AnalyticsROI = lazy(() => import("@/components/command-center/AnalyticsROI").then(m => ({ default: m.AnalyticsROI })));
const AgentWorkflows = lazy(() => import("@/components/command-center/AgentWorkflows").then(m => ({ default: m.AgentWorkflows })));
const CallHistory = lazy(() => import("@/components/command-center/CallHistory").then(m => ({ default: m.CallHistory })));
const PromptManager = lazy(() => import("@/components/command-center/PromptManager").then(m => ({ default: m.PromptManager })));
const LeadsDashboard = lazy(() => import("@/components/command-center/LeadsDashboard").then(m => ({ default: m.LeadsDashboard })));
const SoaAppPreview = lazy(() => import("@/components/command-center/SoaAppPreview").then(m => ({ default: m.SoaAppPreview })));
const LiveAccountsAdmin = lazy(() => import("@/components/command-center/LiveAccountsAdmin").then(m => ({ default: m.LiveAccountsAdmin })));
const SandboxInstancesAdmin = lazy(() => import("@/components/command-center/SandboxInstancesAdmin").then(m => ({ default: m.SandboxInstancesAdmin })));

const TabFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const Index = () => {
  const [activeTab, setActiveTab] = useState("Dashboard");

  return (
    <div className="flex h-screen bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden">
      {/* Skip to content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-bold"
      >
        Skip to content
      </a>
      <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopHeader onNavigate={setActiveTab} />
        <div id="main-content" className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto custom-scrollbar" tabIndex={-1}>
          {/* No mode="wait" — instant tab switching, no exit animation blocking */}
          {activeTab === "Dashboard" && <ExecutiveDashboard key="dash" />}

          {/* Each tab gets its own Suspense + ErrorBoundary — one failure doesn't kill others */}


          {activeTab === "DNA" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><AgenticDNA key="dna" /></Suspense></SystemErrorBoundary>
          )}
          {activeTab === "Workflows" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><AgentWorkflows key="workflows" /></Suspense></SystemErrorBoundary>
          )}
          {activeTab === "CallHistory" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><CallHistory key="callhistory" /></Suspense></SystemErrorBoundary>
          )}
          {/* System Prompt temporarily hidden */}
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
          {activeTab === "SoaApp" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><SoaAppPreview key="soaapp" /></Suspense></SystemErrorBoundary>
          )}
          {activeTab === "LiveAccounts" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><LiveAccountsAdmin key="liveaccounts" /></Suspense></SystemErrorBoundary>
          )}
          {activeTab === "Sandboxes" && (
            <SystemErrorBoundary><Suspense fallback={<TabFallback />}><SandboxInstancesAdmin key="sandboxes" /></Suspense></SystemErrorBoundary>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;

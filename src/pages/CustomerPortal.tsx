import { useState, lazy, Suspense } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  PlayCircle,
  LogOut,
  Building2,
  MapPin,
  Phone,
  PhoneIncoming,
  Users,
  Database,
  BarChart3,
  ShieldCheck,
  UserCog,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/hooks/useIdentity";
import phaosLogo from "@/assets/phaos-logo.png";
import { SystemErrorBoundary } from "@/components/command-center/SystemErrorBoundary";
import { CustomerTenantProvider } from "@/contexts/CustomerTenantContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { TenantContextBar } from "@/components/customer-portal/TenantContextBar";
import { DemoModeMenu } from "@/components/customer-portal/DemoModeMenu";
import { DemoModeBanner } from "@/components/customer-portal/DemoModeBanner";
import { TenantDebugPanel } from "@/components/customer-portal/TenantDebugPanel";
import { CustomerOverview } from "@/components/customer-portal/CustomerOverview";
import { PortalComingSoon } from "@/components/customer-portal/PortalComingSoon";

type SetTab = (tab: CustomerTab) => void;

const TelephonyPage = lazy(() => import("@/components/customer-portal/TelephonyPage"));
const OrgLocationsPage = lazy(() => import("@/components/customer-portal/OrgLocationsPage"));
const CustomerAnalyticsPage = lazy(() => import("@/components/customer-portal/CustomerAnalyticsPage"));
const CustomerCallsPage = lazy(() => import("@/components/customer-portal/CustomerCallsPage"));
const UsersRolesPage = lazy(() => import("@/components/customer-portal/UsersRolesPage"));
const SettingsPage = lazy(() => import("@/components/customer-portal/SettingsPage"));
const CompliancePage = lazy(() => import("@/components/customer-portal/CompliancePage"));
const IntegrationsPage = lazy(() => import("@/components/customer-portal/IntegrationsPage"));
const VapiSandbox = lazy(() =>
  import("@/components/command-center/VapiSandbox").then((m) => ({
    default: m.VapiSandbox,
  }))
);

type CustomerTab =
  | "Overview"
  | "Sandbox"
  | "Locations"
  | "Numbers"
  | "Calls"
  | "Leads"
  | "Integrations"
  | "Analytics"
  | "Compliance"
  | "Users"
  | "Settings";

const NAV: Array<{
  id: CustomerTab;
  icon: LucideIcon;
  label: string;
  group: "MAIN" | "OPERATIONS" | "GOVERNANCE" | "ADMIN";
}> = [
  { id: "Overview", icon: LayoutDashboard, label: "Overview", group: "MAIN" },
  { id: "Sandbox", icon: PlayCircle, label: "Sandbox", group: "MAIN" },
  { id: "Locations", icon: MapPin, label: "Locations", group: "OPERATIONS" },
  { id: "Numbers", icon: Phone, label: "Phone Numbers", group: "OPERATIONS" },
  { id: "Calls", icon: PhoneIncoming, label: "Calls & Transcripts", group: "OPERATIONS" },
  { id: "Leads", icon: Users, label: "Leads", group: "OPERATIONS" },
  { id: "Integrations", icon: Database, label: "Integrations", group: "OPERATIONS" },
  { id: "Analytics", icon: BarChart3, label: "Analytics & ROI", group: "GOVERNANCE" },
  { id: "Compliance", icon: ShieldCheck, label: "Compliance", group: "GOVERNANCE" },
  { id: "Users", icon: UserCog, label: "Users & Roles", group: "ADMIN" },
  { id: "Settings", icon: Settings, label: "Settings", group: "ADMIN" },
];

const GROUP_LABEL: Record<string, string> = {
  MAIN: "Main",
  OPERATIONS: "Operations",
  GOVERNANCE: "Governance",
  ADMIN: "Admin",
};

const ROLE_LABEL: Record<string, string> = {
  customer_owner: "Organization Owner",
  customer_admin: "Organization Admin",
  location_manager: "Location Manager",
  viewer: "Viewer",
  trial_user: "Trial Access",
};

const TabFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/**
 * Customer-facing portal shown to all NON-internal authenticated users.
 *
 * Strictly excludes internal-only surfaces (server-enforced — see
 * `is_internal_operator()` and `RequireInternal` route guard):
 *   - SOA AI App
 *   - Live Accounts
 *   - Content Lab
 *   - QA Dashboard
 */
export default function CustomerPortal() {
  return (
    <DemoModeProvider>
      <CustomerTenantProvider>
        <CustomerPortalShell />
      </CustomerTenantProvider>
    </DemoModeProvider>
  );
}

function CustomerPortalShell() {
  const [tab, setTab] = useState<CustomerTab>("Overview");
  const state = useIdentity();
  const identity = state.status === "ready" ? state.identity : null;

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
  }

  const role = identity?.platformRole ?? "trial_user";
  const accessLabel = ROLE_LABEL[role] ?? "Member";

  // Group nav items
  const grouped = NAV.reduce<Record<string, typeof NAV>>((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  const activeMeta = NAV.find((n) => n.id === tab);

  return (
    <div className="flex h-screen bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/40 bg-card/30 backdrop-blur-xl">
        <div className="p-4 border-b border-border/40 flex items-center gap-3">
          <img src={phaosLogo} alt="Phaos AI" className="w-9 h-9 rounded-lg" />
          <div>
            <div className="text-sm font-bold tracking-tight">Phaos AI</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Client Portal
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3" aria-label="Customer portal navigation">
          {(["MAIN", "OPERATIONS", "GOVERNANCE", "ADMIN"] as const).map((g) => (
            <div key={g}>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">
                {GROUP_LABEL[g]}
              </div>
              <div className="space-y-0.5">
                {grouped[g]?.map((item) => {
                  const Icon = item.icon;
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setTab(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${
                        active
                          ? "bg-primary/15 text-foreground border border-primary/30 font-semibold"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground border border-transparent"
                      }`}
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Profile */}
        <div className="p-2.5 border-t border-border/40 space-y-2">
          <div className="px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/40">
            <div className="text-xs font-semibold truncate">
              {identity?.fullName || identity?.email || "—"}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Building2 size={10} />
              {accessLabel}
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden absolute top-0 inset-x-0 z-10 flex items-center justify-between p-3 bg-card/60 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center gap-2">
          <img src={phaosLogo} alt="Phaos AI" className="w-7 h-7 rounded" />
          <span className="text-sm font-bold">Client Portal</span>
        </div>
        <select
          value={tab}
          onChange={(e) => setTab(e.target.value as CustomerTab)}
          className="bg-secondary/60 border border-border/40 rounded-md text-xs px-2 py-1 max-w-[160px]"
        >
          {NAV.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
      </div>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="hidden md:flex items-center justify-between px-6 py-3 border-b border-border/40 bg-card/20 backdrop-blur-xl">
          <div>
            <h1 className="text-base font-bold tracking-tight">
              {activeMeta?.label}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {role === "trial_user" && (
              <div className="text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary">
                Trial Access
              </div>
            )}
            <DemoModeMenu />
          </div>
        </header>

        <DemoModeBanner />
        <TenantContextBar />
        <TenantDebugPanel />

        <div className="flex-1 p-4 md:p-6 lg:p-8 pt-16 md:pt-6 overflow-y-auto custom-scrollbar">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SystemErrorBoundary>
              <PortalContent tab={tab} setTab={setTab} />
            </SystemErrorBoundary>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function PortalContent({ tab, setTab }: { tab: CustomerTab; setTab: SetTab }) {
  return <PortalContentInner tab={tab} setTab={setTab} />;
}

function PortalContentInner({ tab, setTab }: { tab: CustomerTab; setTab: SetTab }) {
  switch (tab) {
    case "Overview":
      return <CustomerOverview onNavigate={(t) => setTab(t as CustomerTab)} />;
    case "Sandbox":
      return (
        <Suspense fallback={<TabFallback />}>
          <VapiSandbox />
        </Suspense>
      );
    case "Locations":
      return (
        <Suspense fallback={<TabFallback />}>
          <OrgLocationsPage />
        </Suspense>
      );
    case "Numbers":
      return (
        <Suspense fallback={<TabFallback />}>
          <TelephonyPage />
        </Suspense>
      );
    case "Calls":
      return (
        <Suspense fallback={<TabFallback />}>
          <CustomerCallsPage />
        </Suspense>
      );
    case "Leads":
      return (
        <PortalComingSoon
          icon={Users}
          title="Leads"
          description="Every qualified opportunity Phoebe captures, scored and routed to the right rep with full conversation context."
          features={[
            "Auto-scoring based on intent + value signals",
            "Two-way sync with Salesforce, HubSpot, Zoho",
            "Lead-to-call timeline and full transcript context",
            "SLA timers and stale-lead alerts",
          ]}
        />
      );
    case "Integrations":
      return (
        <Suspense fallback={<TabFallback />}>
          <IntegrationsPage />
        </Suspense>
      );
    case "Analytics":
      return (
        <Suspense fallback={<TabFallback />}>
          <CustomerAnalyticsPage />
        </Suspense>
      );
    case "Compliance":
      return (
        <Suspense fallback={<TabFallback />}>
          <CompliancePage />
        </Suspense>
      );
    case "Users":
      return (
        <Suspense fallback={<TabFallback />}>
          <UsersRolesPage />
        </Suspense>
      );
    case "Settings":
      return (
        <Suspense fallback={<TabFallback />}>
          <SettingsPage />
        </Suspense>
      );
    default:
      return null;
  }
}

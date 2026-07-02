import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccountModeProvider } from "@/contexts/AccountModeContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/Auth.tsx";
import { RequireAuth } from "./components/RequireAuth";
import { RequireAdminAAL2 } from "./components/RequireAdminAAL2";
import { RequireInternal } from "./components/RequireInternal";
import { IdentityRouter } from "./components/IdentityRouter";
import { RootRoute } from "./components/RootRoute";
import { RequireAdminGate } from "./components/admin/RequireAdminGate";

const MfaSetup = lazy(() => import("./pages/MfaSetup"));
const MfaChallenge = lazy(() => import("./pages/MfaChallenge"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const TrustPage = lazy(() => import("./pages/TrustPage"));
const CustomKpiDashboard = lazy(() => import("./pages/CustomKpiDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const ContentLab = lazy(() => import("./pages/ContentLab"));
const QADashboard = lazy(() => import("./pages/QADashboard"));
const SandboxInstance = lazy(() => import("./pages/SandboxInstance"));
const SandboxPublic = lazy(() => import("./pages/SandboxPublic"));
const IndustryOrInstance = lazy(() => import("./pages/IndustryOrInstance"));
const ContactPage = lazy(() => import("./pages/Contact"));
const UnsubscribePage = lazy(() => import("./pages/Unsubscribe"));

// Admin section (credential-gated, independent of Supabase auth)
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const SendAuditLog = lazy(() => import("./pages/admin/SendAuditLog"));
const AdminSandboxPage = lazy(() => import("./pages/admin/AdminSandboxPage"));
const ExecutiveDashboard = lazy(() =>
  import("./components/command-center/ExecutiveDashboard").then((m) => ({ default: m.ExecutiveDashboard })),
);
const CallHistory = lazy(() =>
  import("./components/command-center/CallHistory").then((m) => ({ default: m.CallHistory })),
);
const VapiSandbox = lazy(() =>
  import("./components/command-center/VapiSandbox").then((m) => ({ default: m.VapiSandbox })),
);
const LeadsDashboard = lazy(() =>
  import("./components/command-center/LeadsDashboard").then((m) => ({ default: m.LeadsDashboard })),
);
const AnalyticsROI = lazy(() =>
  import("./components/command-center/AnalyticsROI").then((m) => ({ default: m.AnalyticsROI })),
);
const LiveAccountsAdmin = lazy(() =>
  import("./components/command-center/LiveAccountsAdmin").then((m) => ({ default: m.LiveAccountsAdmin })),
);


const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AccountModeProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/trust" element={<TrustPage />} />
              <Route path="/try" element={<SandboxPublic />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/i-want-this" element={<ContactPage />} />
              <Route path="/unsubscribe" element={<UnsubscribePage />} />
              <Route path="/admin-app" element={<RequireAuth><IdentityRouter /></RequireAuth>} />
              <Route path="/sandbox/:slug" element={<SandboxInstance />} />
              <Route
                path="/status"
                element={<RequireAuth><StatusPage /></RequireAuth>}
              />
              <Route
                path="/mfa-setup"
                element={<RequireAuth><MfaSetup /></RequireAuth>}
              />
              <Route
                path="/mfa-challenge"
                element={<RequireAuth><MfaChallenge /></RequireAuth>}
              />
              <Route
                path="/admin/users"
                element={
                  <RequireAuth>
                    <RequireInternal>
                      <AdminUsers />
                    </RequireInternal>
                  </RequireAuth>
                }
              />
              {/* /admin/content-lab and /admin/qa are mounted inside the credential-gated <AdminLayout> below */}

              <Route
                path="/admin/kpi"
                element={
                  <RequireAuth>
                    <RequireInternal>
                      <RequireAdminAAL2>
                        <CustomKpiDashboard />
                      </RequireAdminAAL2>
                    </RequireInternal>
                  </RequireAuth>
                }
              />
              {/* Credential-gated admin section. Independent of Supabase auth. */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <RequireAdminGate>
                    <AdminLayout />
                  </RequireAdminGate>
                }
              >
                <Route index element={<ExecutiveDashboard />} />
                <Route path="transcripts" element={<CallHistory />} />
                <Route path="sandbox" element={<AdminSandboxPage />} />
                
                
                <Route path="leads" element={<LeadsDashboard />} />
                <Route path="analytics" element={<AnalyticsROI />} />
                <Route path="accounts" element={<LiveAccountsAdmin />} />
                <Route path="content-lab" element={<ContentLab />} />
                <Route path="qa" element={<QADashboard />} />
                <Route path="send-audit" element={<SendAuditLog />} />
              </Route>
              <Route path="/" element={<RootRoute />} />
              <Route path="/:slug" element={<IndustryOrInstance />} />
              <Route path="*" element={<NotFound />} />

            </Routes>
          </Suspense>
        </BrowserRouter>
      </AccountModeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

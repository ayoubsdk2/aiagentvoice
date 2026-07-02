import { Outlet } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { SystemErrorBoundary } from "@/components/command-center/SystemErrorBoundary";
import { AdminCompanyProvider } from "@/contexts/AdminCompanyContext";
import { usePageMeta } from "@/lib/usePageMeta";

export default function AdminLayout() {
  usePageMeta({
    title: "Phaos AI Admin",
    description: "Phaos AI admin console — live accounts, voice agents, integrations.",
    path: "/admin",
  });
  return (
    <AdminCompanyProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <AdminSidebar />
        <main className="flex-1 overflow-auto">
          <AdminTopBar />
          <SystemErrorBoundary>
            <Outlet />
          </SystemErrorBoundary>
        </main>
      </div>
    </AdminCompanyProvider>
  );
}

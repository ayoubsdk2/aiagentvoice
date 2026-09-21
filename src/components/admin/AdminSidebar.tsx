import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  PhoneCall,
  Users,
  BarChart3,
  Building2,
  Sparkles,
  FlaskConical,
  Send,
  Mic,
  LogOut,
  Workflow,
  Database,
  ShieldCheck,
} from "lucide-react";
import { clearAdminToken } from "@/lib/admin-session";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const items: { to: string; label: string; icon: typeof LayoutDashboard }[] = [
  { to: "/admin", label: "Global Dashboard", icon: LayoutDashboard },
  { to: "/admin/workflows", label: "Agent Workflows", icon: Workflow },
  { to: "/admin/transcripts", label: "Call Transcript", icon: PhoneCall },
  { to: "/admin/sandbox", label: "Sandbox", icon: Mic },
  { to: "/admin/leads", label: "Lead Intelligence", icon: Users },
  { to: "/admin/integrations", label: "Integrations", icon: Database },
  { to: "/admin/compliance", label: "Ironclad Compliance", icon: ShieldCheck },
  { to: "/admin/analytics", label: "Analytics & ROI", icon: BarChart3 },
  { to: "/admin/accounts", label: "Live Accounts", icon: Building2 },
  { to: "/admin/send-audit", label: "SEND Audit Log", icon: Send },
  { to: "/admin/content-lab", label: "Content Lab", icon: Sparkles },
  { to: "/admin/qa", label: "QA Dashboard", icon: FlaskConical },
];

export function AdminSidebar() {
  const navigate = useNavigate();

  function logout() {
    clearAdminToken();
    navigate("/admin/login", { replace: true });
  }

  return (
    <aside className="w-64 shrink-0 border-r border-border/40 bg-card/30 backdrop-blur flex flex-col min-h-screen">
      <div className="px-5 py-6 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">PHAOS</span>
          <span className="text-xl font-bold tracking-tight text-primary italic">AI</span>
          <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
            Admin
          </span>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/admin"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border/40">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

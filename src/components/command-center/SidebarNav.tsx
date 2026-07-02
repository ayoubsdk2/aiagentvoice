import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Activity, PlayCircle,
  Database, ShieldCheck, BarChart3, Workflow, PhoneIncoming, MessageSquareText, Users,
  Smartphone, Menu, X, Lock, LogOut, UserCog, Sparkles, FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import phaosLogo from "@/assets/phaos-logo.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionPersistence } from "@/lib/session-persistence";
import { useAccountMode } from "@/contexts/AccountModeContext";

const NAV_ITEMS = [
  { id: "Dashboard", icon: LayoutDashboard, label: "Global Dashboard" },
  // Triage Feed merged into Global Dashboard
  // DNA tab temporarily hidden
  { id: "Workflows", icon: Workflow, label: "Agent Workflows" },
  { id: "CallHistory", icon: PhoneIncoming, label: "Call Transcript" },
  // System Prompt temporarily hidden
  { id: "Sandbox", icon: PlayCircle, label: "The Sandbox" },
  { id: "Leads", icon: Users, label: "Lead Intelligence" },
  { id: "ERP", icon: Database, label: "Integrations" },
  { id: "Compliance", icon: ShieldCheck, label: "Ironclad Compliance" },
  { id: "Analytics", icon: BarChart3, label: "Analytics & ROI" },
  { id: "SoaApp", icon: Smartphone, label: "SOA AI App" },
];

const ADMIN_ITEMS = [
  { id: "LiveAccounts", icon: Lock, label: "Live Accounts" },
  { id: "Sandboxes", icon: FlaskConical, label: "Sandbox Instances" },
];
const CONTENT_LAB_EMAIL = "daniel@phaosai.com";

interface SidebarNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  publicMode?: boolean;
}

export function SidebarNav({ activeTab, onTabChange, publicMode = false }: SidebarNavProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { clearLive } = useAccountMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (publicMode) return;
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user?.id) return;
      if (!cancelled) setUserEmail(u.user.email ?? null);
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "phaos_admin" });
      if (!cancelled) setIsAdmin(data === true);
    })();
    return () => { cancelled = true; };
  }, [publicMode]);

  const showContentLab = !publicMode && (userEmail ?? "").toLowerCase() === CONTENT_LAB_EMAIL;
  const baseNav = publicMode ? NAV_ITEMS.filter((i) => i.id !== "SoaApp") : NAV_ITEMS;
  const navItems = !publicMode && isAdmin ? [...baseNav, ...ADMIN_ITEMS] : baseNav;

  const handleContentLab = () => {
    navigate("/admin/content-lab");
    if (isMobile) setMobileOpen(false);
  };

  const handleQA = () => {
    navigate("/admin/qa");
    if (isMobile) setMobileOpen(false);
  };

  const handleNav = (id: string) => {
    onTabChange(id);
    if (isMobile) setMobileOpen(false);
  };

  async function handleSignOut(opts: { keepAuthScreen?: boolean } = {}) {
    if (signingOut) return;
    setSigningOut(true);
    try {
      try { await clearLive(); } catch { /* best effort */ }
      await supabase.auth.signOut();
      clearSessionPersistence();
      toast.success(opts.keepAuthScreen ? "Switch user — please sign in." : "Signed out.");
      navigate("/auth", { replace: true });
    } catch (err) {
      toast.error("Couldn't sign out cleanly. Please refresh.");
    } finally {
      setSigningOut(false);
    }
  }

  const navContent = (
    <>
      <div className="flex items-center gap-3 px-3 mb-8">
        <img src={phaosLogo} alt="Phaos AI logo" className="h-[36px] w-auto drop-shadow-[0_0_12px_hsl(var(--primary)/0.5)]" />
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-foreground font-extrabold text-2xl tracking-tight">PHAOS</span>
          <span className="text-primary font-bold text-2xl italic tracking-tight">AI</span>
        </div>
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Close navigation">
            <X size={22} />
          </button>
        )}
      </div>

      <nav className="space-y-0.5 flex-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                active
                  ? "bg-primary/10 text-foreground border-glow"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <item.icon size={20} className={active ? "text-primary" : "group-hover:text-foreground"} />
              <span className="text-base font-medium tracking-tight">{item.label}</span>
              {active && (
                <motion.div layoutId="activeNav" className="ml-auto w-1 h-4 bg-gradient-phaos rounded-full" />
              )}
            </button>
          );
        })}
        {showContentLab && (
          <button
            onClick={handleContentLab}
            aria-label="Content Lab"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          >
            <Sparkles size={20} className="group-hover:text-foreground" />
            <span className="text-base font-medium tracking-tight">Content Lab</span>
          </button>
        )}
        {isAdmin && (
          <button
            onClick={handleQA}
            aria-label="QA Dashboard"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          >
            <FlaskConical size={20} className="group-hover:text-foreground" />
            <span className="text-base font-medium tracking-tight">QA Dashboard</span>
          </button>
        )}
      </nav>

      {/* Account footer — Logout & Switch User (hidden in public sandbox mode) */}
      {!publicMode && (
        <div className="pt-3 mt-3 border-t border-border/30 space-y-2">
          {userEmail && (
            <div className="px-3 pb-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Signed in as</p>
              <p className="text-xs text-foreground font-medium truncate" title={userEmail}>{userEmail}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleSignOut({ keepAuthScreen: true })}
            disabled={signingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Switch user — sign out and return to login"
          >
            <UserCog size={15} />
            <span>Switch User</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-destructive/90 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Log out"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      )}
    </>
  );

  // Desktop sidebar
  if (!isMobile) {
    return (
      <aside className="w-72 border-r border-border/30 flex flex-col p-4 z-20 bg-background shrink-0" role="navigation" aria-label="Main navigation">
        {navContent}
      </aside>
    );
  }

  // Mobile: hamburger trigger + overlay drawer
  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-background/80 backdrop-blur border border-border/30 text-foreground"
        aria-label="Open navigation menu"
      >
        <Menu size={22} />
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 h-full w-80 z-50 bg-background border-r border-border/30 flex flex-col p-4 overflow-hidden"
              role="navigation"
              aria-label="Main navigation"
            >
              {navContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

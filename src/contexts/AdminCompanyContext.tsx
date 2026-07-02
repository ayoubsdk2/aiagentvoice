import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { adminFetch, verifyAdminToken } from "@/lib/admin-session";

export interface AdminCompany {
  customer_id: string;
  display_name: string;
  is_active: boolean;
  notification_email: string | null;
}

interface Ctx {
  companies: AdminCompany[];
  selectedCustomerId: string | null;
  selectedCompany: AdminCompany | null;
  setSelectedCustomerId: (id: string | null) => void;
  reload: () => Promise<void>;
  loading: boolean;
}

const AdminCompanyContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "phaos.admin.selectedCustomerId";

export function AdminCompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerIdState] = useState<string | null>(() => {
    try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
  });

  const setSelectedCustomerId = useCallback((id: string | null) => {
    setSelectedCustomerIdState(id);
    try {
      if (id) sessionStorage.setItem(STORAGE_KEY, id);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* noop */ }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await verifyAdminToken();
      if (!ok) { setCompanies([]); return; }
      const [{ accounts }, { customers }] = await Promise.all([
        adminFetch<{ accounts: Array<{ customer_id: string; display_name: string; is_active: boolean; notification_email: string | null }> }>("admin-api", "/live-accounts"),
        adminFetch<{ customers: Array<{ id: string; name: string }> }>("admin-api", "/customers"),
      ]);
      const nameMap = new Map(customers.map((c) => [c.id, c.name]));
      const rows: AdminCompany[] = accounts.map((a) => ({
        customer_id: a.customer_id,
        display_name: nameMap.get(a.customer_id) ?? a.display_name,
        is_active: a.is_active,
        notification_email: a.notification_email,
      }));
      // Dedup by customer_id (in case of multiple live_account rows for same customer)
      const seen = new Set<string>();
      const dedup = rows.filter((r) => { if (seen.has(r.customer_id)) return false; seen.add(r.customer_id); return true; });
      dedup.sort((a, b) => a.display_name.localeCompare(b.display_name));
      setCompanies(dedup);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.customer_id === selectedCustomerId) ?? null,
    [companies, selectedCustomerId],
  );

  const value: Ctx = { companies, selectedCustomerId, selectedCompany, setSelectedCustomerId, reload, loading };
  return <AdminCompanyContext.Provider value={value}>{children}</AdminCompanyContext.Provider>;
}

export function useAdminCompany(): Ctx {
  const ctx = useContext(AdminCompanyContext);
  if (!ctx) throw new Error("useAdminCompany must be used inside AdminCompanyProvider");
  return ctx;
}

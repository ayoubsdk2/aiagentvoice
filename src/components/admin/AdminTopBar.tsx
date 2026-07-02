import { Building2 } from "lucide-react";
import { useAdminCompany } from "@/contexts/AdminCompanyContext";

export function AdminTopBar() {
  const { companies, selectedCustomerId, setSelectedCustomerId, selectedCompany, loading } = useAdminCompany();

  return (
    <div className="sticky top-0 z-20 border-b border-border/40 bg-background/80 backdrop-blur px-6 py-3 flex items-center justify-between">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
        Admin Console
      </div>
      <div className="flex items-center gap-2">
        <Building2 size={14} className="text-primary" />
        <label htmlFor="admin-company-select" className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Company
        </label>
        <select
          id="admin-company-select"
          value={selectedCustomerId ?? ""}
          onChange={(e) => setSelectedCustomerId(e.target.value || null)}
          disabled={loading}
          className="h-9 min-w-[260px] rounded-md border border-input bg-card px-3 text-sm text-foreground"
        >
          <option value="">{loading ? "Loading companies…" : "Select a company…"}</option>
          {companies.map((c) => (
            <option key={c.customer_id} value={c.customer_id}>
              {c.display_name}{!c.is_active ? " (disabled)" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="text-[11px] text-muted-foreground tabular-nums">
        {selectedCompany ? `Scoped to: ${selectedCompany.display_name}` : "No company selected"}
      </div>
    </div>
  );
}

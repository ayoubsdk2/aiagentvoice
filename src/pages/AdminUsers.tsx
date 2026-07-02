import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, AlertCircle, Settings2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type SortDir = "asc" | "desc";

interface AdminUserRow {
  id: string;
  full_name?: string | null;
  company?: string | null;
  recent_login?: string | null;
  login_count?: number;
  total_logged_minutes?: number;
  sandbox_minutes?: number;
  live_account?: string;
  avg_session_minutes?: number;
  conversion_rate?: number;
}

interface AdminUsersResponse {
  total: number;
  page: number;
  pageSize: number;
  data: AdminUserRow[];
}

interface ColumnDef {
  key: keyof AdminUserRow;
  label: string;
  defaultVisible: boolean;
  align?: "left" | "right";
  format?: (row: AdminUserRow) => string;
}

const COLUMNS: ColumnDef[] = [
  { key: "full_name", label: "Name", defaultVisible: true },
  { key: "company", label: "Company", defaultVisible: true },
  {
    key: "recent_login",
    label: "Recent Login",
    defaultVisible: true,
    format: (r) =>
      r.recent_login ? new Date(r.recent_login).toLocaleString() : "—",
  },
  { key: "login_count", label: "Login Count", defaultVisible: true, align: "right" },
  {
    key: "total_logged_minutes",
    label: "Total Logged Minutes",
    defaultVisible: true,
    align: "right",
    format: (r) => (r.total_logged_minutes ?? 0).toFixed(1),
  },
  {
    key: "sandbox_minutes",
    label: "Sandbox Minutes",
    defaultVisible: true,
    align: "right",
    format: (r) => (r.sandbox_minutes ?? 0).toFixed(1),
  },
  { key: "live_account", label: "Live Account", defaultVisible: true },
  {
    key: "avg_session_minutes",
    label: "Avg Session Duration",
    defaultVisible: false,
    align: "right",
    format: (r) => `${(r.avg_session_minutes ?? 0).toFixed(1)} min`,
  },
  {
    key: "conversion_rate",
    label: "Conversion Rate",
    defaultVisible: false,
    align: "right",
    format: (r) => `${((r.conversion_rate ?? 0) * 100).toFixed(1)}%`,
  },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function AdminUsers() {
  const navigate = useNavigate();
  const { role, loading: userLoading } = useUser();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<keyof AdminUserRow>("recent_login");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    COLUMNS.filter((c) => c.defaultVisible).map((c) => String(c.key))
  );

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // RBAC gate: redirect non-admins
  useEffect(() => {
    if (!userLoading && role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [role, userLoading, navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        navigate("/auth", { replace: true });
        return;
      }

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy: String(sortBy),
        sortDir,
        filters: JSON.stringify({}),
        visibleColumns: JSON.stringify(visibleColumns),
      });

      const { data, error: fnError } = await supabase.functions.invoke<AdminUsersResponse>(
        `admin-users?${params.toString()}`,
        { method: "GET" }
      );

      if (fnError) {
        // 401/403 → bounce safely
        const status = (fnError as { context?: { status?: number } }).context?.status;
        if (status === 401) {
          navigate("/auth", { replace: true });
          return;
        }
        if (status === 403) {
          navigate("/", { replace: true });
          return;
        }
        throw new Error("fetch_failed");
      }
      if (!data) throw new Error("empty_response");

      setRows(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("Something went wrong loading admin data");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortDir, visibleColumns, navigate]);

  useEffect(() => {
    if (role === "admin") void fetchData();
  }, [role, fetchData]);

  const handleSort = (key: keyof AdminUserRow) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const toggleColumn = (key: string, checked: boolean) => {
    setVisibleColumns((prev) =>
      checked ? Array.from(new Set([...prev, key])) : prev.filter((k) => k !== key)
    );
  };

  const visibleColDefs = useMemo(
    () => COLUMNS.filter((c) => visibleColumns.includes(String(c.key))),
    [visibleColumns]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  if (userLoading || role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/30 bg-background/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-1.5"
            >
              <ArrowLeft size={16} />
              Back
            </Button>
            <h1 className="text-lg font-bold tracking-tight">Admin · Users</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 size={14} />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={String(col.key)}
                  checked={visibleColumns.includes(String(col.key))}
                  onCheckedChange={(checked) =>
                    toggleColumn(String(col.key), Boolean(checked))
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/40 text-sm text-destructive"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 border-b border-border/50">
                <tr>
                  {visibleColDefs.map((col) => {
                    const active = sortBy === col.key;
                    return (
                      <th
                        key={String(col.key)}
                        scope="col"
                        className={`px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground select-none ${
                          col.align === "right" ? "text-right" : "text-left"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
                            active ? "text-primary" : ""
                          }`}
                          aria-sort={
                            active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                          }
                        >
                          {col.label}
                          {active && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                    <tr key={`sk-${i}`} className="border-b border-border/30">
                      {visibleColDefs.map((col) => (
                        <td key={String(col.key)} className="px-4 py-3">
                          <Skeleton className="h-4 w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleColDefs.length}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/30 hover:bg-secondary/20 transition-colors"
                    >
                      {visibleColDefs.map((col) => {
                        const value = col.format
                          ? col.format(row)
                          : (row[col.key] as string | number | undefined);
                        return (
                          <td
                            key={String(col.key)}
                            className={`px-4 py-3 ${
                              col.align === "right" ? "text-right tabular-nums" : ""
                            }`}
                          >
                            {value ?? "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
          <div className="text-muted-foreground">
            Showing <span className="text-foreground font-medium">{showingFrom}</span>–
            <span className="text-foreground font-medium">{showingTo}</span> of{" "}
            <span className="text-foreground font-medium">{total}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-xs">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

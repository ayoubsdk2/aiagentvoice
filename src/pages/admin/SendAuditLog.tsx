import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Mail, Send } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";

interface InviteLog {
  id: string;
  industry_id: string;
  industry_name: string;
  sender_email: string;
  sender_name: string | null;
  recipients_to: string[];
  recipients_cc: string[];
  recipients_bcc: string[];
  recipient_count: number;
  subject: string;
  link: string;
  status: "sent" | "failed";
  error_message: string | null;
  resend_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  duration_ms: number | null;
  created_at: string;
}

function fmtMs(n: number | null) {
  if (n == null) return "—";
  if (n < 1000) return `${n} ms`;
  return `${(n / 1000).toFixed(2)} s`;
}

export default function SendAuditLog() {
  usePageMeta({
    title: "SEND Audit Log · Phaos AI Admin",
    description: "Audit log of industry voice agent invite SEND actions.",
    path: "/admin/send-audit",
  });

  const [rows, setRows] = useState<InviteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { logs } = await adminFetch<{ logs: InviteLog[] }>("admin-api", "/send-audit");
      setRows(logs ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) =>
      r.industry_name.toLowerCase().includes(q) ||
      r.industry_id.toLowerCase().includes(q) ||
      r.sender_email.toLowerCase().includes(q) ||
      (r.ip_address ?? "").toLowerCase().includes(q) ||
      r.recipients_to.join(" ").toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const metrics = useMemo(() => {
    const total = rows.length;
    const sent = rows.filter((r) => r.status === "sent").length;
    const failed = total - sent;
    const recipients = rows.reduce((a, r) => a + r.recipient_count, 0);
    const ips = new Set(rows.map((r) => r.ip_address).filter(Boolean) as string[]);
    const senders = new Set(rows.map((r) => r.sender_email));
    const industries = new Set(rows.map((r) => r.industry_id));
    return { total, sent, failed, recipients, ipCount: ips.size, senders: senders.size, industries: industries.size };
  }, [rows]);

  // Per-IP aggregation: # sends and total time spent (sum of duration_ms)
  const perIp = useMemo(() => {
    const map = new Map<string, { ip: string; sends: number; totalMs: number; lastAt: string; failed: number }>();
    for (const r of rows) {
      const ip = r.ip_address ?? "unknown";
      const e = map.get(ip) ?? { ip, sends: 0, totalMs: 0, lastAt: r.created_at, failed: 0 };
      e.sends += 1;
      e.totalMs += r.duration_ms ?? 0;
      if (r.status === "failed") e.failed += 1;
      if (r.created_at > e.lastAt) e.lastAt = r.created_at;
      map.set(ip, e);
    }
    return Array.from(map.values()).sort((a, b) => b.sends - a.sends);
  }, [rows]);

  const perIndustry = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sends: number; failed: number }>();
    for (const r of rows) {
      const e = map.get(r.industry_id) ?? { id: r.industry_id, name: r.industry_name, sends: 0, failed: 0 };
      e.sends += 1;
      if (r.status === "failed") e.failed += 1;
      map.set(r.industry_id, e);
    }
    return Array.from(map.values()).sort((a, b) => b.sends - a.sends).slice(0, 15);
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" /> SEND Audit Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Every industry voice agent invite SEND. Phaos admins only.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
          Refresh
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard label="Total Sends" value={metrics.total} />
        <MetricCard label="Sent" value={metrics.sent} accent="text-emerald-500" />
        <MetricCard label="Failed" value={metrics.failed} accent="text-red-500" />
        <MetricCard label="Recipients" value={metrics.recipients} />
        <MetricCard label="Unique IPs" value={metrics.ipCount} />
        <MetricCard label="Senders" value={metrics.senders} />
        <MetricCard label="Industries" value={metrics.industries} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Per-IP Activity</CardTitle></CardHeader>
          <CardContent>
            {perIp.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data.</p>
            ) : (
              <div className="overflow-auto max-h-80">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-1.5 pr-2">IP</th>
                      <th className="text-right py-1.5 pr-2">Sends</th>
                      <th className="text-right py-1.5 pr-2">Failed</th>
                      <th className="text-right py-1.5 pr-2">Time Spent</th>
                      <th className="text-right py-1.5">Last Send</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perIp.map((r) => (
                      <tr key={r.ip} className="border-b border-border/30">
                        <td className="py-1.5 pr-2 font-mono">{r.ip}</td>
                        <td className="py-1.5 pr-2 text-right">{r.sends}</td>
                        <td className="py-1.5 pr-2 text-right">{r.failed}</td>
                        <td className="py-1.5 pr-2 text-right">{fmtMs(r.totalMs)}</td>
                        <td className="py-1.5 text-right text-muted-foreground">{new Date(r.lastAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top Industries Sent</CardTitle></CardHeader>
          <CardContent>
            {perIndustry.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data.</p>
            ) : (
              <div className="overflow-auto max-h-80">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-1.5 pr-2">Industry</th>
                      <th className="text-right py-1.5 pr-2">Sends</th>
                      <th className="text-right py-1.5">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perIndustry.map((r) => (
                      <tr key={r.id} className="border-b border-border/30">
                        <td className="py-1.5 pr-2">{r.name}</td>
                        <td className="py-1.5 pr-2 text-right">{r.sends}</td>
                        <td className="py-1.5 text-right">{r.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" /> Recent SEND Events
          </CardTitle>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter industry, sender, IP, recipient…"
            className="max-w-xs h-8 text-xs"
          />
        </CardHeader>
        <CardContent>
          {err && <p className="text-xs text-red-500 mb-2">Error: {err}</p>}
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">No SEND actions logged yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 pr-2">When</th>
                    <th className="text-left py-2 pr-2">Industry</th>
                    <th className="text-left py-2 pr-2">Sender</th>
                    <th className="text-left py-2 pr-2">To</th>
                    <th className="text-right py-2 pr-2">#</th>
                    <th className="text-left py-2 pr-2">IP</th>
                    <th className="text-right py-2 pr-2">Time</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border/30 align-top">
                      <td className="py-2 pr-2 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="font-medium">{r.industry_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{r.industry_id}</div>
                      </td>
                      <td className="py-2 pr-2">
                        <div>{r.sender_name || r.sender_email}</div>
                        <div className="text-[10px] text-muted-foreground">{r.sender_email}</div>
                      </td>
                      <td className="py-2 pr-2 max-w-[280px]">
                        <div className="truncate" title={r.recipients_to.join(", ")}>
                          {r.recipients_to.join(", ")}
                        </div>
                        {(r.recipients_cc.length + r.recipients_bcc.length) > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            +{r.recipients_cc.length} cc, +{r.recipients_bcc.length} bcc
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">{r.recipient_count}</td>
                      <td className="py-2 pr-2 font-mono">{r.ip_address ?? "—"}</td>
                      <td className="py-2 pr-2 text-right">{fmtMs(r.duration_ms)}</td>
                      <td className="py-2">
                        {r.status === "sent" ? (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">sent</Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-500/40 text-red-500" title={r.error_message ?? ""}>
                            failed
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${accent ?? ""}`}>{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

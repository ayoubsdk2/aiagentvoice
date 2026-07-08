import { useEffect, useMemo, useState } from "react";
import { Phone, ArrowRight, MapPin, Loader2, RefreshCcw, Plus, CheckCircle2, AlertTriangle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Asset {
  id: string;
  organization_id: string;
  location_id: string | null;
  business_origin_number: string | null;
  ai_gateway_number: string | null;
  status: "pending_forward" | "active" | "paused" | "failed";
  last_inbound_at: string | null;
  notes: string | null;
}
interface Loc {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

const STATUS_META: Record<Asset["status"], { label: string; className: string; icon: typeof CheckCircle2 }> = {
  pending_forward: { label: "Pending forwarding", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: AlertTriangle },
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
  paused: { label: "Paused", className: "bg-muted/40 text-muted-foreground border-border/60", icon: AlertTriangle },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertTriangle },
};

function isE164(v: string) { return /^\+\d{8,15}$/.test(v.trim()); }

export default function TelephonyPage() {
  const { org, status } = useCurrentOrg();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [adding, setAdding] = useState(false);

  async function refresh() {
    if (!org) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: a, error: aErr }, { data: l, error: lErr }] = await Promise.all([
        supabase.from("telephony_assets").select("*").eq("organization_id", org.id).order("created_at"),
        supabase.from("org_locations").select("id,name,city,state").eq("organization_id", org.id).order("is_primary", { ascending: false }),
      ]);
      if (aErr) throw aErr;
      if (lErr) throw lErr;
      setAssets((a ?? []) as Asset[]);
      setLocations((l ?? []) as Loc[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load telephony");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [org?.id]);

  const counts = useMemo(() => ({
    active: assets.filter(a => a.status === "active").length,
    pending: assets.filter(a => a.status === "pending_forward").length,
    total: assets.length,
  }), [assets]);

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!org) {
    return <div className="text-sm text-muted-foreground">No organization found.</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Phone className="h-3.5 w-3.5" /> Operations
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Phone Numbers</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Map every business line you want Phoebe to answer (the <span className="text-foreground font-medium">origin</span>) to the AI gateway number we provide (the <span className="text-foreground font-medium">target</span>). Once your forwarding rule is in place, mark the row Active.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void refresh()} className="gap-2">
            <RefreshCcw className="w-4 h-4" /> Refresh
          </Button>
          <Button onClick={() => setAdding(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add number
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Total numbers" value={counts.total} />
        <Kpi label="Active" value={counts.active} accent />
        <Kpi label="Pending forwarding" value={counts.pending} />
      </div>

      {assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-10 text-center">
          <Phone className="mx-auto h-7 w-7 text-muted-foreground mb-3" />
          <h3 className="text-base font-semibold">No phone numbers connected yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Add the business line you want Phoebe to answer. We'll show you the AI gateway number to forward to.
          </p>
          <Button className="mt-4 gap-2" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Add your first number</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Business line (origin)</th>
                <th className="px-4 py-3 text-left">AI gateway (target)</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last inbound</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {assets.map(a => {
                const loc = locations.find(l => l.id === a.location_id);
                const meta = STATUS_META[a.status];
                const Icon = meta.icon;
                return (
                  <tr key={a.id} className="border-b border-border/40 last:border-0 hover:bg-muted/10">
                    <td className="px-4 py-3 font-mono">{a.business_origin_number || <span className="text-muted-foreground italic">not set</span>}</td>
                    <td className="px-4 py-3"><div className="inline-flex items-center gap-2 font-mono"><ArrowRight className="w-3.5 h-3.5 text-primary" />{a.ai_gateway_number || <span className="text-muted-foreground italic">not set</span>}</div></td>
                    <td className="px-4 py-3 text-muted-foreground">{loc ? <span className="inline-flex items-center gap-1.5"><MapPin className="w-3 h-3" />{loc.name}</span> : "—"}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className={`text-[10px] gap-1 ${meta.className}`}><Icon className="w-3 h-3" />{meta.label}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{a.last_inbound_at ? new Date(a.last_inbound_at).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setEditing(a)}><Pencil className="w-3.5 h-3.5" /> Edit</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AssetDialog
        open={adding || !!editing}
        onOpenChange={(o) => { if (!o) { setAdding(false); setEditing(null); } }}
        orgId={org.id}
        locations={locations}
        existing={editing}
        onSaved={async () => { setAdding(false); setEditing(null); await refresh(); }}
      />
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border border-border/60 ${accent ? "bg-primary/10" : "bg-card/40"} p-4`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function AssetDialog({
  open, onOpenChange, orgId, locations, existing, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string;
  locations: Loc[];
  existing: Asset | null;
  onSaved: () => Promise<void>;
}) {
  const [origin, setOrigin] = useState("");
  const [target, setTarget] = useState("");
  const [locId, setLocId] = useState<string>("none");
  const [statusVal, setStatusVal] = useState<Asset["status"]>("pending_forward");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing) {
      setOrigin(existing.business_origin_number || "");
      setTarget(existing.ai_gateway_number || "");
      setLocId(existing.location_id || "none");
      setStatusVal(existing.status);
    } else {
      setOrigin(""); setTarget(""); setLocId("none"); setStatusVal("pending_forward");
    }
  }, [existing, open]);

  async function save() {
    if (origin && !isE164(origin)) { toast.error("Origin must be E.164 (e.g. +15551234567)"); return; }
    if (target && !isE164(target)) { toast.error("Target must be E.164"); return; }
    if (!origin && !target) { toast.error("Add at least one number"); return; }
    setBusy(true);
    try {
      const payload = {
        organization_id: orgId,
        business_origin_number: origin.trim() || null,
        ai_gateway_number: target.trim() || null,
        location_id: locId === "none" ? null : locId,
        status: statusVal,
      };
      if (existing) {
        const { error } = await supabase.from("telephony_assets").update(payload).eq("id", existing.id);
        if (error) throw error;
        toast.success("Number updated");
      } else {
        const { error } = await supabase.from("telephony_assets").insert(payload);
        if (error) throw error;
        toast.success("Number added");
      }
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!existing) return;
    if (!confirm("Remove this number mapping?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("telephony_assets").delete().eq("id", existing.id);
      if (error) throw error;
      toast.success("Removed");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit number" : "Add phone number"}</DialogTitle>
          <DialogDescription>
            Map the customer-facing line to the AI gateway target Phaos provides. Once your forwarding rule is in place, switch the status to <span className="font-semibold text-foreground">Active</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Business line (origin) — your existing number</Label>
            <Input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="+15551234567" />
          </div>
          <div className="grid gap-1.5">
            <Label>AI gateway (target) — provided by Phaos</Label>
            <Input value={target} onChange={e => setTarget(e.target.value)} placeholder="+18887776666" />
          </div>
          <div className="grid gap-1.5">
            <Label>Location</Label>
            <Select value={locId} onValueChange={setLocId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}{l.city ? ` · ${l.city}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={statusVal} onValueChange={(v) => setStatusVal(v as Asset["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending_forward">Pending forwarding</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          {existing ? (
            <Button variant="ghost" className="text-destructive" onClick={remove} disabled={busy}>Delete</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy} className="gap-1.5">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {existing ? "Save changes" : "Add number"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

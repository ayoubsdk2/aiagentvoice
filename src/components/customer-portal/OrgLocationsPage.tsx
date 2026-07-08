import { useEffect, useState } from "react";
import { MapPin, Plus, Loader2, RefreshCcw, Pencil, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Loc {
  id: string;
  organization_id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_primary: boolean;
}

export default function OrgLocationsPage() {
  const { org, status } = useCurrentOrg();
  const [rows, setRows] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Loc | null>(null);
  const [adding, setAdding] = useState(false);

  async function refresh() {
    if (!org) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("org_locations")
        .select("*")
        .eq("organization_id", org.id)
        .order("is_primary", { ascending: false })
        .order("created_at");
      if (error) throw error;
      setRows((data ?? []) as Loc[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load locations");
    } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [org?.id]);

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!org) return <div className="text-sm text-muted-foreground">No organization found.</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> Operations
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Locations</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Manage every branch, dealership, or service hub Phoebe routes calls between. Each location can be linked to its own phone numbers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void refresh()} className="gap-2"><RefreshCcw className="w-4 h-4" /> Refresh</Button>
          <Button onClick={() => setAdding(true)} className="gap-2"><Plus className="w-4 h-4" /> Add location</Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-10 text-center">
          <MapPin className="mx-auto h-7 w-7 text-muted-foreground mb-3" />
          <h3 className="text-base font-semibold">No locations yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Add at least one location so phone numbers and analytics can be scoped properly.</p>
          <Button className="mt-4 gap-2" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Add your first location</Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map(r => (
            <button key={r.id} onClick={() => setEditing(r)} className="text-left rounded-2xl border border-border/60 bg-card/40 p-5 hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold">{r.name}</h3>
                    {r.is_primary && <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/30"><Star className="w-3 h-3" />Primary</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" />
                    {[r.city, r.state].filter(Boolean).join(", ") || "No address set"}
                  </div>
                </div>
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}

      <LocationDialog
        open={adding || !!editing}
        onOpenChange={(o) => { if (!o) { setAdding(false); setEditing(null); } }}
        orgId={org.id}
        existing={editing}
        existingPrimary={rows.find(r => r.is_primary) ?? null}
        onSaved={async () => { setAdding(false); setEditing(null); await refresh(); }}
      />
    </div>
  );
}

function LocationDialog({
  open, onOpenChange, orgId, existing, existingPrimary, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string;
  existing: Loc | null;
  existingPrimary: Loc | null;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name); setCity(existing.city || ""); setStateVal(existing.state || ""); setIsPrimary(existing.is_primary);
    } else {
      setName(""); setCity(""); setStateVal(""); setIsPrimary(false);
    }
  }, [existing, open]);

  async function save() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    try {
      // If marking primary, unset others first
      if (isPrimary && (!existing || !existing.is_primary) && existingPrimary && existingPrimary.id !== existing?.id) {
        await supabase.from("org_locations").update({ is_primary: false }).eq("id", existingPrimary.id);
      }
      const payload = {
        organization_id: orgId,
        name: name.trim(),
        city: city.trim() || null,
        state: stateVal.trim() || null,
        is_primary: isPrimary,
      };
      if (existing) {
        const { error } = await supabase.from("org_locations").update(payload).eq("id", existing.id);
        if (error) throw error;
        toast.success("Location updated");
      } else {
        const { error } = await supabase.from("org_locations").insert(payload);
        if (error) throw error;
        toast.success("Location added");
      }
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!existing) return;
    if (existing.is_primary) { toast.error("Cannot delete the primary location"); return; }
    if (!confirm("Delete this location?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("org_locations").delete().eq("id", existing.id);
      if (error) throw error;
      toast.success("Deleted");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit location" : "Add location"}</DialogTitle>
          <DialogDescription>Locations group phone numbers, agents, and analytics.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Main Headquarters" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>City</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>State / Region</Label><Input value={stateVal} onChange={e => setStateVal(e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} />
            Mark as primary location
          </label>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {existing ? <Button variant="ghost" className="text-destructive" onClick={remove} disabled={busy}>Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy} className="gap-1.5">{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{existing ? "Save changes" : "Add"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

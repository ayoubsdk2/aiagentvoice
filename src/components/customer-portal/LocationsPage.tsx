import { useMemo, useState } from "react";
import { z } from "zod";
import {
  MapPin,
  Plus,
  Search,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  Phone,
  Activity,
  Clock,
  Settings2,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  Loader2,
  Building2,
  AlertTriangle,
  History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useLocations,
  locationCapabilities,
  logLocationAudit,
  TIMEZONES,
  LOCATION_TEMPLATES,
  type LocationRow,
  type BusinessHours,
  type RoutingRules,
  type LocationAddress,
} from "@/hooks/useLocations";

const DAYS: (keyof BusinessHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const addressSchema = z.object({
  line1: z.string().trim().max(200).optional().or(z.literal("")),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  region: z.string().trim().max(100).optional().or(z.literal("")),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),
});

const locationFormSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  timezone: z.string().min(1, "Timezone is required"),
  status: z.enum(["active", "paused", "inactive"]),
  address: addressSchema,
});

type LocationFormValues = z.infer<typeof locationFormSchema>;

export default function LocationsPage() {
  const { rows, loading, error, role, orgId, refresh } = useLocations();
  const caps = locationCapabilities(role);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [detail, setDetail] = useState<LocationRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LocationRow | null>(null);
  const { toast } = useToast();

  if (caps.redirectToSample) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center">
        <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h2 className="text-xl font-semibold">Trial mode</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Real location management unlocks once your organization is provisioned. In the
          meantime, explore the Sample Live Dashboard or take Phoebe for a spin in the
          Sandbox.
        </p>
      </div>
    );
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const addr = r.address;
      const haystack = [
        r.name,
        addr.city,
        addr.region,
        addr.postal_code,
        addr.country,
        r.timezone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, statusFilter]);

  const totals = useMemo(() => {
    const active = rows.filter((r) => r.status === "active").length;
    const phones = rows.reduce((acc, r) => acc + r.phone_count, 0);
    const calls = rows.reduce((acc, r) => acc + r.call_count_30d, 0);
    return { active, total: rows.length, phones, calls };
  }, [rows]);

  async function handleDelete(loc: LocationRow) {
    try {
      const { error: delErr } = await supabase
        .from("portal_locations")
        .delete()
        .eq("id", loc.id);
      if (delErr) throw delErr;
      await logLocationAudit({
        orgId: loc.org_id,
        locationId: loc.id,
        eventType: "location.deleted",
        metadata: { name: loc.name },
      });
      toast({ title: "Location deleted", description: loc.name });
      setConfirmDelete(null);
      setDetail(null);
      await refresh();
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            Operations
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Locations</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Manage every branch, dealership, or service hub Phoebe answers for. Each
            location keeps its own greeting, hours, escalation paths, and integration
            overrides.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {caps.canApplyTemplate && (
            <Button
              variant="outline"
              onClick={() => setTemplateOpen(true)}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Templates
            </Button>
          )}
          {caps.canCreate && (
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Location
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total locations" value={totals.total} icon={MapPin} />
        <KpiCard label="Active" value={totals.active} icon={Activity} accent />
        <KpiCard label="Phone numbers" value={totals.phones} icon={Phone} />
        <KpiCard label="Calls (30d)" value={totals.calls} icon={History} />
      </div>

      <Card className="border-border/60 bg-card/40">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, city, or zip…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-md border border-border/60 p-0.5">
              <Button
                size="sm"
                variant={view === "grid" ? "secondary" : "ghost"}
                onClick={() => setView("grid")}
                className="h-8 gap-1 px-2"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={view === "list" ? "secondary" : "ghost"}
                onClick={() => setView("list")}
                className="h-8 gap-1 px-2"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <div className="font-medium text-destructive">Couldn't load locations</div>
            <div className="text-muted-foreground">{error}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState canCreate={caps.canCreate} onAdd={() => setAddOpen(true)} />
      ) : view === "grid" ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((loc) => (
            <LocationCard key={loc.id} loc={loc} onOpen={() => setDetail(loc)} />
          ))}
        </div>
      ) : (
        <LocationListView rows={filtered} onOpen={(l) => setDetail(l)} />
      )}

      <AddLocationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        orgId={orgId}
        onCreated={async () => {
          setAddOpen(false);
          await refresh();
        }}
      />

      <TemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        orgId={orgId}
        onApplied={async () => {
          setTemplateOpen(false);
          await refresh();
        }}
      />

      <LocationDetailSheet
        location={detail}
        onClose={() => setDetail(null)}
        onChanged={refresh}
        onRequestDelete={(l) => setConfirmDelete(l)}
        canDelete={caps.canDelete}
      />

      <AlertDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this location?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmDelete?.name}</strong> will be removed. Assigned phone
              numbers will be unlinked but kept. This action is recorded in the audit
              log and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete location
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof MapPin;
  accent?: boolean;
}) {
  return (
    <Card
      className={`border-border/60 ${
        accent ? "bg-primary/10" : "bg-card/40"
      } backdrop-blur`}
    >
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        </div>
        <Icon className={`h-5 w-5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </CardContent>
    </Card>
  );
}

function LocationCard({
  loc,
  onOpen,
}: {
  loc: LocationRow;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group rounded-2xl border border-border/60 bg-card/40 p-5 text-left transition-all hover:border-primary/50 hover:bg-card/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">{loc.name}</h3>
            <StatusBadge status={loc.status} />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">
              {[loc.address.city, loc.address.region].filter(Boolean).join(", ") ||
                "No address set"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {loc.timezone}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <Separator className="my-4 bg-border/40" />
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Numbers" value={loc.active_phone_count} sub={`/${loc.phone_count}`} />
        <Stat label="Calls 30d" value={loc.call_count_30d} />
        <Stat label="Leads 30d" value={loc.lead_count_30d} />
      </div>
    </button>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div>
      <div className="text-lg font-semibold tabular-nums">
        {value}
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: LocationRow["status"] }) {
  const map: Record<LocationRow["status"], { label: string; className: string }> = {
    active: {
      label: "Active",
      className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    },
    paused: {
      label: "Paused",
      className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    },
    inactive: {
      label: "Inactive",
      className: "bg-muted/40 text-muted-foreground border-border/60",
    },
  };
  const cfg = map[status];
  return (
    <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

function LocationListView({
  rows,
  onOpen,
}: {
  rows: LocationRow[];
  onOpen: (l: LocationRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Location</th>
            <th className="px-4 py-3 text-left">City</th>
            <th className="px-4 py-3 text-left">Timezone</th>
            <th className="px-4 py-3 text-right">Numbers</th>
            <th className="px-4 py-3 text-right">Calls 30d</th>
            <th className="px-4 py-3 text-right">Leads 30d</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onOpen(r)}
              className="cursor-pointer border-b border-border/40 last:border-0 transition-colors hover:bg-muted/20"
            >
              <td className="px-4 py-3 font-medium">{r.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {[r.address.city, r.address.region].filter(Boolean).join(", ") || "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.timezone}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {r.active_phone_count}/{r.phone_count}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{r.call_count_30d}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.lead_count_30d}</td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({
  canCreate,
  onAdd,
}: {
  canCreate: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-12 text-center">
      <MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h3 className="text-lg font-semibold">No locations yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Add your first branch, dealership, or service center to start routing calls
        through Phoebe.
      </p>
      {canCreate && (
        <Button className="mt-4 gap-2" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add Location
        </Button>
      )}
    </div>
  );
}

// ---------- Add / Edit ----------

function AddLocationDialog({
  open,
  onOpenChange,
  orgId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string | null;
  onCreated: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<LocationFormValues>({
    name: "",
    timezone: "America/New_York",
    status: "active",
    address: {
      line1: "",
      line2: "",
      city: "",
      region: "",
      postal_code: "",
      country: "United States",
    },
  });

  function reset() {
    setForm({
      name: "",
      timezone: "America/New_York",
      status: "active",
      address: {
        line1: "",
        line2: "",
        city: "",
        region: "",
        postal_code: "",
        country: "United States",
      },
    });
  }

  async function submit() {
    const parsed = locationFormSchema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Check your inputs",
        description: parsed.error.issues[0]?.message ?? "Invalid form",
        variant: "destructive",
      });
      return;
    }
    if (!orgId) {
      toast({ title: "No organization found", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("portal_locations")
        .insert([
          {
            org_id: orgId,
            name: parsed.data.name,
            timezone: parsed.data.timezone,
            status: parsed.data.status,
            address: parsed.data.address as never,
            business_hours: {} as never,
            routing_rules: {} as never,
          },
        ])
        .select("id")
        .single();
      if (error) throw error;
      await logLocationAudit({
        orgId,
        locationId: data?.id,
        eventType: "location.created",
        metadata: { name: parsed.data.name, timezone: parsed.data.timezone },
      });
      toast({ title: "Location created", description: parsed.data.name });
      reset();
      await onCreated();
    } catch (e) {
      toast({
        title: "Failed to create location",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Location</DialogTitle>
          <DialogDescription>
            Create a new branch, office, or service hub. You can configure hours and
            routing rules right after.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Location name</Label>
            <Input
              value={form.name}
              maxLength={120}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Atlanta Service Center"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select
                value={form.timezone}
                onValueChange={(v) => setForm({ ...form, timezone: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as LocationFormValues["status"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Address
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Input
              placeholder="Street address"
              value={form.address.line1 ?? ""}
              maxLength={200}
              onChange={(e) =>
                setForm({
                  ...form,
                  address: { ...form.address, line1: e.target.value },
                })
              }
            />
            <Input
              placeholder="Suite, floor (optional)"
              value={form.address.line2 ?? ""}
              maxLength={200}
              onChange={(e) =>
                setForm({
                  ...form,
                  address: { ...form.address, line2: e.target.value },
                })
              }
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                placeholder="City"
                value={form.address.city ?? ""}
                maxLength={100}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, city: e.target.value },
                  })
                }
              />
              <Input
                placeholder="State / Region"
                value={form.address.region ?? ""}
                maxLength={100}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, region: e.target.value },
                  })
                }
              />
              <Input
                placeholder="ZIP / Postal"
                value={form.address.postal_code ?? ""}
                maxLength={20}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, postal_code: e.target.value },
                  })
                }
              />
            </div>
            <Input
              placeholder="Country"
              value={form.address.country ?? ""}
              maxLength={60}
              onChange={(e) =>
                setForm({
                  ...form,
                  address: { ...form.address, country: e.target.value },
                })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Templates ----------

function TemplateDialog({
  open,
  onOpenChange,
  orgId,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string | null;
  onApplied: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [applying, setApplying] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function apply(templateId: string) {
    const tpl = LOCATION_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl || !orgId) return;
    if (!name.trim()) {
      toast({ title: "Give the location a name first", variant: "destructive" });
      return;
    }
    setApplying(templateId);
    try {
      const { data, error } = await supabase
        .from("portal_locations")
        .insert([
          {
            org_id: orgId,
            name: name.trim(),
            timezone: tpl.timezone,
            status: "active",
            address: {} as never,
            business_hours: tpl.business_hours as never,
            routing_rules: tpl.routing_rules as never,
          },
        ])
        .select("id")
        .single();
      if (error) throw error;
      await logLocationAudit({
        orgId,
        locationId: data?.id,
        eventType: "location.created_from_template",
        metadata: { template: templateId, name: name.trim() },
      });
      toast({ title: "Location created from template", description: tpl.name });
      setName("");
      await onApplied();
    } catch (e) {
      toast({
        title: "Could not apply template",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setApplying(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Location Templates</DialogTitle>
          <DialogDescription>
            Pre-built business hours and routing rules for common location types. Pick
            one and we'll set sensible defaults you can refine later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>New location name</Label>
          <Input
            placeholder="e.g. Dallas Showroom"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {LOCATION_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-xl border border-border/60 bg-card/40 p-4"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h4 className="font-medium">{tpl.name}</h4>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{tpl.description}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                disabled={applying === tpl.id}
                onClick={() => apply(tpl.id)}
              >
                {applying === tpl.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Use template"
                )}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Detail Sheet ----------

function LocationDetailSheet({
  location,
  onClose,
  onChanged,
  onRequestDelete,
  canDelete,
}: {
  location: LocationRow | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onRequestDelete: (l: LocationRow) => void;
  canDelete: boolean;
}) {
  const open = Boolean(location);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl"
      >
        {location && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <SheetTitle>{location.name}</SheetTitle>
                <StatusBadge status={location.status} />
              </div>
              <SheetDescription>
                {[location.address.city, location.address.region]
                  .filter(Boolean)
                  .join(", ") || "No address set"}{" "}
                · {location.timezone}
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="hours">Business Hours</TabsTrigger>
                <TabsTrigger value="routing">Routing</TabsTrigger>
                <TabsTrigger value="integrations">Integrations</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <OverviewPanel
                  location={location}
                  onSaved={onChanged}
                />
                {canDelete && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <ShieldAlert className="h-4 w-4" />
                      Danger zone
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Deleting this location unlinks all assigned phone numbers and
                      removes routing rules. This action cannot be undone.
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-3 gap-2"
                      onClick={() => onRequestDelete(location)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete location
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="hours" className="mt-4">
                <BusinessHoursPanel
                  location={location}
                  onSaved={onChanged}
                />
              </TabsContent>

              <TabsContent value="routing" className="mt-4">
                <RoutingPanel
                  location={location}
                  onSaved={onChanged}
                />
              </TabsContent>

              <TabsContent value="integrations" className="mt-4">
                <IntegrationOverridesPanel location={location} />
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <ActivityPanel location={location} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function OverviewPanel({
  location,
  onSaved,
}: {
  location: LocationRow;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<LocationFormValues>({
    name: location.name,
    timezone: location.timezone,
    status: location.status,
    address: location.address,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!location.can_manage) {
      toast({
        title: "Read-only",
        description: "Your role can't edit this location.",
        variant: "destructive",
      });
      return;
    }
    const parsed = locationFormSchema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Check your inputs",
        description: parsed.error.issues[0]?.message ?? "Invalid form",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("portal_locations")
        .update({
          name: parsed.data.name,
          timezone: parsed.data.timezone,
          status: parsed.data.status,
          address: parsed.data.address as never,
        })
        .eq("id", location.id);
      if (error) throw error;
      await logLocationAudit({
        orgId: location.org_id,
        locationId: location.id,
        eventType: "location.updated",
        metadata: { fields: ["name", "timezone", "status", "address"] },
      });
      toast({ title: "Location updated" });
      setEditing(false);
      await onSaved();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Numbers" value={location.phone_count} icon={Phone} />
        <KpiCard label="Calls 30d" value={location.call_count_30d} icon={Activity} />
        <KpiCard label="Leads 30d" value={location.lead_count_30d} icon={Sparkles} />
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium">Details</div>
          {!editing && location.can_manage && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
        {!editing ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Name" value={location.name} />
            <Field label="Timezone" value={location.timezone} />
            <Field label="Status" value={location.status} />
            <Field
              label="Address"
              value={
                [
                  location.address.line1,
                  location.address.line2,
                  [location.address.city, location.address.region]
                    .filter(Boolean)
                    .join(", "),
                  location.address.postal_code,
                  location.address.country,
                ]
                  .filter(Boolean)
                  .join("\n") || "—"
              }
            />
          </dl>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                maxLength={120}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select
                  value={form.timezone}
                  onValueChange={(v) => setForm({ ...form, timezone: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as LocationFormValues["status"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input
              placeholder="Street"
              value={form.address.line1 ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  address: { ...form.address, line1: e.target.value },
                })
              }
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                placeholder="City"
                value={form.address.city ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, city: e.target.value },
                  })
                }
              />
              <Input
                placeholder="Region"
                value={form.address.region ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, region: e.target.value },
                  })
                }
              />
              <Input
                placeholder="ZIP"
                value={form.address.postal_code ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, postal_code: e.target.value },
                  })
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-line text-sm">{value}</dd>
    </div>
  );
}

function BusinessHoursPanel({
  location,
  onSaved,
}: {
  location: LocationRow;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [hours, setHours] = useState<BusinessHours>(location.business_hours);
  const [saving, setSaving] = useState(false);

  function update(day: keyof BusinessHours, patch: Partial<{ open: string; close: string; closed: boolean }>) {
    setHours((h) => {
      const cur = (h[day] as { open: string; close: string; closed?: boolean }) ?? {
        open: "09:00",
        close: "17:00",
      };
      return { ...h, [day]: { ...cur, ...patch } };
    });
  }

  async function save() {
    if (!location.can_manage) return;
    // simple validation: open < close when not closed
    for (const d of DAYS) {
      const v = hours[d] as { open: string; close: string; closed?: boolean } | undefined;
      if (v && !v.closed && v.open >= v.close) {
        toast({
          title: `Invalid hours for ${d}`,
          description: "Open time must be earlier than close time.",
          variant: "destructive",
        });
        return;
      }
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("portal_locations")
        .update({ business_hours: hours as never })
        .eq("id", location.id);
      if (error) throw error;
      await logLocationAudit({
        orgId: location.org_id,
        locationId: location.id,
        eventType: "location.hours_updated",
      });
      toast({ title: "Business hours saved" });
      await onSaved();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="space-y-2">
          {DAYS.map((d) => {
            const v = (hours[d] as { open: string; close: string; closed?: boolean } | undefined) ?? {
              open: "09:00",
              close: "17:00",
            };
            return (
              <div key={d} className="flex items-center gap-3">
                <div className="w-24 text-sm capitalize text-muted-foreground">{d}</div>
                <Switch
                  checked={!v.closed}
                  disabled={!location.can_manage}
                  onCheckedChange={(checked) => update(d, { closed: !checked })}
                />
                <Input
                  type="time"
                  value={v.open}
                  disabled={Boolean(v.closed) || !location.can_manage}
                  onChange={(e) => update(d, { open: e.target.value })}
                  className="w-32"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  value={v.close}
                  disabled={Boolean(v.closed) || !location.can_manage}
                  onChange={(e) => update(d, { close: e.target.value })}
                  className="w-32"
                />
                {v.closed && (
                  <Badge variant="outline" className="text-[10px]">
                    Closed
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {location.can_manage && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Hours
          </Button>
        </div>
      )}
    </div>
  );
}

function RoutingPanel({
  location,
  onSaved,
}: {
  location: LocationRow;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [rules, setRules] = useState<RoutingRules>(location.routing_rules);
  const [saving, setSaving] = useState(false);

  const phoneRegex = /^[+]?[0-9 ()\-]{7,20}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function save() {
    if (!location.can_manage) return;
    if (rules.escalation_phone && !phoneRegex.test(rules.escalation_phone)) {
      toast({ title: "Invalid escalation phone number", variant: "destructive" });
      return;
    }
    if (rules.escalation_email && !emailRegex.test(rules.escalation_email)) {
      toast({ title: "Invalid escalation email", variant: "destructive" });
      return;
    }
    if (
      rules.after_hours_action === "forward" &&
      (!rules.after_hours_target || !phoneRegex.test(rules.after_hours_target))
    ) {
      toast({
        title: "Forward action needs a valid phone number",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("portal_locations")
        .update({ routing_rules: rules as never })
        .eq("id", location.id);
      if (error) throw error;
      await logLocationAudit({
        orgId: location.org_id,
        locationId: location.id,
        eventType: "location.routing_updated",
      });
      toast({ title: "Routing rules saved" });
      await onSaved();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Default intent</Label>
          <Select
            value={rules.default_intent ?? "general_inquiry"}
            onValueChange={(v) => setRules({ ...rules, default_intent: v })}
            disabled={!location.can_manage}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general_inquiry">General Inquiry</SelectItem>
              <SelectItem value="sales_inquiry">Sales</SelectItem>
              <SelectItem value="service_request">Service / Support</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="parts">Parts</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Escalation
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Escalation phone</Label>
            <Input
              placeholder="+1 555 555 5555"
              value={rules.escalation_phone ?? ""}
              onChange={(e) =>
                setRules({ ...rules, escalation_phone: e.target.value })
              }
              disabled={!location.can_manage}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Escalation email</Label>
            <Input
              placeholder="ops@example.com"
              value={rules.escalation_email ?? ""}
              onChange={(e) =>
                setRules({ ...rules, escalation_email: e.target.value })
              }
              disabled={!location.can_manage}
            />
          </div>
        </div>
        <Separator />
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          After hours
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select
              value={rules.after_hours_action ?? "voicemail"}
              onValueChange={(v) =>
                setRules({
                  ...rules,
                  after_hours_action: v as RoutingRules["after_hours_action"],
                })
              }
              disabled={!location.can_manage}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="voicemail">Take voicemail</SelectItem>
                <SelectItem value="forward">Forward to phone</SelectItem>
                <SelectItem value="callback">Schedule callback</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>
              {rules.after_hours_action === "forward" ? "Forward to" : "Target (optional)"}
            </Label>
            <Input
              placeholder={
                rules.after_hours_action === "forward"
                  ? "+1 555 555 5555"
                  : "Optional"
              }
              value={rules.after_hours_target ?? ""}
              onChange={(e) =>
                setRules({ ...rules, after_hours_target: e.target.value })
              }
              disabled={!location.can_manage}
            />
          </div>
        </div>
      </div>
      {location.can_manage && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Routing
          </Button>
        </div>
      )}
    </div>
  );
}

function IntegrationOverridesPanel({ location }: { location: LocationRow }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Settings2 className="h-4 w-4 text-primary" />
        Integration inheritance
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        By default, this location uses your organization-wide integrations (CRM, ERP,
        ticketing). Overrides take precedence here only.
      </p>
      <div className="mt-4 rounded-lg border border-border/40 bg-muted/10 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span>Active overrides</span>
          <Badge variant="outline">{location.integration_overrides}</Badge>
        </div>
        {location.integration_overrides === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            No overrides — fully inheriting from organization.
          </p>
        )}
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        Manage overrides from the Integrations page once you've connected this
        location's vendor accounts.
      </div>
    </div>
  );
}

function ActivityPanel({ location }: { location: LocationRow }) {
  const [events, setEvents] = useState<
    Array<{
      id: string;
      event_type: string;
      created_at: string;
      metadata: Record<string, unknown> | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useMemo(() => {
    setLoading(true);
    supabase
      .from("portal_audit_events")
      .select("id, event_type, created_at, metadata")
      .eq("location_id", location.id)
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        setEvents(
          (data ?? []).map((e) => ({
            id: e.id,
            event_type: e.event_type,
            created_at: e.created_at,
            metadata: (e.metadata ?? null) as Record<string, unknown> | null,
          }))
        );
        setLoading(false);
      });
  }, [location.id]);

  if (loading) return <Skeleton className="h-40 rounded-xl" />;
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-6 text-center text-sm text-muted-foreground">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/40">
      <ul className="divide-y divide-border/40">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-3 p-3 text-sm">
            <History className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{prettyEventType(e.event_type)}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString()}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function prettyEventType(t: string) {
  return t
    .replace(/^location\./, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

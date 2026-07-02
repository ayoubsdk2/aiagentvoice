import { useEffect, useMemo, useState } from "react";
import { Loader2, UserPlus, Shield, RefreshCcw, Trash2, Mail, Crown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Role = "owner" | "admin" | "manager" | "viewer";

interface Member {
  id: string;
  user_id: string;
  organization_id: string;
  role: Role;
  invited_email: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
  email?: string | null;
  display_name?: string | null;
}

const ROLE_META: Record<Role, { label: string; desc: string; className: string }> = {
  owner:   { label: "Owner",   desc: "Full control, billing, ownership transfer", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  admin:   { label: "Admin",   desc: "Manage all settings and members",          className: "bg-primary/15 text-primary border-primary/30" },
  manager: { label: "Manager", desc: "Manage assigned locations and operations", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  viewer:  { label: "Viewer",  desc: "Read-only access to dashboards",           className: "bg-muted/40 text-muted-foreground border-border/60" },
};

export default function UsersRolesPage() {
  const { org, status } = useCurrentOrg();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviting, setInviting] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  async function refresh() {
    if (!org) return;
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      setMe(u.user?.id ?? null);

      const { data, error } = await supabase
        .from("organization_members")
        .select("id,user_id,organization_id,role,invited_email,invited_at,accepted_at,created_at")
        .eq("organization_id", org.id)
        .order("created_at");
      if (error) throw error;

      const userIds = Array.from(new Set((data ?? []).map(m => m.user_id).filter(Boolean)));
      let profiles: Record<string, { display_name: string | null }> = {};
      if (userIds.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id,display_name")
          .in("id", userIds);
        profiles = Object.fromEntries((ps ?? []).map(p => [p.id, { display_name: p.display_name }]));
      }

      setMembers((data ?? []).map(m => ({
        ...(m as Member),
        display_name: profiles[m.user_id]?.display_name ?? null,
        email: m.invited_email,
      })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [org?.id]);

  const myRole = useMemo<Role | null>(() => {
    const m = members.find(x => x.user_id === me);
    return (m?.role as Role | undefined) ?? null;
  }, [members, me]);

  const canManage = myRole === "owner" || myRole === "admin";

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!org) return <div className="text-sm text-muted-foreground">No organization found.</div>;

  const counts = {
    owners: members.filter(m => m.role === "owner").length,
    admins: members.filter(m => m.role === "admin").length,
    managers: members.filter(m => m.role === "manager").length,
    viewers: members.filter(m => m.role === "viewer").length,
  };

  async function changeRole(m: Member, role: Role) {
    if (m.role === "owner" && counts.owners <= 1 && role !== "owner") {
      toast.error("At least one owner is required");
      return;
    }
    const { error } = await supabase.from("organization_members").update({ role }).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success(`Role updated to ${ROLE_META[role].label}`);
    await refresh();
  }

  async function removeMember(m: Member) {
    if (m.role === "owner" && counts.owners <= 1) return toast.error("Cannot remove the last owner");
    if (!confirm(`Remove ${m.display_name || m.email || "this member"} from the organization?`)) return;
    const { error } = await supabase.from("organization_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    await refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Shield className="h-3.5 w-3.5" /> Admin
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Users & Roles</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Invite teammates with least-privilege roles. Owners and admins can manage the team and billing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void refresh()} className="gap-2">
            <RefreshCcw className="w-4 h-4" /> Refresh
          </Button>
          <Button disabled={!canManage} onClick={() => setInviting(true)} className="gap-2">
            <UserPlus className="w-4 h-4" /> Invite member
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Owners" value={counts.owners} />
        <Kpi label="Admins" value={counts.admins} />
        <Kpi label="Managers" value={counts.managers} />
        <Kpi label="Viewers" value={counts.viewers} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Member</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map(m => {
              const meta = ROLE_META[m.role];
              const pending = !m.accepted_at;
              const isMe = m.user_id === me;
              return (
                <tr key={m.id} className="border-b border-border/40 last:border-0 hover:bg-muted/10">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {m.role === "owner" && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                      <div>
                        <div className="font-medium">{m.display_name || m.email || "Unnamed"} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}</div>
                        {m.email && <div className="text-xs text-muted-foreground">{m.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {pending ? (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-300 border-amber-500/30">Pending</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage && !isMe ? (
                      <Select value={m.role} onValueChange={(v) => void changeRole(m, v as Role)}>
                        <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_META) as Role[]).map(r => (
                            <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={`text-[10px] ${meta.className}`}>{meta.label}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {m.accepted_at ? new Date(m.accepted_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && !isMe && (
                      <Button variant="ghost" size="sm" className="text-destructive gap-1.5" onClick={() => void removeMember(m)}>
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/30 p-4 text-xs text-muted-foreground">
        <div className="font-semibold text-foreground mb-1">Role reference</div>
        <ul className="grid md:grid-cols-2 gap-1.5">
          {(Object.keys(ROLE_META) as Role[]).map(r => (
            <li key={r}><span className="text-foreground font-medium">{ROLE_META[r].label}:</span> {ROLE_META[r].desc}</li>
          ))}
        </ul>
      </div>

      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        orgId={org.id}
        onInvited={() => { setInviting(false); void refresh(); }}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function InviteDialog({
  open, onOpenChange, orgId, onInvited,
}: { open: boolean; onOpenChange: (o: boolean) => void; orgId: string; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);

  async function send() {
    const trimmed = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) return toast.error("Enter a valid email");
    setBusy(true);
    try {
      // Look for existing user with this email so we can attach immediately
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("display_name", trimmed) // fallback; ignore
        .maybeSingle();

      // Always create a pending membership row keyed by invited_email; user_id
      // resolves on accept via existing membership reconciliation.
      const payload = {
        organization_id: orgId,
        user_id: existing?.id ?? "00000000-0000-0000-0000-000000000000",
        role,
        invited_email: trimmed,
        invited_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("organization_members").insert(payload);
      if (error) throw error;
      toast.success(`Invitation recorded for ${trimmed}`, {
        description: "They'll be attached to your organization once they sign up with this email.",
      });
      setEmail(""); setRole("viewer");
      onInvited();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4" /> Invite a teammate</DialogTitle>
          <DialogDescription>
            Send an invitation by email. They'll join your organization with the role you choose below.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@company.com" />
          </div>
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_META) as Role[]).filter(r => r !== "owner").map(r => (
                  <SelectItem key={r} value={r}>
                    <div className="flex flex-col items-start">
                      <span>{ROLE_META[r].label}</span>
                      <span className="text-[10px] text-muted-foreground">{ROLE_META[r].desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={send} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

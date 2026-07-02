import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FlaskConical, Plus, Trash2, ExternalLink, Copy, ShieldAlert, ChevronDown } from "lucide-react";
import { DEFAULT_VOICE_PUBLIC_KEY } from "@/lib/voice-defaults";

interface SandboxInstanceRow {
  id: string;
  slug: string;
  company_name: string;
  vapi_assistant_id: string;
  vapi_public_key: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const RESERVED_SLUGS = new Set([
  "auth", "trust", "status", "mfa-setup", "mfa-challenge",
  "admin", "s", "api", "assets", "static", "public", "favicon.ico",
]);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function SandboxInstancesAdmin() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rows, setRows] = useState<SandboxInstanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [companyName, setCompanyName] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const checkAuthAndLoad = useCallback(async () => {
    setLoading(true);
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp?.user?.id;
    if (!uid) { setAuthorized(false); setLoading(false); return; }
    const { data: roleData } = await supabase.rpc("has_role", { _user_id: uid, _role: "phaos_admin" });
    const isAdmin = roleData === true;
    setAuthorized(isAdmin);
    if (!isAdmin) { setLoading(false); return; }

    const { data } = await supabase
      .from("sandbox_instances")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as SandboxInstanceRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void checkAuthAndLoad(); }, [checkAuthAndLoad]);

  // Auto-derive slug from company name unless user has typed in slug field
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(companyName));
  }, [companyName, slugTouched]);

  const linkFor = (s: string) => `${window.location.origin}/${s}`;

  const createInstance = async () => {
    const cleanSlug = slugify(slug);
    const effectivePublicKey = (publicKey.trim() || DEFAULT_VOICE_PUBLIC_KEY).trim();
    if (!companyName.trim() || !assistantId.trim() || !cleanSlug) {
      toast.error("Company name, voice agent ID, and URL path are required.");
      return;
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(assistantId.trim())) {
      toast.error("Voice agent ID must be a UUID (e.g. 9b500996-850d-416f-96b1-c7aa1eeb2dc3).");
      return;
    }
    if (!UUID_RE.test(effectivePublicKey)) {
      toast.error("Override public key must be a UUID, or leave it blank to use the workspace default.");
      return;
    }
    if (effectivePublicKey === assistantId.trim()) {
      toast.error("The override public key cannot equal the voice agent ID. Leave it blank to use the workspace default.");
      return;
    }
    if (!SLUG_RE.test(cleanSlug)) {
      toast.error("URL path must be 1-64 chars, lowercase letters, digits, and hyphens (no leading/trailing hyphen).");
      return;
    }
    if (RESERVED_SLUGS.has(cleanSlug)) {
      toast.error(`"${cleanSlug}" is a reserved path — try "${cleanSlug}-trial" or similar.`);
      return;
    }
    setSlug(cleanSlug);
    setCreating(true);
    const { data: userResp } = await supabase.auth.getUser();
    const { error } = await supabase.from("sandbox_instances").insert({
      slug: cleanSlug,
      company_name: companyName.trim(),
      vapi_assistant_id: assistantId.trim(),
      vapi_public_key: effectivePublicKey,
      notes: notes.trim() || null,
      created_by: userResp?.user?.id ?? null,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message.includes("unique") || error.message.includes("duplicate")
        ? "That URL path is already in use."
        : error.message);
      return;
    }
    toast.success(`Sandbox created — share ${linkFor(cleanSlug)}`);
    setCompanyName(""); setAssistantId(""); setPublicKey(""); setSlug(""); setNotes(""); setSlugTouched(false); setShowAdvanced(false);
    void checkAuthAndLoad();
  };

  const toggleActive = async (row: SandboxInstanceRow) => {
    const { error } = await supabase.from("sandbox_instances").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    void checkAuthAndLoad();
  };

  const removeInstance = async (row: SandboxInstanceRow) => {
    if (!window.confirm(`Delete sandbox "${row.company_name}" (${row.slug})? The shareable link will stop working.`)) return;
    const { error } = await supabase.from("sandbox_instances").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Sandbox deleted.");
    void checkAuthAndLoad();
  };

  const copyLink = async (s: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(s));
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy — select the link manually.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="max-w-2xl mx-auto mt-12 glass-card p-8 text-center">
        <ShieldAlert className="mx-auto text-destructive" size={36} />
        <h2 className="mt-4 text-xl font-bold text-foreground">Restricted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sandbox provisioning is restricted to Phaos administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FlaskConical className="text-primary" size={20} />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sandbox Instances</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Provision a branded trial sandbox in seconds. Each instance gets a shareable link that runs the full Sandbox experience using the voice agent you specify.
        </p>
      </div>

      <div className="glass-card p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">New Sandbox Instance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted-foreground font-semibold">Company / Account name</span>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Imaging" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted-foreground font-semibold">Voice agent ID</span>
            <Input value={assistantId} onChange={(e) => setAssistantId(e.target.value)} placeholder="e.g. 9b500996-850d-416f-96b1-c7aa1eeb2dc3" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted-foreground font-semibold">URL path (e.g. "referrizer" → /referrizer)</span>
            <Input
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true); }}
              onBlur={() => setSlug((s) => slugify(s))}
              placeholder="referrizer"
            />
            {slug && (
              <span className="text-[11px] text-muted-foreground font-mono truncate">
                {linkFor(slugify(slug))}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5 text-xs md:col-span-2">
            <span className="text-muted-foreground font-semibold">Internal notes (optional)</span>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Trial through Q3 — printer industry pilot" />
          </label>
        </div>

        <div className="rounded-md border border-border/50 bg-secondary/30 p-3 text-[11px] text-muted-foreground">
          Voice provider workspace key: <span className="font-mono text-foreground">Phaos default — auto-applied</span>. You only need to paste the voice agent ID above.
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="ml-2 inline-flex items-center gap-1 text-foreground hover:underline"
          >
            <ChevronDown size={12} className={showAdvanced ? "rotate-180 transition-transform" : "transition-transform"} />
            {showAdvanced ? "Hide" : "Advanced"}
          </button>
          {showAdvanced && (
            <div className="mt-2">
              <Input
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="Override public key (only for agents in a different workspace)"
                className="font-mono text-xs"
              />
              <p className="mt-1">Leave blank to use the default. Only fill this in if the agent ID belongs to a different voice provider workspace.</p>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={createInstance} disabled={creating} className="gap-2">
            <Plus size={16} /> Complete & Create Sandbox
          </Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">Company</th>
              <th className="text-left px-4 py-2.5">Subdomain Link</th>
              <th className="text-left px-4 py-2.5">Voice Agent</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No sandboxes yet. Create one above.</td></tr>
            )}
            {rows.map((row) => {
              const link = linkFor(row.slug);
              const agentFp = row.vapi_assistant_id.slice(0, 8) + "…" + row.vapi_assistant_id.slice(-4);
              return (
                <tr key={row.id} className="border-t border-border/30">
                  <td className="px-4 py-3 font-medium text-foreground">{row.company_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <a href={link} target="_blank" rel="noreferrer"
                        className="font-mono text-xs text-primary hover:underline truncate max-w-[280px]">
                        {link}
                      </a>
                      <Button size="sm" variant="ghost" onClick={() => copyLink(row.slug)} className="h-7 w-7 p-0" aria-label="Copy link">
                        <Copy size={13} />
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground" title={row.vapi_assistant_id}>
                      {agentFp}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={row.is_active} onCheckedChange={() => toggleActive(row)} aria-label="Toggle active" />
                      <Badge variant={row.is_active ? "default" : "secondary"}>{row.is_active ? "Active" : "Disabled"}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => window.open(link, "_blank")} className="gap-1" aria-label="Open sandbox">
                        <ExternalLink size={13} /> Open
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeInstance(row)} className="gap-1 text-destructive hover:text-destructive" aria-label="Delete sandbox">
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

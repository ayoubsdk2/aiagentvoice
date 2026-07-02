import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Lock, Plus, Trash2, RefreshCw, ShieldAlert, ChevronDown, ChevronRight, Bot, Phone, Star, Plug } from "lucide-react";
import { adminFetch, verifyAdminToken } from "@/lib/admin-session";
import { LiveAccountIntegrationsPanel } from "@/components/admin/LiveAccountIntegrationsPanel";
import { ProvisionClientDialog } from "@/components/admin/ProvisionClientDialog";
import { useNavigate } from "react-router-dom";
import { useAdminCompany } from "@/contexts/AdminCompanyContext";

interface NotificationConfig {
  include_transcript?: boolean;
  include_summary?: boolean;
  subject_mode?: "generic" | "theme";
}

interface LiveAccountRow {
  id: string;
  customer_id: string;
  display_name: string;
  access_code_hash: string;
  is_active: boolean;
  notes: string | null;
  notification_email: string | null;
  system_prompt: string | null;
  vapi_assistant_id_primary: string | null;
  created_at: string;
  provisioning_status?: string | null;
  needs_manual_review?: boolean | null;
  provisioning_error?: string | null;
  notification_config?: NotificationConfig | null;
}

interface CustomerOption { id: string; name: string; }
interface AgentRow {
  id: string; customer_id: string; vapi_assistant_id: string;
  label: string | null; is_primary: boolean;
  system_prompt?: string | null;
  routing_type?: string | null;
  line_label?: string | null;
  parent_assistant_id?: string | null;
  voice_id?: string | null;
  voice_provider?: string | null;
}
interface PhoneRow {
  id: string; customer_id: string; agent_id: string; e164: string; provider: string | null;
  label?: string | null;
  area_code?: string | null;
  telnyx_phone_number_id?: string | null;
}

interface CartesiaVoice { id: string; name: string; language?: string; gender?: string }
let voicesCache: CartesiaVoice[] | null = null;
async function loadCartesiaVoices(): Promise<CartesiaVoice[]> {
  if (voicesCache) return voicesCache;
  try {
    const { voices } = await adminFetch<{ voices: CartesiaVoice[] }>("cartesia-voices", "/", { method: "GET" });
    voicesCache = voices;
    return voices;
  } catch {
    return [];
  }
}

function AgentVoicePicker({ agent, onSaved }: { agent: AgentRow; onSaved: () => void }) {
  const [voices, setVoices] = useState<CartesiaVoice[]>([]);
  const [value, setValue] = useState<string>(agent.voice_id ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { void loadCartesiaVoices().then(setVoices); }, []);
  useEffect(() => { setValue(agent.voice_id ?? ""); }, [agent.voice_id]);
  const save = async (next: string) => {
    setValue(next); setSaving(true);
    try {
      await adminFetch("admin-api", `/agents/${agent.id}`, {
        method: "PATCH",
        body: { voice_id: next, voice_provider: next ? "cartesia" : null },
      });
      toast.success("Voice updated.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSaving(false); }
  };
  return (
    <select
      value={value}
      onChange={(e) => void save(e.target.value)}
      disabled={saving || voices.length === 0}
      className="h-7 rounded-md border border-input bg-background px-2 text-[11px] text-foreground disabled:opacity-50 max-w-[180px]"
      aria-label="Voice"
    >
      <option value="">{voices.length === 0 ? "Loading voices…" : "Default voice"}</option>
      {voices.map(v => (
        <option key={v.id} value={v.id}>
          {v.name}{v.language ? ` · ${v.language}` : ""}{v.gender ? ` · ${v.gender}` : ""}
        </option>
      ))}
    </select>
  );
}


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function AgentsAndPhonesPanel({ customerId }: { customerId: string }) {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [phones, setPhones] = useState<PhoneRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newAssistant, setNewAssistant] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const [newPhoneAgentId, setNewPhoneAgentId] = useState<string>("");
  const [newPhoneE164, setNewPhoneE164] = useState("");
  const [newPhoneProvider, setNewPhoneProvider] = useState("");
  const [addingPhone, setAddingPhone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ agents }, { phones }] = await Promise.all([
        adminFetch<{ agents: AgentRow[] }>("admin-api", "/agents", { query: { customer_id: customerId } }),
        adminFetch<{ phones: PhoneRow[] }>("admin-api", "/phones", { query: { customer_id: customerId } }),
      ]);
      setAgents(agents); setPhones(phones);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => { void load(); }, [load]);

  const addAgent = async () => {
    const id = newAssistant.trim();
    if (!id) { toast.error("Retell Agent ID is required."); return; }
    if (!/^agent_[a-z0-9]{6,}$/i.test(id) && !UUID_RE.test(id)) { toast.error("Retell Agent ID must look like agent_XXXXXXXX."); return; }
    setAdding(true);
    try {
      await adminFetch("admin-api", "/agents", {
        method: "POST",
        body: { customer_id: customerId, vapi_assistant_id: id, label: newLabel.trim() || null, is_primary: agents.length === 0 },
      });
      toast.success("Agent added.");
      setNewAssistant(""); setNewLabel("");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setAdding(false); }
  };

  const setPrimary = async (row: AgentRow) => {
    try {
      await adminFetch("admin-api", `/agents/${row.id}`, { method: "PATCH", body: { is_primary: true } });
      toast.success("Primary agent set.");
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const deleteAgent = async (row: AgentRow) => {
    if (!window.confirm(`Remove agent ${row.label ?? row.vapi_assistant_id}? Linked phone numbers will be deleted.`)) return;
    try {
      await adminFetch("admin-api", `/agents/${row.id}`, { method: "DELETE" });
      toast.success("Agent removed."); void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const addPhone = async () => {
    if (!newPhoneAgentId) { toast.error("Select an agent to bind."); return; }
    const e164 = newPhoneE164.trim();
    if (!/^\+[1-9]\d{6,14}$/.test(e164)) { toast.error("Phone must be E.164 (e.g. +14155551234)."); return; }
    setAddingPhone(true);
    try {
      await adminFetch("admin-api", "/phones", {
        method: "POST",
        body: { customer_id: customerId, agent_id: newPhoneAgentId, e164, provider: newPhoneProvider.trim() || null },
      });
      toast.success("Phone number added.");
      setNewPhoneE164(""); setNewPhoneProvider("");
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setAddingPhone(false); }
  };

  const deletePhone = async (row: PhoneRow) => {
    try {
      await adminFetch("admin-api", `/phones/${row.id}`, { method: "DELETE" });
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  if (loading) return <div className="text-xs text-muted-foreground p-4">Loading agents & phone numbers…</div>;

  return (
    <div className="p-4 space-y-5 bg-secondary/20">
      <div className="space-y-2">
        <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Bot size={12}/> Voice Agents</h4>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <Input value={newAssistant} onChange={(e) => setNewAssistant(e.target.value)} placeholder="Retell Agent ID (agent_XXXXXXXX)" />
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label (e.g. Phoebe - Inbound)" />
          <Button size="sm" onClick={addAgent} disabled={adding} className="gap-1"><Plus size={14}/> Add Agent</Button>
        </div>
        {agents.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No agents yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr>
              <th className="text-left py-1.5">Primary</th>
              <th className="text-left py-1.5">Line</th>
              <th className="text-left py-1.5">Retell Agent ID</th>
              <th className="text-left py-1.5">Label</th>
              <th className="text-left py-1.5">Voice</th>
              <th className="text-left py-1.5">Routing</th>
              <th className="text-right py-1.5">Actions</th>
            </tr></thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id} className="border-t border-border/30">
                  <td className="py-1.5">{a.is_primary ? <Badge className="gap-1"><Star size={10}/> Primary</Badge> : <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setPrimary(a)}>Set primary</Button>}</td>
                  <td className="py-1.5 text-foreground">{a.line_label ?? "—"}</td>
                  <td className="py-1.5 font-mono text-foreground">{a.vapi_assistant_id}</td>
                  <td className="py-1.5 text-foreground">{a.label ?? "—"}</td>
                  <td className="py-1.5"><AgentVoicePicker agent={a} onSaved={load} /></td>
                  <td className="py-1.5">
                    {a.routing_type ? (
                      <Badge variant={a.routing_type === "unique" ? "default" : "secondary"} className="text-[10px]">
                        {a.routing_type}{a.routing_type === "duplicate" && a.parent_assistant_id ? ` → ${a.parent_assistant_id.slice(0,8)}` : ""}
                      </Badge>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-1.5 text-right"><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteAgent(a)}><Trash2 size={12}/></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Phone size={12}/> Phone Numbers</h4>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <select value={newPhoneAgentId} onChange={(e) => setNewPhoneAgentId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground" aria-label="Bind to agent">
            <option value="">Bind to agent…</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.label ?? a.vapi_assistant_id.slice(0,8)}</option>)}
          </select>
          <Input value={newPhoneE164} onChange={(e) => setNewPhoneE164(e.target.value)} placeholder="+14155551234" />
          <Input value={newPhoneProvider} onChange={(e) => setNewPhoneProvider(e.target.value)} placeholder="Provider (telnyx, twilio…)" />
          <Button size="sm" onClick={addPhone} disabled={addingPhone || agents.length === 0} className="gap-1"><Plus size={14}/> Add Phone</Button>
        </div>
        {phones.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No phone numbers registered.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr>
              <th className="text-left py-1.5">E.164</th>
              <th className="text-left py-1.5">Line</th>
              <th className="text-left py-1.5">Area</th>
              <th className="text-left py-1.5">Agent</th>
              <th className="text-left py-1.5">Provider</th>
              <th className="text-right py-1.5"></th>
            </tr></thead>
            <tbody>
              {phones.map(p => {
                const agent = agents.find(a => a.id === p.agent_id);
                return (
                  <tr key={p.id} className="border-t border-border/30">
                    <td className="py-1.5 font-mono text-foreground">
                      <div>{p.e164}</div>
                      {p.telnyx_phone_number_id && (
                        <div className="text-[10px] text-muted-foreground">Telnyx · {p.telnyx_phone_number_id}</div>
                      )}
                    </td>
                    <td className="py-1.5 text-foreground">{p.label ?? "—"}</td>
                    <td className="py-1.5 text-muted-foreground">{p.area_code ?? "—"}</td>
                    <td className="py-1.5 text-foreground">{agent?.label ?? agent?.vapi_assistant_id.slice(0,8) ?? p.agent_id.slice(0,8)}</td>
                    <td className="py-1.5 text-muted-foreground">{p.provider ?? "—"}</td>
                    <td className="py-1.5 text-right"><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deletePhone(p)}><Trash2 size={12}/></Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RoutingAndPromptPanel({ row, onSaved }: { row: LiveAccountRow; onSaved: () => void }) {
  const [email, setEmail] = useState(row.notification_email ?? "daniel@phaosai.com");
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [assistantId, setAssistantId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const initialCfg: NotificationConfig = row.notification_config ?? { include_transcript: true, include_summary: true, subject_mode: "theme" };
  const [notifCfg, setNotifCfg] = useState<NotificationConfig>(initialCfg);
  const [savingCfg, setSavingCfg] = useState(false);

  const saveNotifCfg = async (next: NotificationConfig) => {
    setNotifCfg(next); setSavingCfg(true);
    try {
      await adminFetch("admin-api", `/live-accounts/${row.id}`, {
        method: "PATCH", body: { notification_config: next },
      });
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingCfg(false); }
  };

  // Load agents for this account
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingAgents(true);
      try {
        const { agents } = await adminFetch<{ agents: AgentRow[] }>("admin-api", "/agents", { query: { customer_id: row.customer_id } });
        if (cancelled) return;
        setAgents(agents);
        const primary = agents.find(a => a.is_primary) ?? agents[0] ?? null;
        if (primary) {
          setSelectedAgentId(primary.id);
          setAssistantId(primary.vapi_assistant_id ?? "");
          setPrompt(primary.system_prompt ?? row.system_prompt ?? "");
        } else {
          setAssistantId(row.vapi_assistant_id_primary ?? "");
          setPrompt(row.system_prompt ?? "");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load lines");
      } finally {
        if (!cancelled) setLoadingAgents(false);
      }
    })();
    return () => { cancelled = true; };
  }, [row.customer_id, row.system_prompt, row.vapi_assistant_id_primary]);

  const onSelectLine = (agentId: string) => {
    setSelectedAgentId(agentId);
    const a = agents.find(x => x.id === agentId);
    if (a) {
      setAssistantId(a.vapi_assistant_id ?? "");
      setPrompt(a.system_prompt ?? row.system_prompt ?? "");
    }
  };

  const saveNotificationEmail = async () => {
    setSavingEmail(true);
    try {
      await adminFetch("admin-api", `/live-accounts/${row.id}`, {
        method: "PATCH", body: { notification_email: email },
      });
      toast.success("Notification email saved.");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingEmail(false); }
  };

  const save = async () => {
    if (!selectedAgentId) {
      toast.error("No line selected. Provision at least one line to edit per-line settings.");
      return;
    }
    setSaving(true);
    try {
      await adminFetch("admin-api", `/agents/${selectedAgentId}`, {
        method: "PATCH",
        body: { vapi_assistant_id: assistantId.trim(), system_prompt: prompt },
      });
      toast.success("Line saved.");
      // refresh local list
      const { agents: fresh } = await adminFetch<{ agents: AgentRow[] }>("admin-api", "/agents", { query: { customer_id: row.customer_id } });
      setAgents(fresh);
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const lineLabel = (a: AgentRow, idx: number) =>
    `${a.line_label || a.label || `Line ${idx + 1}`} — ${a.vapi_assistant_id.slice(0, 8)}${a.is_primary ? " · primary" : ""}`;

  return (
    <div className="p-5 space-y-4 bg-secondary/10">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <label className="flex flex-col gap-1 text-xs flex-1">
          <span className="text-muted-foreground font-semibold uppercase tracking-widest">Select Line</span>
          <select
            value={selectedAgentId}
            onChange={(e) => onSelectLine(e.target.value)}
            disabled={loadingAgents || agents.length === 0}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground disabled:opacity-50"
            aria-label="Select line"
          >
            {agents.length === 0 ? (
              <option value="">No lines provisioned yet</option>
            ) : (
              agents.map((a, i) => <option key={a.id} value={a.id}>{lineLabel(a, i)}</option>)
            )}
          </select>
        </label>
        {selectedAgent?.routing_type && (
          <Badge variant={selectedAgent.routing_type === "unique" ? "default" : "secondary"} className="text-[10px]">
            routing: {selectedAgent.routing_type}
          </Badge>
        )}
      </div>

      {agents.length === 0 && !loadingAgents && (
        <div className="text-[11px] text-muted-foreground italic">
          No lines yet. Provision a client (or add an agent under Agents &amp; Phones) to manage per-line prompts.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground font-semibold">Notification email</span>
          <div className="flex gap-2">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="daniel@phaosai.com" />
            <Button size="sm" variant="outline" onClick={saveNotificationEmail} disabled={savingEmail}>{savingEmail ? "…" : "Save"}</Button>
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground font-semibold">Primary Retell Agent ID (for selected line)</span>
          <Input
            value={assistantId}
            onChange={(e) => setAssistantId(e.target.value)}
            className="font-mono text-[11px]"
            disabled={!selectedAgentId}
          />
        </label>
      </div>

      <div className="rounded-md border border-border/40 bg-background/40 p-3 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Post-call notification email {savingCfg && <span className="ml-2 text-muted-foreground/70 normal-case">saving…</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notifCfg.include_transcript ?? true}
              onChange={(e) => void saveNotifCfg({ ...notifCfg, include_transcript: e.target.checked })}
            />
            <span>Include full transcript</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notifCfg.include_summary ?? true}
              onChange={(e) => void saveNotifCfg({ ...notifCfg, include_summary: e.target.checked })}
            />
            <span>Include AI summary</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Email subject</span>
            <select
              value={notifCfg.subject_mode ?? "theme"}
              onChange={(e) => void saveNotifCfg({ ...notifCfg, subject_mode: e.target.value as "generic" | "theme" })}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="generic">Generic (Phaos AI Call Summary)</option>
              <option value="theme">Theme-based (e.g. Pricing Conversation)</option>
            </select>
          </label>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Sent to the address above after every completed call on this account.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground font-semibold">System prompt (synced to Retell agent for selected line)</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={!selectedAgentId}
          className="min-h-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground font-mono text-[11px] disabled:opacity-50"
          placeholder="You are Phoebe, an SOA technical expert…"
        />
      </label>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving || !selectedAgentId}>{saving ? "Saving…" : "Save line"}</Button>
      </div>
    </div>
  );
}

type Tab = "agents" | "routing" | "integrations";

export function LiveAccountsAdmin() {
  const navigate = useNavigate();
  const { selectedCustomerId: adminSelectedId, reload: reloadAdminCompanies } = useAdminCompany();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rows, setRows] = useState<LiveAccountRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, Tab | null>>({});

  const [search, setSearch] = useState("");

  const checkAuthAndLoad = useCallback(async () => {
    setLoading(true);
    const ok = await verifyAdminToken();
    setAuthorized(ok);
    if (!ok) { setLoading(false); return; }
    try {
      const [{ accounts }, { customers }] = await Promise.all([
        adminFetch<{ accounts: LiveAccountRow[] }>("admin-api", "/live-accounts"),
        adminFetch<{ customers: CustomerOption[] }>("admin-api", "/customers"),
      ]);
      setRows(accounts); setCustomers(customers);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void checkAuthAndLoad(); void reloadAdminCompanies(); }, [checkAuthAndLoad]);

  const setTab = (cid: string, tab: Tab) => {
    setExpanded(prev => ({ ...prev, [cid]: prev[cid] === tab ? null : tab }));
  };


  const toggleActive = async (row: LiveAccountRow) => {
    try {
      await adminFetch("admin-api", `/live-accounts/${row.id}`, { method: "PATCH", body: { is_active: !row.is_active } });
      void checkAuthAndLoad(); void reloadAdminCompanies();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const regenCode = async (row: LiveAccountRow) => {
    const next = window.prompt("New access code (min 5 characters). Copy it now — it cannot be retrieved later:", "");
    if (!next || next.trim().length < 5) return;
    try {
      await adminFetch("admin-api", `/live-accounts/${row.id}`, { method: "PATCH", body: { access_code: next.trim() } });
      toast.success("Access code rotated.");
      void checkAuthAndLoad(); void reloadAdminCompanies();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const removeMapping = async (row: LiveAccountRow) => {
    if (!window.confirm(`Delete live account "${row.display_name}"?`)) return;
    try {
      await adminFetch("admin-api", `/live-accounts/${row.id}`, { method: "DELETE" });
      toast.success("Live account removed.");
      void checkAuthAndLoad(); void reloadAdminCompanies();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>;
  }

  if (!authorized) {
    return (
      <div className="max-w-2xl mx-auto mt-12 glass-card p-8 text-center">
        <ShieldAlert className="mx-auto text-destructive" size={36}/>
        <h2 className="mt-4 text-xl font-bold text-foreground">Admin session required</h2>
        <p className="mt-2 text-sm text-muted-foreground">Sign in at <code>/admin/login</code> with your admin credentials to manage live accounts.</p>
        <Button className="mt-4" onClick={() => navigate("/admin/login")}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="text-primary" size={20}/>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">LIVE Accounts</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage LIVE customer accounts, Retell agents, phone numbers, routing, system prompts, and SOA vendor integrations. All writes go through the admin-api edge function — no second Supabase sign-in needed.
          </p>
        </div>
      </div>

      <div className="glass-card p-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">New LIVE Account</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Provision a fully-wired account: buys Telnyx numbers, clones Retell agents per line, and links integrations.
          </p>
        </div>
        <ProvisionClientDialog onProvisioned={() => { void checkAuthAndLoad(); void reloadAdminCompanies(); }} />
      </div>


      <div className="glass-card p-4">
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted-foreground font-semibold uppercase tracking-widest">Company Search</span>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company name…"
          />
        </label>
      </div>


      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="w-10"></th>
              <th className="text-left px-4 py-2.5">Customer</th>
              <th className="text-left px-4 py-2.5">Display Name</th>
              <th className="text-left px-4 py-2.5">Notification</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const q = search.trim().toLowerCase();
              const adminScoped = adminSelectedId
                ? rows.filter((r) => r.customer_id === adminSelectedId)
                : rows;
              const filtered = q
                ? adminScoped.filter((r) => {
                    const name = customers.find((c) => c.id === r.customer_id)?.name ?? "";
                    return name.toLowerCase().includes(q) || r.display_name.toLowerCase().includes(q);
                  })
                : adminScoped;
              if (filtered.length === 0) {
                return (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {rows.length === 0 ? "No live accounts yet." : "No live accounts match your filters."}
                  </td></tr>
                );
              }
              return filtered.map(row => {
                const customerName = customers.find(c => c.id === row.customer_id)?.name ?? row.customer_id;
              const activeTab = expanded[row.customer_id] ?? null;
              return (
                <>
                  <tr key={row.id} className="border-t border-border/30">
                    <td className="px-2 py-3">
                      <button onClick={() => setTab(row.customer_id, "agents")} aria-label="Toggle details" className="text-muted-foreground hover:text-foreground">
                        {activeTab ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{customerName}</td>
                    <td className="px-4 py-3 text-foreground">{row.display_name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{row.notification_email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Switch checked={row.is_active} onCheckedChange={() => toggleActive(row)} aria-label="Toggle active"/>
                        <Badge variant={row.is_active ? "default" : "secondary"}>{row.is_active ? "Active" : "Disabled"}</Badge>
                        {row.needs_manual_review ? (
                          <Badge variant="destructive" title={row.provisioning_error ?? undefined}>Needs review</Badge>
                        ) : row.provisioning_status === "in_progress" ? (
                          <Badge variant="outline">Provisioning…</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => regenCode(row)} className="gap-1"><RefreshCw size={13}/> Rotate</Button>
                        <Button size="sm" variant="ghost" onClick={() => removeMapping(row)} className="gap-1 text-destructive hover:text-destructive"><Trash2 size={13}/></Button>
                      </div>
                    </td>
                  </tr>
                  {activeTab && (
                    <tr key={row.id + "-tabs"} className="border-t border-border/20 bg-secondary/10">
                      <td colSpan={6} className="px-4 py-2">
                        <div className="flex gap-1 text-xs">
                          {(["agents","routing","integrations"] as Tab[]).map(t => (
                            <button key={t}
                              onClick={() => setTab(row.customer_id, t)}
                              className={`px-3 py-1.5 rounded-md ${activeTab === t ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                              {t === "agents" ? "Agents & Phones" : t === "routing" ? "Routing & Prompt" : "Integrations"}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  {activeTab === "agents" && (
                    <tr key={row.id + "-agents"}><td colSpan={6} className="p-0"><AgentsAndPhonesPanel customerId={row.customer_id}/></td></tr>
                  )}
                  {activeTab === "routing" && (
                    <tr key={row.id + "-routing"}><td colSpan={6} className="p-0"><RoutingAndPromptPanel row={row} onSaved={checkAuthAndLoad}/></td></tr>
                  )}
                  {activeTab === "integrations" && (
                    <tr key={row.id + "-integrations"}><td colSpan={6} className="p-0">
                      <LiveAccountIntegrationsPanel customerId={row.customer_id} displayName={row.display_name} notificationEmail={row.notification_email}/>
                    </td></tr>
                  )}
                </>
              );
            });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

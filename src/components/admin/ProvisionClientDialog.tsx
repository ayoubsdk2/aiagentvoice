import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, Zap, Info } from "lucide-react";
import { toast } from "sonner";
import { getAdminToken } from "@/lib/admin-session";
import { INDUSTRIES } from "@/lib/industries";
import { resolveBaseAgentId } from "@/lib/live-agent-defaults";

type RoutingType = "unique" | "duplicate";

interface LineDraft {
  label: string;
  area_code: string;
  routing_type: RoutingType;
  industry_id: string;      // used only when routing_type === "unique"
  system_prompt: string;    // optional override, sent through to admin editor
}

interface ProvisionResultLine {
  label: string;
  e164: string;
  retell_agent_id: string;
  routing_type: RoutingType;
}

const DEFAULT_INDUSTRY_ID = "document-solutions";

function initialLine(idx: number, routing: RoutingType = "unique"): LineDraft {
  return {
    label: `Line ${idx}`,
    area_code: "",
    routing_type: routing,
    industry_id: DEFAULT_INDUSTRY_ID,
    system_prompt: "",
  };
}

export function ProvisionClientDialog({ onProvisioned }: { onProvisioned: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([initialLine(1, "unique")]);
  const [result, setResult] = useState<{ lines: ProvisionResultLine[] } | null>(null);

  const industryOptions = useMemo(
    () => INDUSTRIES.map((i) => ({ id: i.id, name: i.displayName })),
    [],
  );

  const addLine = () => {
    if (lines.length >= 10) return;
    setLines([...lines, initialLine(lines.length + 1, "duplicate")]);
  };

  const removeLine = (i: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== i));
  };

  const updateLine = (i: number, patch: Partial<LineDraft>) => {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const reset = () => {
    setCompany(""); setContact(""); setWebsite(""); setEmail("");
    setLines([initialLine(1, "unique")]);
    setResult(null);
  };

  const validate = (): string | null => {
    if (!company.trim()) return "Company name is required.";
    if (!contact.trim()) return "Contact name is required.";
    try { new URL(website.trim()); } catch { return "Website must be a valid URL (https://…)."; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Email address is invalid.";
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.label.trim()) return `Line ${i + 1}: label required.`;
      if (!/^\d{3}$/.test(l.area_code)) return `Line ${i + 1}: area code must be 3 digits.`;
      if ((i === 0 || l.routing_type === "unique") && !l.industry_id) {
        return `Line ${i + 1}: pick an industry.`;
      }
    }
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    const token = getAdminToken();
    if (!token) { toast.error("Admin session expired. Please sign in again."); return; }

    setSubmitting(true);
    setResult(null);
    try {
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${base}/functions/v1/provision-client`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: company.trim(),
          contact_name: contact.trim(),
          website_url: website.trim(),
          email_address: email.trim(),
          lines: lines.map((l, i) => ({
            label: l.label.trim(),
            area_code: l.area_code.trim(),
            routing_type: i === 0 ? "unique" : l.routing_type,
            industry_id: (i === 0 || l.routing_type === "unique") ? l.industry_id : undefined,
            system_prompt: l.system_prompt.trim() || undefined,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.detail || data?.error || "Provisioning failed.");
        if (data?.needs_manual_review) onProvisioned();
        return;
      }
      setResult({ lines: data.lines ?? [] });
      toast.success(`LIVE account created: ${data.lines?.length ?? 0} line(s) live.`);
      onProvisioned();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Zap size={16}/> Create LIVE Account</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create LIVE Account</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">LIVE account created. The lines below are live:</p>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground"><tr>
                <th className="text-left py-1.5">Label</th>
                <th className="text-left py-1.5">Phone</th>
                <th className="text-left py-1.5">Retell Agent</th>
                <th className="text-left py-1.5">Routing</th>
              </tr></thead>
              <tbody>
                {result.lines.map((l) => (
                  <tr key={l.retell_agent_id + l.e164} className="border-t border-border/30">
                    <td className="py-1.5 text-foreground">{l.label}</td>
                    <td className="py-1.5 font-mono text-foreground">{l.e164}</td>
                    <td className="py-1.5 font-mono text-muted-foreground">{l.retell_agent_id.slice(0, 20)}…</td>
                    <td className="py-1.5 text-foreground">{l.routing_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-muted-foreground">
              You can now edit each line's system prompt from the Routing &amp; Prompt tab on the new account.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Create Another</Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground font-semibold">Company *</span>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground font-semibold">Contact *</span>
                <Input value={contact} onChange={(e) => setContact(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground font-semibold">Website URL *</span>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground font-semibold">Email *</span>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Lines ({lines.length}/10)
                </h4>
                <Button size="sm" variant="ghost" onClick={addLine} disabled={lines.length >= 10} className="gap-1">
                  <Plus size={12}/> Add Line
                </Button>
              </div>

              <div className="space-y-3">
                {lines.map((l, i) => {
                  const isUnique = i === 0 || l.routing_type === "unique";
                  const baseAgentId = isUnique ? resolveBaseAgentId(l.industry_id) : null;
                  return (
                    <div key={i} className="rounded-md border border-border/40 p-3 space-y-2 bg-background/40">
                      <div className="grid grid-cols-[1fr_130px_150px_auto] gap-2 items-end">
                        <label className="flex flex-col gap-1 text-[11px]">
                          <span className="text-muted-foreground font-semibold">Label</span>
                          <Input
                            value={l.label}
                            onChange={(e) => updateLine(i, { label: e.target.value })}
                            placeholder="Line 1"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px]">
                          <span className="text-muted-foreground font-semibold inline-flex items-center gap-1">
                            Area code
                            <span
                              title="Three-digit US area code passed to Telnyx to bias the phone-number search (e.g. 415 for San Francisco, 617 for Boston)."
                              className="text-muted-foreground/70 cursor-help"
                              aria-label="What is the area code for?"
                            >
                              <Info size={11}/>
                            </span>
                          </span>
                          <Input
                            value={l.area_code}
                            onChange={(e) => updateLine(i, { area_code: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                            placeholder="415"
                            maxLength={3}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px]">
                          <span className="text-muted-foreground font-semibold">Routing</span>
                          <select
                            value={l.routing_type}
                            onChange={(e) => updateLine(i, { routing_type: e.target.value as RoutingType })}
                            disabled={i === 0}
                            className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                            aria-label="Routing type"
                          >
                            <option value="unique">Unique agent</option>
                            <option value="duplicate">Clone of Line 1</option>
                          </select>
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeLine(i)}
                          disabled={lines.length <= 1}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 size={14}/>
                        </Button>
                      </div>

                      {isUnique && (
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
                          <label className="flex flex-col gap-1 text-[11px]">
                            <span className="text-muted-foreground font-semibold">Industry (chooses Retell base agent)</span>
                            <select
                              value={l.industry_id}
                              onChange={(e) => updateLine(i, { industry_id: e.target.value })}
                              className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                            >
                              {industryOptions.map((o) => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                              ))}
                            </select>
                          </label>
                          <div className="text-[10px] font-mono text-muted-foreground pb-2">
                            base: {baseAgentId?.slice(0, 24)}…
                          </div>
                        </div>
                      )}

                      {isUnique && (
                        <label className="flex flex-col gap-1 text-[11px]">
                          <span className="text-muted-foreground font-semibold">
                            System prompt override (optional — leave blank to keep the base agent's prompt)
                          </span>
                          <textarea
                            value={l.system_prompt}
                            onChange={(e) => updateLine(i, { system_prompt: e.target.value })}
                            className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-[11px] text-foreground font-mono"
                            placeholder="You are Phoebe, a helpful AI assistant for {company}…"
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Line 1 is always the primary unique agent. Additional lines can either clone Line 1 (share one agent across numbers) or be unique agents with their own industry &amp; prompt. Document Solutions maps to Retell agent <span className="font-mono">agent_33d6c554…</span>; every other industry maps to <span className="font-mono">agent_281c022a…</span>.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={submit} disabled={submitting} className="gap-2">
                {submitting ? <><Loader2 size={14} className="animate-spin"/> Provisioning…</> : <><Zap size={14}/> Provision</>}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              This buys phone numbers on Telnyx and creates Retell agents in real time. If any step fails, the entire batch is rolled back automatically.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

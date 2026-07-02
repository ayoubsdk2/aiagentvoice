import { useEffect, useState } from "react";
import { ShieldCheck, FileText, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/lib/usePageMeta";

interface Reg { code: string; name: string; jurisdiction: string; category: string; description: string; reference_url: string | null; }
interface SubProcessor { name: string; purpose: string; hosting_region: string; status: string; }

/**
 * Public-ish trust page. Shows frameworks and sub-processors —
 * uses existing glass-card primitives, no new visual tokens.
 */
export default function TrustPage() {
  usePageMeta({
    title: "Trust & Compliance — Phaos AI",
    description: "Frameworks, sub-processors, hosting regions, and data handling commitments for Phaos AI voice automation.",
    path: "/trust",
  });
  const [regs, setRegs] = useState<Reg[]>([]);
  const [subs, setSubs] = useState<SubProcessor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [r, s] = await Promise.all([
        supabase.from("regulation_registry").select("code,name,jurisdiction,category,description,reference_url").order("code"),
        supabase.from("sub_processors").select("name,purpose,hosting_region,status").order("name"),
      ]);
      if (cancelled) return;
      setRegs((r.data ?? []) as Reg[]);
      setSubs((s.data ?? []) as SubProcessor[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary" size={22} />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Trust &amp; Compliance</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Phaos AI builds for regulated industries. Below is the live registry of frameworks we
            map controls to, the sub-processors that touch tenant data, and how to reach our
            compliance team.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText size={16} className="text-primary" /> Frameworks &amp; Regulations
          </h2>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : regs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No frameworks registered.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {regs.map((r) => (
                <article key={r.code} className="glass-card p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold">{r.name}</h3>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{r.jurisdiction}</span>
                  </div>
                  <div className="text-[11px] uppercase tracking-widest text-primary font-bold">{r.category}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                  {r.reference_url && (
                    <a
                      href={r.reference_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-block text-[11px] text-primary hover:underline"
                    >
                      Authoritative reference →
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Sub-Processors</h2>
          {subs.length === 0 ? (
            <div className="glass-card p-4 text-sm text-muted-foreground">
              Sub-processor registry will be published once contracts are finalized.
            </div>
          ) : (
            <div className="glass-card divide-y divide-border/30">
              {subs.map((s) => (
                <div key={s.name} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">{s.purpose}</div>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{s.hosting_region}</span>
                  <span className="text-[11px] uppercase tracking-widest font-bold text-primary">{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass-card p-4 space-y-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Mail size={16} className="text-primary" /> Compliance Contact
          </h2>
          <p className="text-xs text-muted-foreground">
            Submit DSARs, vendor questionnaires, or breach inquiries to{" "}
            <a className="text-primary hover:underline" href="mailto:compliance@phaosai.com">
              compliance@phaosai.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}

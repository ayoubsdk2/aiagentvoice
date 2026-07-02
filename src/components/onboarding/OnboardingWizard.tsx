import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  MapPin,
  Phone,
  ShieldCheck,
  Upload,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import phaosLogo from "@/assets/phaos-logo.png";

type StepId = 1 | 2 | 3 | 4;

const STEPS: Array<{ id: StepId; label: string; icon: typeof Building2 }> = [
  { id: 1, label: "Identity & Branding", icon: Building2 },
  { id: 2, label: "Primary Location", icon: MapPin },
  { id: 3, label: "Forwarding Number", icon: Phone },
  { id: 4, label: "Verify & Activate", icon: ShieldCheck },
];

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { org, status, refresh } = useCurrentOrg();
  const [step, setStep] = useState<StepId>(1);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [companyName, setCompanyName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#a855f7");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 2
  const [locName, setLocName] = useState("Main Headquarters");
  const [locCity, setLocCity] = useState("");
  const [locState, setLocState] = useState("");

  // Step 3
  const [forwardNumber, setForwardNumber] = useState("");

  // Step 4
  const [originNumber, setOriginNumber] = useState("");

  // Hydrate from existing org
  useEffect(() => {
    if (org) {
      setCompanyName(org.name === "" || /^\w+$/.test(org.name) ? "" : org.name);
      setPrimaryColor(org.branding?.primary_color || "#a855f7");
      setLogoUrl(org.branding?.logo_url || null);
      setStep((Math.max(1, Math.min(4, org.onboarding_step)) as StepId) || 1);
    }
  }, [org]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!org) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        No organization found. Please refresh.
      </div>
    );
  }

  async function handleLogoUpload(file: File) {
    if (!file || !org) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${org.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("org-branding")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("org-branding").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function persistCurrentStep(targetStep: StepId, finalize = false) {
    if (!org) return false;
    setBusy(true);
    try {
      // Step 1 — branding & identity
      if (step === 1) {
        if (!companyName.trim()) {
          toast.error("Company name is required");
          return false;
        }
        const { error: oErr } = await supabase
          .from("organizations")
          .update({
            name: companyName.trim(),
            onboarding_step: targetStep,
          })
          .eq("id", org.id);
        if (oErr) throw oErr;

        const { error: bErr } = await supabase
          .from("organization_branding")
          .upsert(
            {
              organization_id: org.id,
              logo_url: logoUrl,
              primary_color: primaryColor,
              display_name: companyName.trim(),
            },
            { onConflict: "organization_id" },
          );
        if (bErr) throw bErr;
      }

      // Step 2 — location
      if (step === 2) {
        if (!locName.trim()) {
          toast.error("Location name is required");
          return false;
        }
        // Upsert primary location (only one primary per org)
        const { data: existing } = await supabase
          .from("org_locations")
          .select("id")
          .eq("organization_id", org.id)
          .eq("is_primary", true)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("org_locations")
            .update({
              name: locName.trim(),
              city: locCity.trim() || null,
              state: locState.trim() || null,
            })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("org_locations").insert({
            organization_id: org.id,
            name: locName.trim(),
            city: locCity.trim() || null,
            state: locState.trim() || null,
            is_primary: true,
          });
          if (error) throw error;
        }
        await supabase
          .from("organizations")
          .update({ onboarding_step: targetStep })
          .eq("id", org.id);
      }

      // Step 3 — forwarding (AI gateway target) number
      if (step === 3) {
        if (!validateE164(forwardNumber)) {
          toast.error("Enter a phone number in E.164 format, e.g. +15551234567");
          return false;
        }
        const { data: loc } = await supabase
          .from("org_locations")
          .select("id")
          .eq("organization_id", org.id)
          .eq("is_primary", true)
          .maybeSingle();

        const { data: existing } = await supabase
          .from("telephony_assets")
          .select("id")
          .eq("organization_id", org.id)
          .eq("location_id", loc?.id ?? null)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("telephony_assets")
            .update({
              ai_gateway_number: forwardNumber.trim(),
              status: "pending_forward",
            })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("telephony_assets").insert({
            organization_id: org.id,
            location_id: loc?.id ?? null,
            ai_gateway_number: forwardNumber.trim(),
            status: "pending_forward",
          });
          if (error) throw error;
        }
        await supabase
          .from("organizations")
          .update({ onboarding_step: targetStep })
          .eq("id", org.id);
      }

      // Step 4 — origin (forwarding origin) number + finalize
      if (step === 4) {
        if (!validateE164(originNumber)) {
          toast.error("Enter your existing business line in E.164 format");
          return false;
        }
        const { data: asset } = await supabase
          .from("telephony_assets")
          .select("id")
          .eq("organization_id", org.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (asset) {
          const { error } = await supabase
            .from("telephony_assets")
            .update({ business_origin_number: originNumber.trim() })
            .eq("id", asset.id);
          if (error) throw error;
        }
        if (finalize) {
          const { error } = await supabase
            .from("organizations")
            .update({ onboarding_completed: true, onboarding_step: 4 })
            .eq("id", org.id);
          if (error) throw error;
        }
      }

      await refresh();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    const target = (Math.min(4, step + 1) as StepId);
    const ok = await persistCurrentStep(target);
    if (ok) setStep(target);
  }

  async function back() {
    setStep((Math.max(1, step - 1) as StepId));
  }

  async function finish() {
    const ok = await persistCurrentStep(4, true);
    if (ok) {
      toast.success("Setup complete");
      onComplete();
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border/40 flex items-center gap-3">
        <img src={phaosLogo} alt="Phaos AI" className="w-8 h-8 rounded-lg" />
        <div>
          <div className="text-sm font-bold tracking-tight">Phaos AI</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Welcome — let's set up your workspace
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row max-w-6xl mx-auto w-full px-4 md:px-6 py-8 gap-8">
        {/* Stepper */}
        <aside className="md:w-72 shrink-0">
          <ol className="space-y-2">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const done = step > s.id;
              const active = step === s.id;
              return (
                <li
                  key={s.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    active
                      ? "border-primary/60 bg-primary/10"
                      : done
                        ? "border-border/30 bg-card/40"
                        : "border-border/20 bg-card/20"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      done
                        ? "bg-primary/20 text-primary"
                        : active
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    {done ? <Check size={15} /> : <Icon size={15} />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                      Step {s.id}
                    </div>
                    <div className="text-sm font-semibold">{s.label}</div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 p-4 rounded-xl border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary font-bold mb-1">
              <Sparkles size={11} /> Why this matters
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Once setup is complete, every dashboard in your portal
              auto-populates with your real call data, leads, and analytics.
              No more sample placeholders.
            </p>
          </div>
        </aside>

        {/* Pane */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 md:p-8 shadow-2xl"
            >
              {step === 1 && (
                <Step1
                  companyName={companyName}
                  setCompanyName={setCompanyName}
                  primaryColor={primaryColor}
                  setPrimaryColor={setPrimaryColor}
                  logoUrl={logoUrl}
                  uploading={uploading}
                  onPickFile={() => fileRef.current?.click()}
                />
              )}
              {step === 2 && (
                <Step2
                  locName={locName}
                  setLocName={setLocName}
                  locCity={locCity}
                  setLocCity={setLocCity}
                  locState={locState}
                  setLocState={setLocState}
                />
              )}
              {step === 3 && (
                <Step3
                  forwardNumber={forwardNumber}
                  setForwardNumber={setForwardNumber}
                />
              )}
              {step === 4 && (
                <Step4
                  originNumber={originNumber}
                  setOriginNumber={setOriginNumber}
                  forwardNumber={forwardNumber}
                  companyName={companyName}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleLogoUpload(f);
              e.target.value = "";
            }}
          />

          {/* Controls */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              disabled={step === 1 || busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border/40 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Back
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={next}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <>Continue <ChevronRight size={14} /></>}
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <>Activate workspace <Check size={14} /></>}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* =============================================================== */
/* Steps                                                            */
/* =============================================================== */

function Step1(props: {
  companyName: string;
  setCompanyName: (v: string) => void;
  primaryColor: string;
  setPrimaryColor: (v: string) => void;
  logoUrl: string | null;
  uploading: boolean;
  onPickFile: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Identity & Branding</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This appears in your portal header, customer-facing reports, and
          Phoebe's caller-ID overlay.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          Company name
        </label>
        <input
          value={props.companyName}
          onChange={(e) => props.setCompanyName(e.target.value)}
          placeholder="e.g. SlashShield Document Solutions"
          maxLength={120}
          className="w-full px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/40 text-sm font-medium focus:outline-none focus:border-primary"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          Brand primary color
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={props.primaryColor}
            onChange={(e) => props.setPrimaryColor(e.target.value)}
            className="w-12 h-10 rounded-lg border border-border/40 bg-transparent cursor-pointer"
          />
          <input
            value={props.primaryColor}
            onChange={(e) => props.setPrimaryColor(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/40 text-sm font-mono focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          Logo (PNG / SVG, &lt; 2 MB)
        </label>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl bg-secondary/40 border border-border/40 flex items-center justify-center overflow-hidden">
            {props.logoUrl ? (
              <img src={props.logoUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <Building2 size={22} className="text-muted-foreground" />
            )}
          </div>
          <button
            type="button"
            onClick={props.onPickFile}
            disabled={props.uploading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border/40 text-sm font-bold hover:bg-secondary/40 transition-colors disabled:opacity-50"
          >
            {props.uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {props.logoUrl ? "Replace logo" : "Upload logo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step2(props: {
  locName: string;
  setLocName: (v: string) => void;
  locCity: string;
  setLocCity: (v: string) => void;
  locState: string;
  setLocState: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Primary Location</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add your first office or service hub. You can add more locations
          (branches, regions) from the Locations tab after setup.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          Location name
        </label>
        <input
          value={props.locName}
          onChange={(e) => props.setLocName(e.target.value)}
          placeholder="e.g. Main Headquarters, Tampa Branch"
          maxLength={120}
          className="w-full px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/40 text-sm font-medium focus:outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            City
          </label>
          <input
            value={props.locCity}
            onChange={(e) => props.setLocCity(e.target.value)}
            placeholder="Tampa"
            maxLength={80}
            className="w-full px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/40 text-sm font-medium focus:outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            State / Region
          </label>
          <input
            value={props.locState}
            onChange={(e) => props.setLocState(e.target.value)}
            placeholder="FL"
            maxLength={40}
            className="w-full px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/40 text-sm font-medium focus:outline-none focus:border-primary"
          />
        </div>
      </div>
    </div>
  );
}

function Step3(props: {
  forwardNumber: string;
  setForwardNumber: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">AI Gateway Number</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Paste the phone number Phoebe will answer on. This is the number
          we provided you, or the one you've already provisioned through
          your voice provider.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          AI Gateway target number
        </label>
        <input
          value={props.forwardNumber}
          onChange={(e) => props.setForwardNumber(e.target.value)}
          placeholder="+15551234567"
          inputMode="tel"
          className="w-full px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/40 text-sm font-mono focus:outline-none focus:border-primary"
        />
        <p className="text-[11px] text-muted-foreground/80">
          Use E.164 format (country code + digits, no spaces).
        </p>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">
          Activation instructions
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Point your VOIP / PBX call forwarding to this gateway number to
          activate Phoebe on inbound calls. Direct provider provisioning
          (one-click forwarding) is in development — for now, contact your
          telco or PBX admin to enable forwarding.
        </p>
      </div>
    </div>
  );
}

function Step4(props: {
  originNumber: string;
  setOriginNumber: (v: string) => void;
  forwardNumber: string;
  companyName: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Verify & Activate</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us which existing business line will forward into the AI
          gateway. We use this to recognize your branch traffic and apply
          your white-label caller-ID.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          Forwarding origin number
        </label>
        <input
          value={props.originNumber}
          onChange={(e) => props.setOriginNumber(e.target.value)}
          placeholder="+15559876543"
          inputMode="tel"
          className="w-full px-3 py-2.5 rounded-lg bg-secondary/40 border border-border/40 text-sm font-mono focus:outline-none focus:border-primary"
        />
      </div>

      <div className="rounded-xl border border-border/40 bg-card/30 p-4 space-y-2">
        <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          Summary
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Summary label="Company" value={props.companyName || "—"} />
          <Summary label="Gateway number" value={props.forwardNumber || "—"} mono />
          <Summary label="Origin number" value={props.originNumber || "—"} mono />
          <Summary label="Status" value="Pending forward" />
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-secondary/30 border border-border/30 p-3">
      <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function validateE164(v: string): boolean {
  return /^\+\d{8,15}$/.test(v.trim());
}

import { useEffect, useRef, useState } from "react";
import { Settings, Loader2, Save, Building2, Image as ImageIcon, CreditCard, ExternalLink, CheckCircle2, AlertTriangle, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { org, status, refresh } = useCurrentOrg();
  const [name, setName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#a855f7");
  const [displayName, setDisplayName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setBillingEmail(org.billing_email ?? "");
    setPrimaryColor(org.branding?.primary_color ?? "#a855f7");
    setDisplayName(org.branding?.display_name ?? "");
    setLogoUrl(org.branding?.logo_url ?? null);
  }, [org?.id]); // eslint-disable-line

  if (status === "loading") {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!org) return <div className="text-sm text-muted-foreground">No organization found.</div>;

  async function saveProfile() {
    if (!org) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("organizations").update({
        name: name.trim() || org.name,
        billing_email: billingEmail.trim() || null,
      }).eq("id", org.id);
      if (error) throw error;
      toast.success("Organization profile saved");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setSavingProfile(false); }
  }

  async function saveBranding() {
    if (!org) return;
    setSavingBrand(true);
    try {
      const { error } = await supabase.from("organization_branding").upsert({
        organization_id: org.id,
        primary_color: primaryColor,
        display_name: displayName.trim() || null,
        logo_url: logoUrl,
      }, { onConflict: "organization_id" });
      if (error) throw error;
      toast.success("Branding saved");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setSavingBrand(false); }
  }

  async function uploadLogo(file: File) {
    if (!org) return;
    if (file.size > 2_000_000) return toast.error("Logo must be under 2MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${org.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("org-branding").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("org-branding").getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
      toast.success("Logo uploaded — click Save branding to apply");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  }

  const billingVerified = org.stripe_payment_method_verified;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Settings className="h-3.5 w-3.5" /> Admin
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Organization profile, branding, and billing. Changes sync to your portal in real time.
        </p>
      </header>

      {/* ORG PROFILE */}
      <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold">Organization Profile</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label>Company name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Billing email</Label>
            <Input type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} placeholder="billing@company.com" />
          </div>
          <div className="grid gap-1.5">
            <Label>Slug</Label>
            <Input value={org.slug} disabled />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveProfile} disabled={savingProfile} className="gap-1.5">
            {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save profile
          </Button>
        </div>
      </section>

      {/* BRANDING */}
      <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold">Branding</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Display name (optional)</Label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={name || "Shown in customer-facing surfaces"} />
            </div>
            <div className="grid gap-1.5">
              <Label>Primary color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="h-10 w-16 rounded-md border border-border/60 bg-transparent cursor-pointer"
                />
                <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="font-mono" />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <Label>Logo</Label>
            <div className="rounded-xl border border-dashed border-border/60 bg-background/40 p-6 flex flex-col items-center justify-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Org logo" className="h-20 w-20 object-contain rounded-md bg-card/60 p-2" />
              ) : (
                <div className="h-20 w-20 rounded-md bg-muted/30 grid place-items-center text-muted-foreground">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])}
              />
              <Button variant="outline" size="sm" className="gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {logoUrl ? "Replace logo" : "Upload logo"}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">PNG/SVG, square, under 2MB</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveBranding} disabled={savingBrand} className="gap-1.5">
            {savingBrand ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save branding
          </Button>
        </div>
      </section>

      {/* BILLING */}
      <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold">Billing</h2>
          </div>
          {billingVerified ? (
            <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" /> Payment method on file
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] gap-1 bg-amber-500/15 text-amber-300 border-amber-500/30">
              <AlertTriangle className="w-3 h-3" /> No payment method
            </Badge>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <BillingStat label="Stripe customer" value={org.stripe_customer_id ? "Linked" : "Not linked"} mono={!!org.stripe_customer_id} small={org.stripe_customer_id ?? undefined} />
          <BillingStat label="Subscription" value="Trial" />
          <BillingStat label="Invoices" value="—" />
        </div>

        <div className="mt-5 rounded-xl border border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
          Plan management, invoice history, and self-serve upgrades are coming online with your subscription.
          For changes to your plan or to add a payment method, contact{" "}
          <a href="mailto:billing@phaosai.com" className="text-primary underline-offset-4 hover:underline">billing@phaosai.com</a>.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="gap-1.5" asChild>
            <a href="mailto:billing@phaosai.com?subject=Update%20payment%20method">
              <CreditCard className="w-3.5 h-3.5" /> Update payment method
            </a>
          </Button>
          <Button variant="outline" className="gap-1.5" asChild>
            <a href="mailto:billing@phaosai.com?subject=Billing%20question">
              <ExternalLink className="w-3.5 h-3.5" /> Billing support
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}

function BillingStat({ label, value, small, mono }: { label: string; value: string; small?: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${mono ? "font-mono" : ""}`}>{value}</div>
      {small && <div className="mt-0.5 text-[10px] font-mono text-muted-foreground truncate">{small}</div>}
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Mail, Phone, MapPin, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopHeader } from "@/components/command-center/TopHeader";
import { toast } from "sonner";
import { usePageMeta } from "@/lib/usePageMeta";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  reason: z.string().trim().min(1, "Please tell us how we can help").max(2000),
});

export default function Contact() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  usePageMeta({
    title: "Contact Phaos AI — Request a Demo",
    description: "Get in touch with Phaos AI to request a demo, start a pilot, or ask how Phoebe handles inbound calls for your print and copier dealership.",
    path: "/contact",
  });


  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("contact_submissions").insert({
      id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      reason: parsed.data.reason,
    });
    if (error) {
      setSubmitting(false);
      toast.error("Could not submit. Please try again or email daniel@phaosai.com directly.");
      return;
    }
    // Notify Daniel via email (non-blocking failure).
    try {
      await supabase.functions.invoke("send-contact-email", {
        body: {
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone || "",
          reason: parsed.data.reason,
        },
      });
    } catch (err) {
      console.warn("Email notification failed:", err);
    }

    setSubmitting(false);
    setDone(true);
    toast.success("Message sent — Daniel will be in touch shortly.");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <TopHeader publicMode brandLabel="Phaos AI" />
      <main className="flex-1 px-4 md:px-8 py-10 md:py-16">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <header className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Get in <span className="text-primary">Touch</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              Whether you have questions about our platform, want to schedule a call, or explore a
              partnership — we'd love to hear from you.
            </p>
          </header>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 md:p-8 shadow-2xl">
              {done ? (
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center mb-4">
                    <CheckCircle2 className="text-primary" size={28} />
                  </div>
                  <h2 className="text-xl font-bold mb-1">Message sent</h2>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Thanks! Daniel will reach out to you shortly.
                  </p>
                  <Link
                    to="/"
                    className="mt-6 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Back to Sandbox
                  </Link>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Name</label>
                    <input
                      required
                      maxLength={100}
                      value={form.name}
                      onChange={update("name")}
                      placeholder="Your full name"
                      className="w-full bg-secondary/40 border border-border/50 rounded-lg px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Email</label>
                    <input
                      required
                      type="email"
                      maxLength={255}
                      value={form.email}
                      onChange={update("email")}
                      placeholder="you@company.com"
                      className="w-full bg-secondary/40 border border-border/50 rounded-lg px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Phone <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      maxLength={30}
                      value={form.phone}
                      onChange={update("phone")}
                      placeholder="+1 (555) 555-5555"
                      className="w-full bg-secondary/40 border border-border/50 rounded-lg px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Reason for Contacting Phaos AI
                    </label>
                    <textarea
                      required
                      rows={5}
                      maxLength={2000}
                      value={form.reason}
                      onChange={update("reason")}
                      placeholder="Tell us how we can help — whether it's a product demo, technical question, partnership opportunity, or anything else..."
                      className="w-full bg-secondary/40 border border-border/50 rounded-lg px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors resize-y"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-full bg-gradient-to-r from-primary to-primary/70 text-primary-foreground font-semibold tracking-wide hover:opacity-95 disabled:opacity-60 transition-all shadow-lg shadow-primary/30"
                  >
                    {submitting ? "Sending..." : "Send Message"}
                  </button>
                </form>
              )}
            </div>

            <div className="space-y-4">
              <InfoCard icon={<Mail size={18} />} label="Email" value="info@phaosai.com" href="mailto:info@phaosai.com" />
              <InfoCard icon={<Phone size={18} />} label="Phone" value="(617) 678-2426" href="tel:+16176782426" />
              <InfoCard icon={<MapPin size={18} />} label="Location" value="Florida, USA" />
              <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5">
                <h3 className="font-bold mb-1">Prefer a call?</h3>
                <p className="text-sm text-muted-foreground">
                  We're happy to schedule a call to discuss exactly how Phaos AI can transform your
                  operations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 hover:border-primary/40 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold">{label}</div>
        <div className="text-sm text-muted-foreground">{value}</div>
      </div>
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Step-up MFA challenge page.
 * RequireAdminAAL2 redirects unverified admins here.
 */
export default function MfaChallenge() {
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = factors?.totp?.find((f) => f.status === "verified");
      if (!verifiedTotp) {
        navigate("/mfa-setup", { replace: true });
        return;
      }
      if (!cancelled) {
        setFactorId(verifiedTotp.id);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  async function submit() {
    if (!factorId) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chalErr || !chal) {
        setErrorMsg(chalErr?.message ?? "Could not issue challenge");
        return;
      }
      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: chal.id,
        code: code.trim(),
      });
      if (verErr) {
        setErrorMsg(verErr.message);
        return;
      }
      navigate("/", { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary" size={20} />
          <h1 className="text-lg font-bold tracking-tight">Verify Your Identity</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter the 6-digit code from your authenticator app.
        </p>
        <div className="space-y-1.5">
          <label htmlFor="mfa-challenge-code" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Code
          </label>
          <input
            id="mfa-challenge-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full bg-secondary/50 border border-border/50 rounded-lg h-10 px-3 text-sm tracking-widest text-center font-mono focus:outline-none focus:border-primary/50"
            placeholder="123456"
          />
        </div>
        {errorMsg && (
          <p role="alert" className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {errorMsg}
          </p>
        )}
        <button
          onClick={submit}
          disabled={submitting || code.length !== 6}
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Continue
        </button>
      </div>
    </div>
  );
}

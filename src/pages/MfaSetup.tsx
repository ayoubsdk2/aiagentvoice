import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Admin-only TOTP enrollment page.
 * Routes here from the user menu → "Set up MFA".
 * Uses Supabase MFA (TOTP) — no third-party SDK required.
 */
export default function MfaSetup() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ready" | "enrolling" | "verifying" | "done" | "error">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        navigate("/auth", { replace: true });
        return;
      }
      // List existing factors first; if a verified TOTP factor exists, jump to done.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = factors?.totp?.find((f) => f.status === "verified");
      if (verifiedTotp) {
        if (!cancelled) setStatus("done");
        return;
      }
      if (!cancelled) setStatus("ready");
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  async function startEnrollment() {
    setErrorMsg(null);
    setStatus("enrolling");
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) {
      setErrorMsg(error?.message ?? "Could not start enrollment");
      setStatus("error");
      return;
    }
    setFactorId(data.id);
    setQrSvg(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStatus("verifying");
  }

  async function verifyCode() {
    if (!factorId) return;
    setErrorMsg(null);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chalErr || !chal) {
      setErrorMsg(chalErr?.message ?? "Challenge failed");
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
    toast.success("MFA enabled.");
    setStatus("done");
    setTimeout(() => navigate("/", { replace: true }), 1200);
  }

  async function copySecret() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary" size={20} />
          <h1 className="text-lg font-bold tracking-tight">Set up Multi-Factor Authentication</h1>
        </div>

        {status === "loading" && (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-primary" size={20} />
          </div>
        )}

        {status === "ready" && (
          <>
            <p className="text-xs text-muted-foreground">
              You'll need an authenticator app (1Password, Authy, Google Authenticator, etc.). After enrolling, your account requires a 6-digit code at sign-in for elevated actions.
            </p>
            <button
              onClick={startEnrollment}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Begin enrollment
            </button>
          </>
        )}

        {status === "enrolling" && (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-primary" size={20} />
          </div>
        )}

        {status === "verifying" && (
          <div className="space-y-4">
            {qrSvg && (
              <div
                className="bg-background p-3 rounded-lg border border-border/50 flex justify-center"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
                aria-label="MFA QR code"
              />
            )}
            {secret && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Manual secret (if you can't scan)
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-secondary/50 border border-border/50 rounded-md px-3 py-2 font-mono break-all">
                    {secret}
                  </code>
                  <button
                    onClick={copySecret}
                    aria-label="Copy MFA secret"
                    className="p-2 rounded-md border border-border/50 bg-secondary/40 hover:bg-secondary/60"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="mfa-code" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                6-digit code
              </label>
              <input
                id="mfa-code"
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
              onClick={verifyCode}
              disabled={code.length !== 6}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              Verify and enable
            </button>
          </div>
        )}

        {status === "done" && (
          <div className="rounded-md border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 px-3 py-2.5 text-xs text-[hsl(var(--success))]">
            MFA is active on your account. Redirecting…
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {errorMsg ?? "Enrollment failed."}
            </p>
            <button
              onClick={() => setStatus("ready")}
              className="w-full h-9 rounded-lg border border-border/50 bg-secondary/40 hover:bg-secondary/60 text-xs font-bold tracking-wide"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

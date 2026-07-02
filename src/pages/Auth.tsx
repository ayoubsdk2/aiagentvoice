import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Check, X, Loader2, ArrowLeft, Mail } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { setRememberMe } from "@/lib/session-persistence";
import phaosCrown from "@/assets/phaos-crown-mark.png";
import phaosAiWordmark from "@/assets/phaos-ai-wordmark.png";
import {
  evaluateRules,
  meetsPolicy,
  scorePassword,
} from "@/lib/password-policy";
import { toast } from "sonner";
import { usePageMeta } from "@/lib/usePageMeta";

type Mode = "signin" | "signup" | "reset" | "reset-help";

const emailSchema = z
  .string()
  .trim()
  .email({ message: "Enter a valid email address" })
  .max(255, { message: "Email is too long" });

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [helpReason, setHelpReason] = useState("");
  const [helpSent, setHelpSent] = useState(false);
  const [rememberMe, setRememberMeState] = useState(false);

  // If a session already exists, bounce to /
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate("/", { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/", { replace: true });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const rules = evaluateRules(password);
  const strength = scorePassword(password);
  const passwordsMatch = password.length > 0 && password === confirm;

  const canSubmit =
    !submitting &&
    email.trim().length > 0 &&
    (mode === "signin"
      ? password.length > 0
      : mode === "signup"
      ? meetsPolicy(password) && passwordsMatch
      : true);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setResetSent(false);
    setHelpSent(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }

    if (mode === "signup" && !meetsPolicy(password)) {
      setError("Password does not meet the security policy.");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: parsed.data,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (signUpError) {
          setError(friendlyAuthError(signUpError.message));
          return;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: parsed.data,
          password,
        });
        if (signInError) {
          setError(friendlyAuthError(signInError.message));
          return;
        }
        setRememberMe(rememberMe);
        toast.success("Account created — welcome to prototype mode.");
        navigate("/", { replace: true });
      } else if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: parsed.data,
          password,
        });
        if (signInError) {
          setError(friendlyAuthError(signInError.message));
          return;
        }
        setRememberMe(rememberMe);
        navigate("/", { replace: true });
      } else if (mode === "reset") {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
          parsed.data,
          { redirectTo: `${window.location.origin}/auth` }
        );
        if (resetErr) {
          setError(friendlyAuthError(resetErr.message));
          return;
        }
        setResetSent(true);
        toast.success("Password reset email sent — check your inbox.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendAdminHelp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setSubmitting(true);
    try {
      const { error: fnErr } = await supabase.functions.invoke(
        "request-password-reset-help",
        {
          body: {
            email: parsed.data,
            reason: helpReason.trim() || undefined,
          },
        }
      );
      if (fnErr) {
        setError(
          "We couldn't send the request right now. Please try again in a moment."
        );
        return;
      }
      setHelpSent(true);
      toast.success("Request sent to the Phaos AI admin.");
    } finally {
      setSubmitting(false);
    }
  }

  usePageMeta({
    title: "Sign in to Phaos AI",
    description: "Sign in to the Phaos AI dealer and operator portal to manage your voice agent, call history, and integrations.",
    path: "/auth",
  });
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center overflow-y-auto p-4 pt-6 pb-12 md:p-8 md:pb-16 selection:bg-primary/30">
      <div className="w-full max-w-md mb-8 md:mb-16">
        <h1 className="sr-only">Sign in to Phaos AI</h1>
        <div className="text-center mb-3">
          <PhaosWordmark />
        </div>

        <div className="glass-card p-6 space-y-5">
          {/* Tabs (hidden on reset views) */}
          {(mode === "signup" || mode === "signin") && (
            <div className="inline-flex w-full items-center rounded-full border border-border/50 bg-secondary/40 p-0.5 text-[11px] font-bold uppercase tracking-wider">
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`flex-1 px-3 py-1.5 rounded-full transition-colors ${
                  mode === "signup"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={mode === "signup"}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`flex-1 px-3 py-1.5 rounded-full transition-colors ${
                  mode === "signin"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={mode === "signin"}
              >
                Sign In
              </button>
            </div>
          )}

          {/* RESET PASSWORD VIEW */}
          {mode === "reset" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={12} /> Back
              </button>
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Reset Your Password
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your email and we'll send you a secure reset link.
                </p>
              </div>

              {resetSent ? (
                <div className="space-y-3">
                  <div className="rounded-md border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 px-3 py-2.5 text-xs text-[hsl(var(--success))] flex items-start gap-2">
                    <Mail size={14} className="mt-0.5 shrink-0" />
                    <div>
                      Reset link sent to <span className="font-semibold">{email}</span>.
                      Please check your inbox (and spam folder).
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Didn't receive it within a few minutes?
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode("reset-help")}
                    className="w-full h-9 rounded-lg border border-border/50 bg-secondary/40 hover:bg-secondary/60 text-xs font-bold tracking-wide transition-colors"
                  >
                    Send the admin a request to reset
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reset-email"
                      className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Email
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-secondary/50 border border-border/50 rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                      placeholder="you@company.com"
                    />
                  </div>
                  {error && (
                    <p
                      role="alert"
                      className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2"
                    >
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    Send Reset Link
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ADMIN HELP VIEW */}
          {mode === "reset-help" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={12} /> Back
              </button>
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Request Admin Assistance
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  We'll notify <span className="text-foreground font-semibold">Daniel@PhaosAI.com</span>{" "}
                  to help reset your password. Identity will be verified before any change.
                </p>
              </div>

              {helpSent ? (
                <div className="rounded-md border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 px-3 py-2.5 text-xs text-[hsl(var(--success))]">
                  Request sent. The Phaos AI admin will reach out shortly to verify
                  your identity.
                </div>
              ) : (
                <form onSubmit={handleSendAdminHelp} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="help-email"
                      className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Your Email
                    </label>
                    <input
                      id="help-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-secondary/50 border border-border/50 rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                      placeholder="you@company.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="help-reason"
                      className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Reason (optional)
                    </label>
                    <textarea
                      id="help-reason"
                      value={helpReason}
                      onChange={(e) => setHelpReason(e.target.value.slice(0, 500))}
                      rows={3}
                      maxLength={500}
                      className="w-full bg-secondary/50 border border-border/50 rounded-lg p-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none"
                      placeholder="e.g. didn't receive the reset email"
                    />
                  </div>
                  {error && (
                    <p
                      role="alert"
                      className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2"
                    >
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || email.trim().length === 0}
                    className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    Send Request to Admin
                  </button>
                </form>
              )}
            </div>
          )}

          {/* SIGNUP / SIGNIN FORM */}
          {(mode === "signup" || mode === "signin") && (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/50 rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  placeholder="you@company.com"
                />
              </div>

              <PasswordField
                id="password"
                label="Password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={setPassword}
                show={showPw}
                onToggleShow={() => setShowPw((s) => !s)}
              />

              {mode === "signup" && (
                <>
                  <StrengthMeter
                    score={strength.score}
                    label={strength.label}
                    toneClass={strength.toneClass}
                  />
                  <RuleList
                    rules={[
                      { ok: rules.minLength, text: "At least 10 characters" },
                      { ok: rules.hasUppercase, text: "One uppercase letter" },
                      { ok: rules.hasLowercase, text: "One lowercase letter" },
                      { ok: rules.hasNumber, text: "One number" },
                      { ok: rules.hasSpecial, text: "One special character" },
                    ]}
                  />
                  <PasswordField
                    id="confirm"
                    label="Confirm Password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={setConfirm}
                    show={showConfirm}
                    onToggleShow={() => setShowConfirm((s) => !s)}
                  />
                  {confirm.length > 0 && (
                    <p
                      className={`text-xs flex items-center gap-1.5 ${
                        passwordsMatch
                          ? "text-[hsl(var(--success))]"
                          : "text-destructive"
                      }`}
                    >
                      {passwordsMatch ? <Check size={12} /> : <X size={12} />}
                      {passwordsMatch
                        ? "Passwords match"
                        : "Passwords do not match"}
                    </p>
                  )}
                </>
              )}

              {error && (
                <p
                  role="alert"
                  className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2"
                >
                  {error}
                </p>
              )}

              <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMeState(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border/60 bg-secondary/60 text-primary focus:ring-1 focus:ring-primary/40 focus:ring-offset-0 cursor-pointer accent-primary"
                />
                <span
                  className={`text-xs leading-snug transition-colors ${
                    rememberMe
                      ? "text-muted-foreground/70"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  <span
                    className={`font-semibold transition-colors ${
                      rememberMe ? "text-muted-foreground/70" : "text-foreground"
                    }`}
                  >
                    Remember me on this device
                  </span>
                </span>
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {mode === "signup" ? "Create Account" : "Sign In"}
              </button>

              {/* Reset link below the primary CTA */}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
                >
                  Reset Your Password
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/** PHAOS AI logo — purple crown stacked above PHAOS (white) AI (purple), centered. */
function PhaosWordmark() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-0.5 select-none"
      aria-label="Phaos AI"
    >
      <img
        src={phaosCrown}
        alt=""
        aria-hidden
        draggable={false}
        className="h-16 sm:h-20 w-auto drop-shadow-[0_0_24px_hsl(var(--primary)/0.35)]"
      />
      <img
        src={phaosAiWordmark}
        alt="Phaos AI"
        draggable={false}
        className="h-14 sm:h-[68px] w-auto [image-rendering:-webkit-optimize-contrast] [image-rendering:crisp-edges]"
      />

    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-secondary/50 border border-border/50 rounded-lg h-10 pl-3 pr-10 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={
            show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`
          }
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function StrengthMeter({
  score,
  label,
  toneClass,
}: {
  score: number;
  label: string;
  toneClass: string;
}) {
  const pct = (score / 4) * 100;
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden">
        <div
          className={`h-full transition-all ${toneClass}`}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground uppercase tracking-widest">
          Strength
        </span>
        <span className="font-semibold text-foreground">{label}</span>
      </div>
    </div>
  );
}

function RuleList({ rules }: { rules: { ok: boolean; text: string }[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
      {rules.map((r) => (
        <li
          key={r.text}
          className={`flex items-center gap-1.5 ${
            r.ok ? "text-[hsl(var(--success))]" : "text-muted-foreground"
          }`}
        >
          {r.ok ? <Check size={11} /> : <X size={11} />}
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("already registered") ||
    m.includes("already exists") ||
    m.includes("user already")
  ) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Email or password is incorrect.";
  }
  if (
    m.includes("pwned") ||
    m.includes("compromised") ||
    m.includes("breach")
  ) {
    return "This password has appeared in a known data breach. Please choose a different one.";
  }
  if (m.includes("rate") || m.includes("too many")) {
    return "Too many attempts — please wait a moment and try again.";
  }
  return message;
}

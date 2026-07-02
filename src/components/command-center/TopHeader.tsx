import { useState, useEffect, useMemo, useCallback, useRef, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Lock, CheckCircle2, AlertCircle, Shield, Send } from "lucide-react";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { useUser } from "@/hooks/use-user";
import { useSandboxIndustry } from "@/contexts/SandboxIndustryContext";
import { IndustryCombobox } from "./sandbox/IndustryCombobox";
import { VoiceCombobox } from "./sandbox/VoiceCombobox";
import { SandboxVoiceProvider } from "@/contexts/SandboxVoiceContext";
import { SendIndustryDialog } from "./sandbox/SendIndustryDialog";


const NAV_ITEMS_SEARCHABLE = [
  { id: "Dashboard", keywords: ["dashboard", "overview", "metrics", "home"] },
  { id: "Triage", keywords: ["triage", "live", "feed", "calls", "active"] },
  { id: "DNA", keywords: ["dna", "persona", "agentic", "ai", "voice", "parameters"] },
  { id: "Workflows", keywords: ["workflows", "agent", "canvas", "nodes", "automation"] },
  { id: "CallHistory", keywords: ["call", "history", "calls", "past", "log"] },
  { id: "Prompt", keywords: ["prompt", "system", "instructions", "persona"] },
  { id: "Sandbox", keywords: ["sandbox", "test", "call", "phoebe", "voice", "ai call"] },
  { id: "Leads", keywords: ["leads", "customers", "intelligence", "quote", "sales"] },
  { id: "ERP", keywords: ["erp", "integrations", "eautomate", "sales chain", "zapier", "hubspot"] },
  { id: "Compliance", keywords: ["compliance", "hipaa", "pci", "tcpa", "gdpr", "security"] },
  { id: "Analytics", keywords: ["analytics", "roi", "metrics", "performance", "savings"] },
  { id: "LiveAccounts", keywords: ["live", "accounts", "access codes", "admin", "tenant"] },
];

interface TopHeaderProps {
  onNavigate?: (tabId: string) => void;
  publicMode?: boolean;
  brandLabel?: string;
}

export function TopHeader({ onNavigate, publicMode = false, brandLabel }: TopHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const { mode, liveAccount, liveUnlocked, redeemCode, setMode, clearLive } = useAccountMode();
  const { role } = useUser();
  const navigate = useNavigate();

  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const errorTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => { if (errorTimer.current) window.clearTimeout(errorTimer.current); }, []);

  const submitCode = useCallback(async () => {
    if (submitting) return;
    const value = codeInput.trim();
    if (value.length < 5) {
      setCodeError("Code must be at least 5 characters.");
      return;
    }
    setSubmitting(true);
    setCodeError(null);
    const err = await redeemCode(value);
    setSubmitting(false);
    if (err) {
      setCodeError(err);
      setCodeSuccess(false);
      if (errorTimer.current) window.clearTimeout(errorTimer.current);
      errorTimer.current = window.setTimeout(() => setCodeError(null), 5000);
      return;
    }
    setCodeSuccess(true);
    setCodeInput("");
    window.setTimeout(() => setCodeSuccess(false), 1800);
  }, [codeInput, redeemCode, submitting]);

  const handleCodeKey = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submitCode();
    }
  }, [submitCode]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return NAV_ITEMS_SEARCHABLE.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.includes(q))
    );
  }, [searchQuery]);

  const handleSelectResult = useCallback(
    (tabId: string) => {
      onNavigate?.(tabId);
      setSearchQuery("");
      setSearchFocused(false);
    },
    [onNavigate]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && searchResults.length > 0) {
        handleSelectResult(searchResults[0].id);
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        setSearchFocused(false);
        (e.target as HTMLInputElement).blur();
      }
    },
    [searchResults, handleSelectResult]
  );

  return (
    <header className="h-14 md:h-16 border-b border-border/30 flex items-center justify-between px-4 md:px-8 bg-background/60 backdrop-blur-xl z-10 shrink-0">
      <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
        <div className="w-8 md:hidden" />
        {publicMode && <PublicIndustrySelector />}
        {!publicMode && (
          <div className="relative hidden sm:block">

            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              placeholder="Search pages..."
              aria-label="Search pages and features"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={handleKeyDown}
              className="bg-secondary/50 border border-border/50 rounded-full py-2 pl-10 pr-4 text-sm w-48 md:w-64 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-foreground placeholder:text-muted-foreground"
            />
            {searchFocused && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border/50 rounded-lg shadow-xl overflow-hidden z-50">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onMouseDown={() => handleSelectResult(result.id)}
                    className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2"
                  >
                    <Search size={12} className="text-muted-foreground" />
                    {result.id === "CallHistory"
                      ? "Call Transcript"
                      : result.id === "ERP"
                        ? "Integrations"
                        : result.id === "LiveAccounts"
                          ? "Live Accounts (Admin)"
                          : result.id}
                  </button>
                ))}
              </div>
            )}
            {searchFocused && searchQuery.trim() && searchResults.length === 0 && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border/50 rounded-lg shadow-xl z-50 px-4 py-3 text-sm text-muted-foreground">
                No results found
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {publicMode ? (
          <>
            {brandLabel && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-xs font-bold uppercase tracking-widest text-primary">
                <span className="text-foreground">{brandLabel}</span>
                <span className="opacity-70">·</span>
                <span>Sandbox</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate("/contact")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-primary/70 text-primary-foreground text-xs sm:text-sm font-bold uppercase tracking-wider shadow-lg shadow-primary/30 hover:opacity-95 transition-all"
              aria-label="Sign up now — open contact form"
            >
              Sign Up Now!
            </button>
          </>
        ) : (
          <>
            {/* Mode pill (only when a live account is bound) */}
            {liveUnlocked && liveAccount && (
              <div
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/40 bg-primary/10 text-xs font-semibold text-primary max-w-[200px]"
                title={`Live customer: ${liveAccount.displayName}`}
              >
                <span className="uppercase tracking-wider opacity-80">Mode:</span>
                <span>{mode === "live" ? "Live" : "Prototype"}</span>
                {mode === "live" && (
                  <span className="truncate text-foreground/90 font-medium">– {liveAccount.displayName}</span>
                )}
              </div>
            )}

            {liveUnlocked && (
              <div className="hidden md:inline-flex items-center rounded-full border border-border/50 bg-secondary/40 p-0.5 text-[11px] font-bold uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setMode("prototype")}
                  className={`px-2.5 py-1 rounded-full transition-colors ${mode === "prototype" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  aria-pressed={mode === "prototype"}
                >
                  Prototype
                </button>
                <button
                  type="button"
                  onClick={() => setMode("live")}
                  className={`px-2.5 py-1 rounded-full transition-colors ${mode === "live" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  aria-pressed={mode === "live"}
                >
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => { void clearLive(); }}
                  className="px-2 py-1 rounded-full text-muted-foreground hover:text-destructive transition-colors"
                  title="Sign out of live account"
                  aria-label="Sign out of live account"
                >
                  ×
                </button>
              </div>
            )}

            <div className="relative">
              <Lock
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                size={13}
              />
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value); if (codeError) setCodeError(null); }}
                onKeyDown={handleCodeKey}
                onBlur={() => { if (codeInput.trim().length >= 5) void submitCode(); }}
                placeholder="Enter Access Code"
                aria-label="Enter access code to unlock live mode"
                disabled={submitting}
                className={`bg-secondary/50 border rounded-full h-8 pl-7 pr-7 text-xs font-light w-40 md:w-48 focus:outline-none transition-colors text-foreground placeholder:text-muted-foreground placeholder:font-light ${
                  codeError
                    ? "border-destructive/60 focus:border-destructive"
                    : codeSuccess
                      ? "border-accent/60"
                      : "border-border/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                }`}
              />
              {codeSuccess && (
                <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 text-accent" size={14} />
              )}
              {codeError && (
                <div
                  role="alert"
                  className="absolute right-0 top-full mt-1.5 w-64 z-50 px-3 py-2 rounded-md bg-destructive/15 border border-destructive/40 text-[11px] text-destructive flex items-start gap-1.5 shadow-lg"
                >
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  <span>{codeError}</span>
                </div>
              )}
            </div>

            {role === "admin" && (
              <button
                type="button"
                onClick={() => navigate("/admin/users")}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold uppercase tracking-widest transition-colors"
                aria-label="Open admin users panel"
              >
                <Shield size={12} />
                Admin
              </button>
            )}

            <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-muted-foreground">
              <span className="w-2.5 h-2.5 bg-accent rounded-full animate-status-pulse" />
              <span className="hidden sm:inline">Operational</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-phaos border border-primary/30" />
          </>
        )}
      </div>
    </header>
  );
}

function PublicIndustrySelector() {
  const { industry } = useSandboxIndustry();
  const { user } = useUser();
  const [sendOpen, setSendOpen] = useState(false);

  const email = user?.email ?? "";
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    null;

  return (
    <SandboxVoiceProvider>
      <div className="flex items-center gap-2 min-w-0">
        <VoiceCombobox />
        <IndustryCombobox />
      <button
        type="button"
        onClick={() => setSendOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full bg-[#f5c542] hover:bg-[#f5c542]/90 text-black text-xs sm:text-sm font-bold uppercase tracking-wider shadow-md shadow-[#f5c542]/30 transition-colors"
        aria-label={`Send ${industry.name} voice agent invite`}
        title={`Send the ${industry.name} agent to a prospect`}
      >
        <Send size={13} />
        Send
      </button>
      <SendIndustryDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        industry={industry}
        fromEmail={email || undefined}
        fromName={displayName}
      />
      </div>
    </SandboxVoiceProvider>
  );
}





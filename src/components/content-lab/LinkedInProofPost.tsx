import { useState } from "react";
import { Loader2, Send, CheckCircle2, XCircle, ExternalLink, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Phase = "idle" | "queued" | "publishing" | "published" | "failed";

interface ProofResult {
  ok: boolean;
  post_url?: string | null;
  post_id?: string | null;
  error?: string | null;
  stage?: string;
  attempts?: Array<{ attempt: number; status: number; ok: boolean; error: string | null; duration_ms: number }>;
  issues?: Array<{ code: string; message: string }>;
  slot?: { code: string; platform: string; category: string } | null;
  proof_mode?: boolean;
}

const DEFAULT_PROOF_TEXT =
  "✅ Phaosai Content Lab — live publish proof. If you can read this on LinkedIn, the end-to-end pipeline (auth → token → UGC API → write-back) is working. — sent " +
  new Date().toISOString().slice(0, 16).replace("T", " ") +
  " UTC";

export function LinkedInProofPost() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ProofResult | null>(null);
  const [text, setText] = useState(DEFAULT_PROOF_TEXT);

  async function runProof() {
    setResult(null);
    setPhase("queued");
    // Tiny artificial pause so the user actually sees "Queued → Publishing"
    await new Promise((r) => setTimeout(r, 400));
    setPhase("publishing");
    try {
      const { data, error } = await supabase.functions.invoke("linkedin-publish-now", {
        body: { text, proof_mode: true, visibility: "PUBLIC" },
      });

      // The Supabase client throws on non-2xx but still attaches the JSON body
      // on `error.context`. We unwrap it so the UI can show the exact failure
      // payload (stage, attempts, LinkedIn API body, etc.) rather than a generic
      // "Edge Function returned a non-2xx status code".
      let payload: ProofResult | null = (data ?? null) as ProofResult | null;
      if (error) {
        const ctx = (error as unknown as { context?: Response }).context;
        if (ctx && typeof ctx.text === "function") {
          try {
            const raw = await ctx.text();
            payload = JSON.parse(raw) as ProofResult;
          } catch {
            payload = { ok: false, error: error.message || "Function call failed" };
          }
        } else {
          payload = { ok: false, error: error.message || "Function call failed" };
        }
      }

      const finalPayload = payload ?? { ok: false, error: "No payload returned." };
      setResult(finalPayload);
      if (finalPayload.ok) {
        setPhase("published");
        toast.success("Posted to LinkedIn", {
          description: finalPayload.post_url ?? undefined,
        });
      } else {
        setPhase("failed");
        toast.error("LinkedIn publish failed", { description: finalPayload.error ?? "Unknown error" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setResult({ ok: false, error: message });
      setPhase("failed");
      toast.error("Proof post failed", { description: message });
    }
  }

  const isBusy = phase === "queued" || phase === "publishing";

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Linkedin className="text-primary" size={20} />
          LinkedIn Proof Post
        </CardTitle>
        <CardDescription>
          One-click end-to-end publish test. Sends a short post directly to your configured LinkedIn account
          (no queue row touched) and reports the resulting URL or the exact failure reason.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={3000}
          disabled={isBusy}
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="flex items-center gap-3">
          <Button onClick={runProof} disabled={isBusy} size="lg">
            {isBusy ? <Loader2 className="animate-spin" /> : <Send />}
            {phase === "published" ? "Send another proof post" : "Publish proof post to LinkedIn"}
          </Button>
          <span className="text-xs text-muted-foreground">{text.length}/3000</span>
        </div>

        {/* Live status indicator: Queued → Publishing → Published / Failed */}
        <PhaseTimeline phase={phase} />

        {result && (
          <div
            className={cn(
              "rounded-md border p-3 text-sm space-y-2",
              result.ok
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "border-destructive/50 bg-destructive/10 text-foreground",
            )}
          >
            {result.ok ? (
              <>
                <div className="flex items-center gap-2 font-medium text-primary">
                  <CheckCircle2 size={16} /> Published successfully
                  {result.stage && (
                    <span className="text-xs font-normal text-muted-foreground">· stage: {result.stage}</span>
                  )}
                </div>
                {result.post_url && (
                  <a
                    href={result.post_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-primary underline underline-offset-4 break-all"
                  >
                    {result.post_url}
                    <ExternalLink size={12} />
                  </a>
                )}
                {result.post_id && (
                  <div className="text-xs text-muted-foreground break-all">Post ID: {result.post_id}</div>
                )}
                {result.attempts && result.attempts.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Attempts: {result.attempts.length} ·{" "}
                    {result.attempts.map((a) => `${a.attempt}=${a.status}`).join(", ")}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 font-medium text-destructive">
                  <XCircle size={16} /> Failure ({result.stage ?? "unknown stage"})
                </div>
                <div className="text-xs whitespace-pre-wrap break-words">{result.error ?? "Unknown error"}</div>
                {result.issues && result.issues.length > 0 && (
                  <ul className="text-xs list-disc pl-5 space-y-0.5">
                    {result.issues.map((issue) => (
                      <li key={issue.code}>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          {issue.code}
                        </span>{" "}
                        — {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
                {result.slot && (
                  <div className="text-xs text-muted-foreground">
                    Slot: {result.slot.code} ({result.slot.platform}/{result.slot.category})
                  </div>
                )}
                {result.attempts && result.attempts.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Attempts: {result.attempts.length} ·{" "}
                    {result.attempts.map((a) => `${a.attempt}=${a.status}`).join(", ")}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PhaseTimeline({ phase }: { phase: Phase }) {
  const steps: { id: Phase; label: string }[] = [
    { id: "queued", label: "Queued" },
    { id: "publishing", label: "Publishing" },
    { id: phase === "failed" ? "failed" : "published", label: phase === "failed" ? "Failed" : "Published" },
  ];
  const order: Phase[] = ["idle", "queued", "publishing", phase === "failed" ? "failed" : "published"];
  const currentIndex = order.indexOf(phase);

  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((step, i) => {
        const reached = currentIndex >= i + 1;
        const isCurrent = currentIndex === i + 1;
        const isFailureStep = step.id === "failed";
        return (
          <div key={step.label} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 font-medium transition-colors",
                !reached && "border-border text-muted-foreground",
                reached && !isFailureStep && "border-primary/50 bg-primary/10 text-primary",
                reached && isFailureStep && "border-destructive/60 bg-destructive/10 text-destructive",
                isCurrent && "ring-2 ring-offset-1 ring-offset-background",
                isCurrent && !isFailureStep && "ring-primary/50",
                isCurrent && isFailureStep && "ring-destructive/60",
              )}
            >
              {isCurrent && phase === "publishing" ? <Loader2 size={10} className="animate-spin" /> : null}
              {step.label}
            </span>
            {i < steps.length - 1 && <span className="h-px w-4 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

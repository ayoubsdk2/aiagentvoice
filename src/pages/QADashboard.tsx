import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Play, CheckCircle2, XCircle, AlertTriangle, Dices, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/use-user";
import {
  ALL_QA_SPECS,
  TRAIT_ISOLATION_TESTS,
  BLENDED_TESTS,
  type QATestSpec,
} from "@/lib/content-lab/qa-specs";
import { generateStyledCopy, type RegenFieldType } from "@/lib/content-lab/generateStyledCopy";
import { surpriseMe } from "@/lib/content-lab/surpriseMe";
import { diversityScore, uniqueValuesPerTrait } from "@/lib/content-lab/diversity";
import { TRAIT_KEYS, TRAIT_LABELS, type TraitState } from "@/lib/content-lab/traits";

interface RunResult {
  status: "running" | "passed" | "failed" | "error";
  score?: number;
  rationale?: string;
  output?: string;
  error?: string;
  durationMs?: number;
}

// Map QA spec field types to actual edge function field types.
function toRegenFieldType(spec: QATestSpec): RegenFieldType {
  if (spec.fieldType === "blog_body" || spec.fieldType === "title") return "blog_markdown";
  if (spec.fieldType === "linkedin_hook") return "linkedin_hook";
  return "facebook_body";
}

async function runJudgedTest(spec: QATestSpec): Promise<RunResult> {
  const start = Date.now();
  try {
    const gen = await generateStyledCopy({
      fieldType: toRegenFieldType(spec),
      postId: null,
      postTitle: spec.postTitle,
      postCategory: spec.postCategory,
      originalText: spec.inputText,
      traits: spec.traits,
      channel: spec.channel,
    });
    const { data, error } = await supabase.functions.invoke("qa-judge-output", {
      body: {
        input_text: spec.inputText,
        output_text: gen.text,
        traits: spec.traits,
        expected: spec.expected,
      },
    });
    if (error) throw new Error(error.message);
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    const verdict = (data as { verdict?: string }).verdict;
    const score = (data as { overall_score?: number }).overall_score;
    const summary = (data as { summary?: string }).summary;
    return {
      status: verdict === "pass" ? "passed" : "failed",
      score,
      rationale: summary,
      output: gen.text,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
      durationMs: Date.now() - start,
    };
  }
}

function StatusBadge({ status }: { status?: RunResult["status"] }) {
  if (!status) return <Badge variant="outline">Idle</Badge>;
  if (status === "running")
    return <Badge variant="secondary" className="gap-1"><Loader2 size={10} className="animate-spin" /> Running</Badge>;
  if (status === "passed")
    return <Badge className="bg-primary text-primary-foreground gap-1"><CheckCircle2 size={10} /> Passed</Badge>;
  if (status === "failed")
    return <Badge variant="destructive" className="gap-1"><XCircle size={10} /> Failed</Badge>;
  return <Badge variant="destructive" className="gap-1"><AlertTriangle size={10} /> Error</Badge>;
}

function TestRow({ spec, result, onRun }: { spec: QATestSpec; result?: RunResult; onRun: () => void }) {
  return (
    <div className="rounded-md border border-border/60 bg-card/30 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{spec.label}</p>
          <p className="text-xs text-muted-foreground">{spec.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={result?.status} />
          {typeof result?.score === "number" && (
            <Badge variant="outline">Score {result.score.toFixed(1)}/5</Badge>
          )}
          <Button size="sm" onClick={onRun} disabled={result?.status === "running"} className="gap-1">
            {result?.status === "running" ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run
          </Button>
        </div>
      </div>
      {result?.rationale && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2">
          Judge: {result.rationale}
        </p>
      )}
      {result?.error && <p className="text-xs text-destructive">{result.error}</p>}
      {result?.output && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View output</summary>
          <pre className="whitespace-pre-wrap break-words mt-1 p-2 bg-muted/30 rounded max-h-48 overflow-y-auto">
            {result.output}
          </pre>
        </details>
      )}
    </div>
  );
}

export default function QADashboard() {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [runningAll, setRunningAll] = useState(false);

  // Surprise Me tab state
  const [surpriseRuns, setSurpriseRuns] = useState<TraitState[]>([]);
  const [surpriseChannel] = useState<"linkedin" | "facebook" | "blog">("linkedin");

  // 4-week tab state
  const [strategyJobId, setStrategyJobId] = useState<string | null>(null);
  const [strategyStatus, setStrategyStatus] = useState<string>("idle");
  const [strategyProgress, setStrategyProgress] = useState({ done: 0, total: 4 });
  const [failAtStep, setFailAtStep] = useState<number>(3);

  // Webhooks tab
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; status: number; latency_ms: number; error: string | null } | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);

  // LinkedIn tab
  const [linkedinText, setLinkedinText] = useState(
    "Phaos AI QA test post — verifying end-to-end pipeline. Safe to delete.",
  );
  const [linkedinDryRun, setLinkedinDryRun] = useState(true);
  const [linkedinResult, setLinkedinResult] = useState<{ ok: boolean; post_id?: string; post_url?: string | null; error?: string; attempts?: unknown[] } | null>(null);
  const [linkedinLoading, setLinkedinLoading] = useState(false);

  useEffect(() => {
    // Bypass the Supabase admin check when rendered inside the credential-gated /admin section.
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
      try {
        const t = sessionStorage.getItem("phaos_admin_session_v1");
        if (t) { setIsAdmin(true); return; }
      } catch { /* ignore */ }
    }
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "phaos_admin" });
      if (!cancelled) setIsAdmin(data === true);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);


  // Poll strategy job
  useEffect(() => {
    if (!strategyJobId) return;
    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from("strategy_jobs")
        .select("status, completed_steps, total_steps, error_message")
        .eq("id", strategyJobId)
        .maybeSingle();
      if (error || !data) return;
      setStrategyStatus(data.status + (data.error_message ? ` — ${data.error_message}` : ""));
      setStrategyProgress({ done: data.completed_steps, total: data.total_steps });
      if (data.status === "completed" || data.status === "failed") {
        clearInterval(interval);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [strategyJobId]);

  const stats = useMemo(() => {
    const all = Object.values(results);
    return {
      total: ALL_QA_SPECS.length,
      passed: all.filter((r) => r.status === "passed").length,
      failed: all.filter((r) => r.status === "failed" || r.status === "error").length,
    };
  }, [results]);

  if (userLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center space-y-2">
            <AlertTriangle className="mx-auto text-destructive" size={32} />
            <p className="font-semibold">Phaos admin access required</p>
            <Button onClick={() => navigate("/")} variant="outline">Back home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function runOne(spec: QATestSpec) {
    setResults((r) => ({ ...r, [spec.id]: { status: "running" } }));
    const res = await runJudgedTest(spec);
    setResults((r) => ({ ...r, [spec.id]: res }));
  }

  async function runAll(category?: QATestSpec["category"]) {
    const list = category ? ALL_QA_SPECS.filter((s) => s.category === category) : ALL_QA_SPECS;
    setRunningAll(true);
    for (const spec of list) {
      setResults((r) => ({ ...r, [spec.id]: { status: "running" } }));
      const res = await runJudgedTest(spec);
      setResults((r) => ({ ...r, [spec.id]: res }));
    }
    setRunningAll(false);
    toast.success("Run complete");
  }

  function rollSurprise() {
    const next = surpriseMe({ channel: surpriseChannel });
    setSurpriseRuns((s) => [...s, next].slice(-5));
  }

  async function startStrategyTest(opts: { withFail?: boolean }) {
    setStrategyStatus("starting");
    const body: Record<string, unknown> = { start_date: new Date().toISOString().slice(0, 10) };
    if (opts.withFail) body.fail_at_step = failAtStep;
    const { data, error } = await supabase.functions.invoke("strategy-job-start", { body });
    if (error || (data as { error?: string })?.error) {
      toast.error((error?.message || (data as { error?: string })?.error) ?? "Failed");
      setStrategyStatus("failed");
      return;
    }
    setStrategyJobId((data as { jobId: string }).jobId);
    setStrategyStatus("queued");
  }

  async function pingWebhook() {
    if (!webhookUrl) return;
    setWebhookLoading(true);
    setWebhookResult(null);
    const { data, error } = await supabase.functions.invoke("qa-webhook-ping", { body: { url: webhookUrl } });
    setWebhookLoading(false);
    if (error) {
      setWebhookResult({ ok: false, status: 0, latency_ms: 0, error: error.message });
      return;
    }
    setWebhookResult(data as { ok: boolean; status: number; latency_ms: number; error: string | null });
  }

  async function postToLinkedIn() {
    setLinkedinLoading(true);
    setLinkedinResult(null);
    const { data, error } = await supabase.functions.invoke("linkedin-post", {
      body: { text: linkedinText, dry_run: linkedinDryRun },
    });
    setLinkedinLoading(false);
    if (error) {
      setLinkedinResult({ ok: false, error: error.message });
      return;
    }
    setLinkedinResult(data as { ok: boolean; post_id?: string; post_url?: string | null; error?: string; attempts?: unknown[] });
    if ((data as { ok?: boolean })?.ok) toast.success("LinkedIn post succeeded");
    else toast.error("LinkedIn post failed — see details");
  }

  const surpriseDiversity = diversityScore(surpriseRuns);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/30 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1">
              <ArrowLeft size={14} /> Home
            </Button>
            <div>
              <h1 className="font-semibold">Content Lab QA Dashboard</h1>
              <p className="text-xs text-muted-foreground">End-to-end test runner with LLM-as-judge scoring</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">{stats.passed} passed</Badge>
            <Badge variant={stats.failed > 0 ? "destructive" : "outline"}>{stats.failed} failed</Badge>
            <Badge variant="outline">{stats.total} total</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="trait_isolation">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="trait_isolation">Trait Isolation</TabsTrigger>
            <TabsTrigger value="blended">Blended</TabsTrigger>
            <TabsTrigger value="surprise_me">Surprise Me</TabsTrigger>
            <TabsTrigger value="four_week">4-Week Strategy</TabsTrigger>
            <TabsTrigger value="webhooks_linkedin">Webhooks &amp; LinkedIn</TabsTrigger>
          </TabsList>

          <TabsContent value="trait_isolation" className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">7 tests, one per trait. Judge looks for that trait's signature.</p>
              <Button size="sm" onClick={() => runAll("trait_isolation")} disabled={runningAll} className="gap-1">
                {runningAll ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Run all
              </Button>
            </div>
            {TRAIT_ISOLATION_TESTS.map((spec) => (
              <TestRow key={spec.id} spec={spec} result={results[spec.id]} onRun={() => runOne(spec)} />
            ))}
          </TabsContent>

          <TabsContent value="blended" className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Multi-trait combinations. Judge checks for blended signature.</p>
              <Button size="sm" onClick={() => runAll("blended")} disabled={runningAll} className="gap-1">
                {runningAll ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Run all
              </Button>
            </div>
            {BLENDED_TESTS.map((spec) => (
              <TestRow key={spec.id} spec={spec} result={results[spec.id]} onRun={() => runOne(spec)} />
            ))}
          </TabsContent>

          <TabsContent value="surprise_me" className="space-y-3 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Surprise Me Diversity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={rollSurprise} className="gap-1">
                    <Dices size={12} /> Roll combo ({surpriseRuns.length}/5)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSurpriseRuns([])}>
                    Reset
                  </Button>
                  {surpriseRuns.length >= 2 && (
                    <Badge variant={surpriseDiversity > 0.6 ? "default" : "destructive"}>
                      Diversity: {(surpriseDiversity * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
                {surpriseRuns.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs grid grid-cols-8 gap-1 font-semibold text-muted-foreground">
                      <span>#</span>
                      {TRAIT_KEYS.map((k) => <span key={k}>{TRAIT_LABELS[k]}</span>)}
                    </div>
                    {surpriseRuns.map((combo, i) => (
                      <div key={i} className="text-xs grid grid-cols-8 gap-1 p-1 border-b border-border/30">
                        <span className="font-mono">{i + 1}</span>
                        {TRAIT_KEYS.map((k) => (
                          <span key={k} className="truncate" title={combo[k]}>
                            {combo[k].split(" ")[0]}
                          </span>
                        ))}
                      </div>
                    ))}
                    {surpriseRuns.length >= 2 && (
                      <p className="text-xs text-muted-foreground">
                        Unique values per trait: {Object.entries(uniqueValuesPerTrait(surpriseRuns)).map(([k, v]) => `${k}=${v}`).join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="four_week" className="space-y-3 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">4-Week Strategy Resilience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" onClick={() => startStrategyTest({})} disabled={strategyStatus === "queued" || strategyStatus === "in_progress"}>
                    Start happy-path job
                  </Button>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs">Fail at week:</Label>
                    <Input
                      type="number"
                      min={1}
                      max={4}
                      value={failAtStep}
                      onChange={(e) => setFailAtStep(Number(e.target.value))}
                      className="w-16 h-8"
                    />
                    <Button size="sm" variant="destructive" onClick={() => startStrategyTest({ withFail: true })}>
                      Start failure-injection job
                    </Button>
                  </div>
                </div>
                {strategyJobId && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono">{strategyJobId.slice(0, 8)}…</span>
                      <Badge>{strategyStatus}</Badge>
                    </div>
                    <Progress value={(strategyProgress.done / strategyProgress.total) * 100} />
                    <p className="text-xs text-muted-foreground">
                      {strategyProgress.done} of {strategyProgress.total} weeks complete
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks_linkedin" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Webhook smoke ping</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label className="text-xs">Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.example.com/..."
                  />
                  <Button onClick={pingWebhook} disabled={webhookLoading || !webhookUrl}>
                    {webhookLoading ? <Loader2 className="animate-spin" size={14} /> : "Ping"}
                  </Button>
                </div>
                {webhookResult && (
                  <p className="text-xs">
                    <Badge variant={webhookResult.ok ? "default" : "destructive"}>
                      HTTP {webhookResult.status} · {webhookResult.latency_ms}ms
                    </Badge>
                    {webhookResult.error && <span className="ml-2 text-destructive">{webhookResult.error}</span>}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Send size={14} /> LinkedIn live post
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={linkedinText}
                  onChange={(e) => setLinkedinText(e.target.value)}
                  rows={4}
                  maxLength={3000}
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={linkedinDryRun}
                      onChange={(e) => setLinkedinDryRun(e.target.checked)}
                    />
                    Dry-run (no live post)
                  </label>
                  <Button onClick={postToLinkedIn} disabled={linkedinLoading || !linkedinText.trim()}>
                    {linkedinLoading ? <Loader2 className="animate-spin" size={14} /> : (linkedinDryRun ? "Test (dry-run)" : "Post live to LinkedIn")}
                  </Button>
                </div>
                {linkedinResult && (
                  <div className="text-xs space-y-1">
                    <Badge variant={linkedinResult.ok ? "default" : "destructive"}>
                      {linkedinResult.ok ? "Success" : "Failed"}
                    </Badge>
                    {linkedinResult.post_url && (
                      <p>
                        <a href={linkedinResult.post_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          View post on LinkedIn →
                        </a>
                      </p>
                    )}
                    {linkedinResult.error && <p className="text-destructive">{linkedinResult.error}</p>}
                    {linkedinResult.attempts && (
                      <details>
                        <summary className="cursor-pointer">Attempt log ({linkedinResult.attempts.length})</summary>
                        <pre className="mt-1 p-2 bg-muted/30 rounded">{JSON.stringify(linkedinResult.attempts, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                )}
                {!linkedinDryRun && (
                  <p className="text-xs text-muted-foreground">
                    Requires only <code>LINKEDIN_ACCESS_TOKEN</code>. The Person URN is auto-resolved from the token via LinkedIn's <code>/v2/userinfo</code> endpoint — no manual ID lookup needed.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

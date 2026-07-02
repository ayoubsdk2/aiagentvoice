import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type JobRow = {
  id: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  total_steps: number;
  completed_steps: number;
  current_step: string | null;
  error_message: string | null;
  result_post_ids: string[] | null;
};

interface Props {
  jobId: string | null;
  onCompleted: () => void;
  /** Allow user to dismiss the bar after completion or failure. */
  onDismiss: () => void;
}

/**
 * Inline (non-modal) live status bar for the 4-week strategy job.
 * Renders directly underneath the "Generate 4-Week Strategy" button.
 */
export function StrategyProgressInline({ jobId, onCompleted, onDismiss }: Props) {
  const [job, setJob] = useState<JobRow | null>(null);
  const [retrying, setRetrying] = useState(false);
  const completedFiredRef = useRef(false);

  useEffect(() => {
    completedFiredRef.current = false;
    setJob(null);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    async function fetchOnce() {
      const { data, error } = await supabase
        .from("strategy_jobs")
        .select("id, status, total_steps, completed_steps, current_step, error_message, result_post_ids")
        .eq("id", jobId!)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("strategy_jobs fetch error", error);
        return;
      }
      if (data) setJob(data as JobRow);
    }

    fetchOnce();

    const channel = supabase
      .channel(`strategy-job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "strategy_jobs", filter: `id=eq.${jobId}` },
        (payload) => {
          if (cancelled) return;
          setJob(payload.new as JobRow);
        },
      )
      .subscribe();

    const interval = window.setInterval(fetchOnce, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  useEffect(() => {
    if (!job) return;
    if (job.status === "completed" && !completedFiredRef.current) {
      completedFiredRef.current = true;
      onCompleted();
    }
  }, [job, onCompleted]);

  async function handleRetry() {
    if (!jobId) return;
    setRetrying(true);
    try {
      const { error } = await supabase.functions.invoke("strategy-job-start", {
        body: { resume_job_id: jobId },
      });
      if (error) throw error;
      toast.success("Resuming from last successful step…");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Retry failed";
      toast.error(msg);
    } finally {
      setRetrying(false);
    }
  }

  if (!jobId) return null;

  const completed = job?.completed_steps ?? 0;
  const total = job?.total_steps ?? 4;
  const pct = Math.round((completed / total) * 100);
  const status = job?.status ?? "queued";
  const nextWeek = Math.min(completed + 1, total);

  const headline =
    status === "completed"
      ? "4-Week Strategy Generated"
      : status === "failed"
      ? "Generation Failed"
      : status === "queued"
      ? "Starting…"
      : `Drafting Week ${nextWeek} of ${total}…`;

  const isTerminal = status === "completed" || status === "failed";

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-3 rounded-lg border border-border bg-muted/40 p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {status === "completed" ? (
            <CheckCircle2 className="text-primary" size={16} />
          ) : status === "failed" ? (
            <AlertTriangle className="text-destructive" size={16} />
          ) : (
            <Loader2 className="animate-spin text-primary" size={16} />
          )}
          {headline}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {completed} / {total} weeks
          </span>
          <span>·</span>
          <span>{pct}%</span>
          {isTerminal && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-7 px-2 text-xs gap-1"
              aria-label="Dismiss status"
            >
              <X size={12} />
              Dismiss
            </Button>
          )}
        </div>
      </div>

      <Progress value={pct} className="mt-2 h-1.5" />

      {status === "failed" && (
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive flex-1">
            {job?.error_message ?? "Unknown error"}
          </div>
          <Button
            onClick={handleRetry}
            disabled={retrying}
            size="sm"
            className="gap-1 shrink-0"
          >
            {retrying ? <Loader2 className="animate-spin" size={12} /> : <RotateCcw size={12} />}
            Retry
          </Button>
        </div>
      )}

      {status === "completed" && (
        <p className="mt-1 text-xs text-muted-foreground">
          Inserted {job?.result_post_ids?.length ?? 0} posts into your queue.
        </p>
      )}
    </div>
  );
}

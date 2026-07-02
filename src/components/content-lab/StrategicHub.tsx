import { useEffect, useMemo, useState, useCallback } from "react";
import { addDays, addMonths, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths, differenceInCalendarDays } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, Loader2, Sparkles, AlertTriangle, Save, Trash2, Cross, Plus, CheckSquare, X, ExternalLink, Send, RefreshCw, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { supabase } from "@/integrations/supabase/client";
import { AIControlStrip } from "@/components/content-lab/AIControlStrip";
import { StrategyProgressInline } from "@/components/content-lab/StrategyProgressInline";
import { LinkedInProofPost } from "@/components/content-lab/LinkedInProofPost";
import {
  getDeliveryLink,
  getSlotSummary,
  getStatusClasses,
  getStatusLabel,
  getStatusTone,
  validateRowForPublish,
  type QueuePresentationRow,
  type SlotValidationIssue,
} from "@/lib/content-lab/scheduler";

type QueueRow = QueuePresentationRow;

const FAITH_GAP_THRESHOLD_DAYS = 7;

export function StrategicHub() {
  const [posts, setPosts] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishPhase, setPublishPhase] = useState<"idle" | "queued" | "publishing" | "published" | "failed">("idle");
  const [publishLastResult, setPublishLastResult] = useState<{ ok: boolean; url?: string | null; error?: string | null; rowId?: string | null } | null>(null);
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [editing, setEditing] = useState<QueueRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [overrideFaithGap, setOverrideFaithGap] = useState(false);
  /**
   * When the user right-clicks an empty calendar day to create a new post,
   * we set this flag so the save handler skips the 1-post-per-day guard
   * (the user explicitly requested an override path via right-click).
   */
  const [bypassDailyLimit, setBypassDailyLimit] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // ---- Bulk delete mode ----
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  function enterBulkMode(seedId?: string) {
    setBulkMode(true);
    setSelectedIds(seedId ? new Set([seedId]) : new Set());
  }
  function exitBulkMode() {
    setBulkMode(false);
    setSelectedIds(new Set());
  }
  function toggleSelected(id: string) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (!window.confirm(`Delete ${ids.length} post${ids.length === 1 ? "" : "s"} from the queue?`)) return;
    setBulkDeleting(true);
    const prev = posts;
    setPosts((cur) => cur.filter((p) => !selectedIds.has(p.id)));
    const { error } = await supabase.from("content_queue").delete().in("id", ids);
    setBulkDeleting(false);
    if (error) {
      setPosts(prev);
      toast.error("Bulk delete failed", { description: error.message });
      return;
    }
    toast.success(`Deleted ${ids.length} post${ids.length === 1 ? "" : "s"}`);
    exitBulkMode();
  }

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_queue")
      .select("id, title, scheduled_at, category, status, blog_body, linkedin_hook, facebook_body, image_url, last_attempt_at, last_error, published_at, platform_targets, seo_metadata")
      .order("scheduled_at", { ascending: true });
    if (error) {
      toast.error("Failed to load queue", { description: error.message });
    } else {
      setPosts((data ?? []) as QueueRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ---- Faith-gap analysis ----
  const faithGapWarnings = useMemo(() => {
    const faith = posts
      .filter((p) => p.category === "faith" && p.scheduled_at)
      .map((p) => ({ id: p.id, date: new Date(p.scheduled_at!) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const flags = new Set<string>();
    for (let i = 1; i < faith.length; i++) {
      const gap = differenceInCalendarDays(faith[i].date, faith[i - 1].date);
      if (gap > FAITH_GAP_THRESHOLD_DAYS) {
        flags.add(faith[i].id);
        flags.add(faith[i - 1].id);
      }
    }
    return flags;
  }, [posts]);

  const longestFaithGap = useMemo(() => {
    const faith = posts
      .filter((p) => p.category === "faith" && p.scheduled_at)
      .map((p) => new Date(p.scheduled_at!))
      .sort((a, b) => a.getTime() - b.getTime());
    let max = 0;
    for (let i = 1; i < faith.length; i++) {
      max = Math.max(max, differenceInCalendarDays(faith[i], faith[i - 1]));
    }
    return max;
  }, [posts]);

  // ---- Calendar grid ----
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)),
    );
  }, [cursor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, QueueRow[]>();
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const key = format(new Date(p.scheduled_at), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [posts]);

  // ---- Bulk generate (async job) ----
  async function handleBulkGenerate() {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("strategy-job-start", {
        body: { start_date: startOfMonth(cursor).toISOString() },
      });
      if (error) throw error;
      const jobId = (data as { jobId?: string })?.jobId;
      if (!jobId) throw new Error("No jobId returned");
      setActiveJobId(jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      toast.error("Bulk generate failed", { description: message });
    } finally {
      setGenerating(false);
    }
  }

  const handleJobCompleted = useCallback(() => {
    fetchPosts();
    toast.success("4-week strategy ready", {
      description: "All weeks drafted and saved to your queue.",
    });
  }, [fetchPosts]);

  // ---- Helpers ----
  /** Return scheduled posts (excluding the given id) on the same calendar day. */
  function postsOnSameDay(day: Date, excludeId?: string) {
    return posts.filter(
      (p) =>
        p.id !== excludeId &&
        p.scheduled_at &&
        isSameDay(new Date(p.scheduled_at), day),
    );
  }

  // ---- Drag & drop ----
  function onDragStart(id: string) {
    setDraggedId(id);
  }
  async function onDropOnDay(day: Date) {
    if (!draggedId) return;
    const dragged = posts.find((p) => p.id === draggedId);
    setDraggedId(null);
    if (!dragged) return;

    // Preserve original time-of-day if possible
    const existing = dragged.scheduled_at ? new Date(dragged.scheduled_at) : null;
    const next = new Date(day);
    next.setHours(existing?.getHours() ?? 10, existing?.getMinutes() ?? 0, 0, 0);

    // 1-post-per-day guard (drag-drop never bypasses; user must use right-click create)
    if (postsOnSameDay(next, dragged.id).length > 0) {
      toast.warning("That day already has a post", {
        description: "Only one post per day. Right-click an empty day to add another manually.",
      });
      return;
    }

    // Faith-gap pre-check
    if (dragged.category === "faith") {
      const otherFaith = posts
        .filter((p) => p.id !== dragged.id && p.category === "faith" && p.scheduled_at)
        .map((p) => new Date(p.scheduled_at!));
      const tooClose = otherFaith.some(
        (d) => Math.abs(differenceInCalendarDays(next, d)) < 5,
      );
      if (tooClose) {
        const ok = window.confirm(
          "This faith post would be within 5 days of another faith post. Override and reschedule anyway?",
        );
        if (!ok) return;
      }
    }

    const prev = posts;
    setPosts((cur) =>
      cur.map((p) => (p.id === dragged.id ? { ...p, scheduled_at: next.toISOString() } : p)),
    );
    const { error } = await supabase
      .from("content_queue")
      .update({ scheduled_at: next.toISOString() })
      .eq("id", dragged.id);
    if (error) {
      setPosts(prev);
      toast.error("Reschedule failed", { description: error.message });
    } else {
      toast.success(`Moved to ${format(next, "MMM d")}`);
    }
  }

  // ---- Edit dialog ----
  function openEdit(p: QueueRow) {
    setEditing({ ...p });
    setOverrideFaithGap(false);
    setBypassDailyLimit(false);
  }

  /**
   * Open the edit dialog with a fresh, unsaved post pre-scheduled for `day`.
   * Triggered by right-clicking an empty calendar day. Sets `bypassDailyLimit`
   * so the save handler skips the 1-post-per-day guard.
   */
  function openCreateForDay(day: Date) {
    const at = new Date(day);
    at.setHours(10, 0, 0, 0);
    setEditing({
      id: "", // sentinel for "new"
      title: "Untitled post",
      scheduled_at: at.toISOString(),
      category: "industry",
      status: "draft",
      blog_body: "",
      linkedin_hook: "",
      facebook_body: "",
    });
    setOverrideFaithGap(false);
    setBypassDailyLimit(true);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);

    // 1-post-per-day guard — skipped only when the dialog was opened via
    // right-click "Add post here" (bypassDailyLimit is true).
    if (editing.scheduled_at && !bypassDailyLimit) {
      const day = new Date(editing.scheduled_at);
      if (postsOnSameDay(day, editing.id || undefined).length > 0) {
        toast.warning("That day already has a post", {
          description: "Pick another date, or right-click an empty day to override.",
        });
        setSaving(false);
        return;
      }
    }

    // Faith-gap guard for the saved date/category
    if (editing.category === "faith" && editing.scheduled_at && !overrideFaithGap) {
      const proposed = new Date(editing.scheduled_at);
      const others = posts
        .filter((p) => p.id !== editing.id && p.category === "faith" && p.scheduled_at)
        .map((p) => new Date(p.scheduled_at!));
      const tooClose = others.some((d) => Math.abs(differenceInCalendarDays(proposed, d)) < 5);
      if (tooClose) {
        toast.warning("Faith posts must be ≥5 days apart", {
          description: "Toggle 'Override faith-gap rule' to save anyway.",
        });
        setSaving(false);
        return;
      }
    }

    const isNew = !editing.id;
    const payload = {
      title: editing.title,
      scheduled_at: editing.scheduled_at,
      category: editing.category,
      status: editing.status,
      blog_body: editing.blog_body,
      linkedin_hook: editing.linkedin_hook,
      facebook_body: editing.facebook_body,
    };

    const { error } = isNew
      ? await supabase.from("content_queue").insert(payload)
      : await supabase.from("content_queue").update(payload).eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    toast.success(isNew ? "Post created" : "Post updated");
    setEditing(null);
    await fetchPosts();
  }

  async function handleDelete() {
    if (!editing || !editing.id) {
      // Unsaved new post — just close.
      setEditing(null);
      return;
    }
    if (!window.confirm("Delete this post from the queue?")) return;
    const { error } = await supabase.from("content_queue").delete().eq("id", editing.id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    toast.success("Deleted");
    setEditing(null);
    await fetchPosts();
  }

  /** Right-click → delete a post directly from the calendar without opening the editor. */
  async function handleQuickDelete(postId: string) {
    if (!window.confirm("Delete this post from the queue?")) return;
    const prev = posts;
    setPosts((cur) => cur.filter((p) => p.id !== postId));
    const { error } = await supabase.from("content_queue").delete().eq("id", postId);
    if (error) {
      setPosts(prev);
      toast.error("Delete failed", { description: error.message });
      return;
    }
    toast.success("Deleted");
  }

  /**
   * Publish (or RETRY publishing) the LinkedIn copy of a single queue row right now.
   * Used by the "Publish Now" and "Retry" buttons. Drives the live status
   * indicator (Queued → Publishing → Published/Failed) under the calendar header.
   */
  async function publishRowToLinkedIn(postId: string) {
    setPublishingId(postId);
    setPublishPhase("queued");
    setPublishLastResult(null);
    await new Promise((r) => setTimeout(r, 300));
    setPublishPhase("publishing");
    try {
      const { data, error } = await supabase.functions.invoke("linkedin-publish-now", {
        body: { queue_row_id: postId, visibility: "PUBLIC" },
      });
      if (error) {
        setPublishPhase("failed");
        setPublishLastResult({ ok: false, error: error.message, rowId: postId });
        toast.error("Publish failed", { description: error.message });
        await fetchPosts();
        return;
      }
      const payload = (data ?? {}) as { ok: boolean; post_url?: string; error?: string };
      if (payload.ok) {
        setPublishPhase("published");
        setPublishLastResult({ ok: true, url: payload.post_url ?? null, rowId: postId });
        toast.success("Posted to LinkedIn", { description: payload.post_url ?? undefined });
      } else {
        setPublishPhase("failed");
        setPublishLastResult({ ok: false, error: payload.error ?? "Unknown error", rowId: postId });
        toast.error("LinkedIn rejected the post", { description: payload.error ?? "Unknown error" });
      }
      await fetchPosts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setPublishPhase("failed");
      setPublishLastResult({ ok: false, error: message, rowId: postId });
      toast.error("Publish failed", { description: message });
    } finally {
      setPublishingId(null);
    }
  }

  /** Slot-validation issues for the post currently being edited. */
  const editingValidation: SlotValidationIssue[] = useMemo(() => {
    if (!editing || !editing.scheduled_at) return [];
    return validateRowForPublish(editing, posts);
  }, [editing, posts]);

  const linkedinLen = editing?.linkedin_hook?.length ?? 0;
  const linkedinOver = linkedinLen > 180;

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6">
      <LinkedInProofPost />
      {/* Top action bar */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-primary" size={20} />
              Bulk Generate
            </CardTitle>
            <CardDescription>
              Generate a 4-week strategy: 8–12 posts, 2–3 per week, with one Faith pillar per week.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-0 min-w-[280px]">
            <Button onClick={handleBulkGenerate} disabled={generating} size="lg">
              {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Generate 4-Week Strategy
            </Button>
            <div className="w-full">
              <StrategyProgressInline
                jobId={activeJobId}
                onCompleted={handleJobCompleted}
                onDismiss={() => setActiveJobId(null)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="outline" className="gap-1 border-border bg-muted text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> Generated
            </Badge>
            <Badge variant="outline" className="gap-1 border-primary/50 bg-primary/15 text-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" /> Scheduled
            </Badge>
            <Badge variant="outline" className="gap-1 border-primary/60 bg-primary/25 text-foreground">
              <CheckCircle2 size={12} className="text-primary" /> Published
            </Badge>
            <Badge variant="outline" className="gap-1 border-destructive/60 bg-destructive/15 text-destructive">
              <AlertTriangle size={12} /> Failed
            </Badge>
            <span className="text-muted-foreground">
              {posts.length} post{posts.length === 1 ? "" : "s"} in queue
            </span>
            {longestFaithGap > FAITH_GAP_THRESHOLD_DAYS && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle size={12} />
                Faith gap {longestFaithGap}d &gt; {FAITH_GAP_THRESHOLD_DAYS}d
              </Badge>
            )}
          </div>

          {publishPhase !== "idle" && (
            <div
              className={cn(
                "mt-4 rounded-md border p-3 text-sm flex flex-wrap items-center gap-3",
                publishPhase === "published" && "border-primary/50 bg-primary/10",
                publishPhase === "failed" && "border-destructive/60 bg-destructive/10",
                (publishPhase === "queued" || publishPhase === "publishing") && "border-border bg-muted/40",
              )}
            >
              <span className="font-medium">LinkedIn publish:</span>
              <PhasePill label="Queued" state={publishPhase === "queued" ? "current" : "done"} />
              <PhasePill
                label="Publishing"
                state={
                  publishPhase === "publishing"
                    ? "current"
                    : publishPhase === "queued"
                    ? "pending"
                    : "done"
                }
                spinning={publishPhase === "publishing"}
              />
              <PhasePill
                label={publishPhase === "failed" ? "Failed" : "Published"}
                state={publishPhase === "published" || publishPhase === "failed" ? "current" : "pending"}
                tone={publishPhase === "failed" ? "destructive" : "primary"}
              />
              {publishLastResult?.ok && publishLastResult.url && (
                <a
                  href={publishLastResult.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-primary underline underline-offset-4 break-all"
                >
                  View on LinkedIn <ExternalLink size={12} />
                </a>
              )}
              {publishLastResult && !publishLastResult.ok && (
                <span className="text-destructive text-xs break-all">{publishLastResult.error}</span>
              )}
              {publishLastResult && !publishLastResult.ok && publishLastResult.rowId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => publishRowToLinkedIn(publishLastResult.rowId!)}
                  disabled={publishingId !== null}
                >
                  <RefreshCw size={12} /> Retry
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => {
                  setPublishPhase("idle");
                  setPublishLastResult(null);
                }}
              >
                <X size={12} /> Dismiss
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-muted-foreground" size={18} />
            <CardTitle className="text-lg">{format(cursor, "MMMM yyyy")}</CardTitle>
            {bulkMode && (
              <Badge variant="destructive" className="ml-2 gap-1">
                <CheckSquare size={12} />
                Bulk delete · {selectedIds.size} selected
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {bulkMode ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0 || bulkDeleting}
                >
                  {bulkDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                </Button>
                <Button variant="outline" size="sm" onClick={exitBulkMode} disabled={bulkDeleting}>
                  <X /> Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="icon" onClick={() => setCursor((c) => subMonths(c, 1))}>
                  <ChevronLeft />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, 1))}>
                  <ChevronRight />
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="animate-spin mr-2" /> Loading queue…
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-7 bg-muted/40 text-xs font-medium text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="p-2 text-center">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {weeks.flat().map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayPosts = postsByDay.get(key) ?? [];
                  const dim = !isSameMonth(day, cursor);
                  const today = isSameDay(day, new Date());
                  const isEmpty = dayPosts.length === 0;
                  return (
                    <ContextMenu key={key}>
                      <ContextMenuTrigger asChild>
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                          }}
                          onDrop={() => onDropOnDay(day)}
                          className={cn(
                            "min-h-[110px] border-t border-l border-border p-1.5 align-top",
                            "last:border-r [&:nth-child(7n)]:border-r",
                            dim && "bg-muted/20 text-muted-foreground/60",
                            today && "bg-primary/5",
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className={cn("font-medium", today && "text-primary")}>
                              {format(day, "d")}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {dayPosts.map((p) => {
                              const isFaith = p.category === "faith";
                              const flagged = faithGapWarnings.has(p.id);
                              const tone = getStatusTone(p);
                              const toneClasses = getStatusClasses(tone);
                              const deliveryUrl = getDeliveryLink(p);
                              return (
                                <ContextMenu key={p.id}>
                                  <ContextMenuTrigger asChild>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          draggable={!bulkMode}
                                          onDragStart={() => !bulkMode && onDragStart(p.id)}
                                          onClick={(e) => {
                                            if (bulkMode) {
                                              e.stopPropagation();
                                              toggleSelected(p.id);
                                            } else {
                                              openEdit(p);
                                            }
                                          }}
                                          className={cn(
                                            "group w-full text-left rounded-md border px-1.5 py-1 text-[11px] leading-tight transition-colors",
                                            bulkMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
                                            toneClasses,
                                            flagged && "ring-1 ring-destructive/60",
                                            bulkMode && selectedIds.has(p.id) &&
                                              "ring-2 ring-destructive bg-destructive/20 border-destructive/60",
                                          )}
                                        >
                                          <div className="flex items-center gap-1">
                                            {bulkMode && (
                                              <span
                                                className={cn(
                                                  "inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border",
                                                  selectedIds.has(p.id)
                                                    ? "bg-destructive border-destructive text-destructive-foreground"
                                                    : "border-muted-foreground/40",
                                                )}
                                              >
                                                {selectedIds.has(p.id) && <CheckSquare size={8} />}
                                              </span>
                                            )}
                                            {isFaith && <Cross size={10} className="shrink-0" />}
                                            {tone === "published" && <CheckCircle2 size={10} className="shrink-0 text-primary" />}
                                            {tone === "failed" && <AlertTriangle size={10} className="shrink-0 text-destructive" />}
                                            <span className="truncate">{p.title}</span>
                                          </div>
                                          <div className="mt-0.5 flex items-center gap-1 text-[10px] opacity-80">
                                            <span>{getStatusLabel(p)}</span>
                                            {flagged && (
                                              <span className="flex items-center gap-0.5 text-destructive/80">
                                                · <AlertTriangle size={8} /> gap &gt;{FAITH_GAP_THRESHOLD_DAYS}d
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs space-y-1 text-xs">
                                        <div className="font-semibold">{p.title}</div>
                                        <div>Status: <span className="font-medium">{getStatusLabel(p)}</span></div>
                                        <div>Scheduled: {p.scheduled_at ? format(new Date(p.scheduled_at), "PPpp") : "—"}</div>
                                        <div>Published: {p.published_at ? format(new Date(p.published_at), "PPpp") : "—"}</div>
                                        {p.last_attempt_at && <div>Last attempt: {format(new Date(p.last_attempt_at), "PPpp")}</div>}
                                        {p.last_error && <div className="text-destructive">Error: {p.last_error}</div>}
                                        {deliveryUrl && <div className="text-primary break-all">URL: {deliveryUrl}</div>}
                                      </TooltipContent>
                                    </Tooltip>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent>
                                    <ContextMenuItem onSelect={() => openEdit(p)} disabled={bulkMode}>
                                      Edit post
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      onSelect={() => publishRowToLinkedIn(p.id)}
                                      disabled={bulkMode || publishingId !== null || !p.linkedin_hook}
                                    >
                                      <Send size={14} className="mr-2" />
                                      {tone === "failed" ? "Retry LinkedIn publish" : "Publish to LinkedIn now"}
                                    </ContextMenuItem>
                                    {deliveryUrl && (
                                      <ContextMenuItem onSelect={() => window.open(deliveryUrl, "_blank", "noopener,noreferrer")}>
                                        <ExternalLink size={14} className="mr-2" />
                                        Open published post
                                      </ContextMenuItem>
                                    )}
                                    <ContextMenuItem
                                      onSelect={() => handleQuickDelete(p.id)}
                                      disabled={bulkMode}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 size={14} className="mr-2" />
                                      Delete post
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      onSelect={() => enterBulkMode(p.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <CheckSquare size={14} className="mr-2" />
                                      Bulk delete…
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              );
                            })}
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onSelect={() => openCreateForDay(day)}>
                          <Plus size={14} className="mr-2" />
                          {isEmpty
                            ? `Add post on ${format(day, "MMM d")}`
                            : `Add another post on ${format(day, "MMM d")} (override)`}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit / Create dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
            <DialogTitle className="text-xl">
              {editing && !editing.id ? "New post" : "Edit post"}
            </DialogTitle>
            <DialogDescription>
              {editing && !editing.id
                ? "Create a manual post for this day. Category applies to all three channels."
                : "Refine the content, schedule, or status. Drag posts on the calendar to reschedule."}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="px-6 py-5 space-y-6">
              {/* Post-level fields — Title + meta row */}
              <section className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Title</Label>
                  <Input
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    className="text-base"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Category</Label>
                    <Select
                      value={editing.category}
                      onValueChange={(v) => setEditing({ ...editing, category: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="industry">Industry</SelectItem>
                        <SelectItem value="faith">Faith</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Applies to LinkedIn, Facebook & Blog.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
                    <Select
                      value={editing.status}
                      onValueChange={(v) => setEditing({ ...editing, status: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Scheduled at</Label>
                    <Input
                      type="datetime-local"
                      value={
                        editing.scheduled_at
                          ? format(new Date(editing.scheduled_at), "yyyy-MM-dd'T'HH:mm")
                          : ""
                      }
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                    />
                  </div>
                </div>
              </section>

              {/* LinkedIn channel section */}
              <section className="space-y-2 rounded-lg border border-border/60 bg-card/40 p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">LinkedIn hook</Label>
                  <span className={cn("text-xs", linkedinOver ? "text-destructive" : "text-muted-foreground")}>
                    {linkedinLen}/180
                  </span>
                </div>
                <Textarea
                  rows={3}
                  value={editing.linkedin_hook ?? ""}
                  onChange={(e) => setEditing({ ...editing, linkedin_hook: e.target.value })}
                  className="resize-none"
                />
                <AIControlStrip
                  fieldType="linkedin_hook"
                  channel="linkedin"
                  postId={editing.id || null}
                  postTitle={editing.title}
                  postCategory={editing.category}
                  originalText={editing.linkedin_hook ?? ""}
                  onApply={(t) => setEditing({ ...editing, linkedin_hook: t })}
                  hideCategoryTrait
                />
              </section>

              {/* Facebook channel section */}
              <section className="space-y-2 rounded-lg border border-border/60 bg-card/40 p-4">
                <Label className="text-sm font-semibold">Facebook body</Label>
                <Textarea
                  rows={4}
                  value={editing.facebook_body ?? ""}
                  onChange={(e) => setEditing({ ...editing, facebook_body: e.target.value })}
                  className="resize-none"
                />
                <AIControlStrip
                  fieldType="facebook_body"
                  channel="facebook"
                  postId={editing.id || null}
                  postTitle={editing.title}
                  postCategory={editing.category}
                  originalText={editing.facebook_body ?? ""}
                  onApply={(t) => setEditing({ ...editing, facebook_body: t })}
                  hideCategoryTrait
                />
              </section>

              {/* Blog channel section */}
              <section className="space-y-2 rounded-lg border border-border/60 bg-card/40 p-4">
                <Label className="text-sm font-semibold">Blog body (markdown)</Label>
                <Textarea
                  rows={10}
                  value={editing.blog_body ?? ""}
                  onChange={(e) => setEditing({ ...editing, blog_body: e.target.value })}
                  className="font-mono text-sm"
                />
                <AIControlStrip
                  fieldType="blog_markdown"
                  channel="blog"
                  postId={editing.id || null}
                  postTitle={editing.title}
                  postCategory={editing.category}
                  originalText={editing.blog_body ?? ""}
                  onApply={(t) => setEditing({ ...editing, blog_body: t })}
                  hideCategoryTrait
                />
              </section>

              {editing.category === "faith" && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={overrideFaithGap}
                    onChange={(e) => setOverrideFaithGap(e.target.checked)}
                  />
                  Override faith-gap rule (allow &lt;5 days between faith posts)
                </label>
              )}

              {bypassDailyLimit && (
                <p className="text-xs text-muted-foreground italic">
                  Daily-limit override active — saving will allow more than one post on this day.
                </p>
              )}

              {editing.last_error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-destructive">
                    <AlertTriangle size={14} /> Last publish error
                  </div>
                  <p className="break-words">{editing.last_error}</p>
                  {editing.last_attempt_at && (
                    <p className="text-muted-foreground">at {format(new Date(editing.last_attempt_at), "PPpp")}</p>
                  )}
                </div>
              )}

              {editingValidation.length > 0 && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-destructive">
                    <ShieldAlert size={14} /> Slot rule violations — fix before publishing
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {editingValidation.map((issue) => (
                      <li key={issue.code}>
                        <span className="font-medium">{issue.code}</span>: {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {editing.scheduled_at && editingValidation.length === 0 && (
                <div className="rounded-md border border-primary/40 bg-primary/10 p-2.5 text-xs flex items-center gap-2 text-primary">
                  <CheckCircle2 size={14} /> All non-negotiable slot rules pass.
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between px-6 py-4 border-t border-border/60 bg-muted/20">
            <Button variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive">
              <Trash2 /> {editing && !editing.id ? "Discard" : "Delete"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              {editing && editing.id && editing.linkedin_hook && (
                <Button
                  variant="secondary"
                  onClick={() => publishRowToLinkedIn(editing.id)}
                  disabled={publishingId === editing.id || editingValidation.length > 0}
                >
                  {publishingId === editing.id ? <Loader2 className="animate-spin" /> : <Send />}
                  {editing.last_error ? "Retry LinkedIn publish" : "Publish to LinkedIn now"}
                </Button>
              )}
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {editing && !editing.id ? "Create post" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </TooltipProvider>
  );
}

function PhasePill({
  label,
  state,
  spinning,
  tone = "primary",
}: {
  label: string;
  state: "pending" | "current" | "done";
  spinning?: boolean;
  tone?: "primary" | "destructive";
}) {
  const reached = state !== "pending";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        !reached && "border-border text-muted-foreground",
        reached && tone === "primary" && "border-primary/50 bg-primary/15 text-primary",
        reached && tone === "destructive" && "border-destructive/60 bg-destructive/15 text-destructive",
        state === "current" && tone === "primary" && "ring-2 ring-primary/40",
        state === "current" && tone === "destructive" && "ring-2 ring-destructive/50",
      )}
    >
      {spinning && <Loader2 size={10} className="animate-spin" />}
      {label}
    </span>
  );
}

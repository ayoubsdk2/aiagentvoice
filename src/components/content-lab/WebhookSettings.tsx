import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  PlayCircle,
  Save,
  Webhook,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

type Settings = {
  id: string;
  webhook_url: string | null;
  last_test_at: string | null;
  last_test_outcome: string | null;
  last_test_error: string | null;
};

type FailedPost = {
  id: string;
  title: string;
  scheduled_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
};

const MAKE_URL_PATTERN = /^https:\/\/hook(s)?\.([a-z0-9-]+\.)*make\.com\//i;

export function WebhookSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState<FailedPost[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: settingsRows, error: sErr }, { data: failedRows }] = await Promise.all([
      supabase
        .from("content_lab_settings")
        .select("id, webhook_url, last_test_at, last_test_outcome, last_test_error")
        .order("updated_at", { ascending: false })
        .limit(1),
      supabase
        .from("content_queue")
        .select("id, title, scheduled_at, last_attempt_at, last_error")
        .not("last_error", "is", null)
        .order("last_attempt_at", { ascending: false })
        .limit(10),
    ]);

    if (sErr) {
      toast.error("Failed to load settings", { description: sErr.message });
    } else {
      const row = (settingsRows?.[0] as Settings | undefined) ?? null;
      setSettings(row);
      setUrl(row?.webhook_url ?? "");
    }
    setFailed((failedRows ?? []) as FailedPost[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const urlValid = url.length === 0 || MAKE_URL_PATTERN.test(url.trim());

  async function handleSave() {
    const trimmed = url.trim();
    if (trimmed && !MAKE_URL_PATTERN.test(trimmed)) {
      toast.error("Invalid Make.com webhook URL", {
        description: "Must look like https://hook.make.com/xxxxxxxx",
      });
      return;
    }
    setSaving(true);
    try {
      if (settings) {
        const { error } = await supabase
          .from("content_lab_settings")
          .update({ webhook_url: trimmed || null })
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("content_lab_settings")
          .insert({ webhook_url: trimmed || null })
          .select("id, webhook_url, last_test_at, last_test_outcome, last_test_error")
          .single();
        if (error) throw error;
        setSettings(data as Settings);
      }
      toast.success("Webhook saved");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast.error("Save failed", { description: message });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!url.trim()) {
      toast.error("Enter a webhook URL first");
      return;
    }
    setTesting(true);
    try {
      // Save first so settings_id exists for the test handler to record outcome
      if (!settings || settings.webhook_url !== url.trim()) {
        await handleSave();
      }
      const { data, error } = await supabase.functions.invoke("content-lab-test-webhook", {
        body: { webhook_url: url.trim(), settings_id: settings?.id },
      });
      if (error) throw error;
      const result = data as { ok: boolean; outcome: string; http_status: number; error?: string };
      if (result.ok) {
        toast.success("Webhook test succeeded", {
          description: `Make.com responded with ${result.http_status}.`,
        });
      } else {
        toast.error("Webhook test failed", { description: result.error ?? "Unknown error" });
      }
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test failed";
      toast.error("Test failed", { description: message });
    } finally {
      setTesting(false);
    }
  }

  async function handleRunNow() {
    setDispatching(true);
    try {
      const { data, error } = await supabase.functions.invoke("content-lab-dispatch", {
        body: { source: "manual" },
      });
      if (error) throw error;
      const result = data as { delivered?: number; failed?: number; scanned?: number };
      toast.success(
        `Dispatch complete: ${result.delivered ?? 0} published, ${result.failed ?? 0} reverted`,
        { description: `${result.scanned ?? 0} due posts scanned.` },
      );
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dispatch failed";
      toast.error("Dispatch failed", { description: message });
    } finally {
      setDispatching(false);
    }
  }

  const lastOutcome = settings?.last_test_outcome;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="text-primary" size={20} />
            Make.com Webhook
          </CardTitle>
          <CardDescription>
            Posts marked <code className="text-xs">scheduled</code> are auto-published to this webhook
            once their scheduled time passes (checked every minute). Failed deliveries revert to{" "}
            <code className="text-xs">draft</code> with the error recorded below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-64" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  placeholder="https://hook.make.com/xxxxxxxxxxxxxxxx"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className={!urlValid ? "border-destructive" : ""}
                />
                {!urlValid && (
                  <p className="text-xs text-destructive">
                    Must be a Make.com hook URL (https://hook.make.com/…).
                  </p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock size={12} />
                  Make.com handles auth via its own OAuth — no API keys are stored in scenarios or in
                  this app.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={saving || !urlValid}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  Save
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing || !url.trim()}>
                  {testing ? <Loader2 className="animate-spin" /> : <PlayCircle />}
                  Send Test Ping
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleRunNow}
                  disabled={dispatching || !settings?.webhook_url}
                >
                  {dispatching ? <Loader2 className="animate-spin" /> : <ExternalLink />}
                  Run dispatcher now
                </Button>
              </div>

              {settings?.last_test_at && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm flex items-start gap-3">
                  {lastOutcome === "success" ? (
                    <CheckCircle2 className="text-primary shrink-0 mt-0.5" size={16} />
                  ) : (
                    <XCircle className="text-destructive shrink-0 mt-0.5" size={16} />
                  )}
                  <div className="space-y-0.5">
                    <div className="font-medium">
                      Last test:{" "}
                      <Badge variant={lastOutcome === "success" ? "secondary" : "destructive"}>
                        {lastOutcome ?? "unknown"}
                      </Badge>{" "}
                      <span className="text-muted-foreground font-normal">
                        at {format(new Date(settings.last_test_at), "PPpp")}
                      </span>
                    </div>
                    {settings.last_test_error && (
                      <div className="text-xs text-destructive break-all">
                        {settings.last_test_error}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="text-destructive" size={18} />
            Recent delivery failures
          </CardTitle>
          <CardDescription>
            Posts that bounced are reverted to draft. Fix the issue (or update the webhook) and
            re-schedule from the Strategic Hub.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {failed.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No failed deliveries recorded.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {failed.map((p) => (
                <li key={p.id} className="p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.scheduled_at
                          ? `Scheduled: ${format(new Date(p.scheduled_at), "PPpp")}`
                          : "Not scheduled"}
                        {p.last_attempt_at && (
                          <>
                            {" · "}
                            Last attempt: {format(new Date(p.last_attempt_at), "PPpp")}
                          </>
                        )}
                      </div>
                    </div>
                    <Badge variant="destructive">draft</Badge>
                  </div>
                  {p.last_error && (
                    <Alert variant="destructive" className="mt-2 py-2">
                      <AlertTitle className="text-xs">Error</AlertTitle>
                      <AlertDescription className="text-xs break-all">{p.last_error}</AlertDescription>
                    </Alert>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

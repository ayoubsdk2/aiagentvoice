import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

export interface ElementResult {
  key: string;
  label: string;
  ok: boolean;
  reason: string;
}

export interface TestConnectionResultsPayload {
  integrationName: string;
  elements: ElementResult[];
  allOk: boolean;
  summary: string;
}

export function TestConnectionResultsDialog({
  open,
  onOpenChange,
  payload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: TestConnectionResultsPayload | null;
}) {
  if (!payload) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg" />
      </Dialog>
    );
  }
  const { integrationName, elements, allOk, summary } = payload;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            Test Connection Results — {integrationName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {elements.map((el) => (
            <div
              key={el.key}
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                el.ok
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-destructive/40 bg-destructive/5"
              }`}
            >
              {el.ok ? (
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
              ) : (
                <XCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
              )}
              <div className="flex-1">
                <div className="font-bold text-foreground uppercase tracking-wide text-[11px]">
                  {el.label}
                </div>
                <div className="text-muted-foreground mt-0.5">{el.reason}</div>
              </div>
            </div>
          ))}
        </div>

        <div
          className={`rounded-md border px-3 py-2 text-xs font-semibold ${
            allOk
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              : "border-destructive/50 bg-destructive/10 text-destructive"
          }`}
        >
          {allOk ? "Connection test successful. " : "Connection test unsuccessful. "}
          {summary}
        </div>

        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

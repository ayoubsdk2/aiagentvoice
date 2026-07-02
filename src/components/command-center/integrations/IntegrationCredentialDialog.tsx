import { useState } from "react";
import { Loader2, X, KeyRound, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { IntegrationDefinition } from "@/lib/integration-registry";

interface Props {
  def: IntegrationDefinition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Credential drawer that opens when the user toggles a live integration ON.
 * Calls `save-integration-credentials` which encrypts (AES-256-GCM), persists,
 * and runs the live test procedure in one round trip.
 *
 * The toggle in the parent only flips green when this dialog reports success.
 */
export function IntegrationCredentialDialog({ def, open, onOpenChange, onSuccess }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    const { data, error } = await supabase.functions.invoke("save-integration-credentials", {
      body: { integrationId: def.id, credentials: values },
    });
    setSubmitting(false);

    if (error) {
      setErrorMsg(error.message);
      toast.error(`${def.displayName} validation failed`, { description: error.message });
      return;
    }
    if (data?.status === "active") {
      toast.success(`${def.displayName} connected`);
      onSuccess();
      onOpenChange(false);
      setValues({});
    } else {
      const msg = data?.message ?? "Credentials saved but live test failed";
      setErrorMsg(msg);
      toast.error(`${def.displayName} test failed`, { description: msg });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <KeyRound size={16} className="text-primary" />
            Configure {def.displayName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {def.testProcedure.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {def.requiredConfigFields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`field-${f.key}`} className="text-xs font-semibold text-foreground/80">
                {f.label}
                {f.secret && (
                  <span className="ml-2 text-[10px] text-primary uppercase tracking-widest">encrypted</span>
                )}
              </Label>
              <Input
                id={`field-${f.key}`}
                type={f.secret ? "password" : "text"}
                placeholder={f.example ?? ""}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                className="bg-secondary/30 border-border/30 text-sm"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ))}

          {errorMsg && (
            <div className="p-3 rounded border border-destructive/30 bg-destructive/5 text-xs text-destructive">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
            <ShieldCheck size={12} className="text-[hsl(var(--success))]" />
            <span>AES-256-GCM encrypted at rest. Your tenant only.</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
              <X size={14} /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || def.requiredConfigFields.some((f) => !values[f.key]?.trim())}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Save & test
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

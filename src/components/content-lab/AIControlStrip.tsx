import { useState } from "react";
import { Loader2, Sparkles, Dices, Check, X, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  TRAIT_AUTO,
  TRAIT_KEYS,
  TRAIT_LABELS,
  TRAIT_OPTIONS,
  defaultTraitState,
  type TraitKey,
  type TraitState,
} from "@/lib/content-lab/traits";
import { surpriseMe } from "@/lib/content-lab/surpriseMe";
import {
  generateStyledCopy,
  type RegenChannel,
  type RegenFieldType,
} from "@/lib/content-lab/generateStyledCopy";

interface AIControlStripProps {
  fieldType: RegenFieldType;
  channel: RegenChannel;
  postId?: string | null;
  postTitle: string;
  postCategory: string;
  originalText: string;
  onApply: (newText: string) => void;
  /** Optional label printed above the dropdowns. */
  heading?: string;
  /**
   * Hide the Category trait dropdown — useful when the parent form already
   * exposes a single Category selector that applies to all channels. The
   * Category trait is then locked to "Auto" so the post-level category drives
   * the prompt.
   */
  hideCategoryTrait?: boolean;
}

export function AIControlStrip({
  fieldType,
  channel,
  postId,
  postTitle,
  postCategory,
  originalText,
  onApply,
  heading = "AI Content Strategy Controls",
  hideCategoryTrait = false,
}: AIControlStripProps) {
  const visibleTraitKeys = hideCategoryTrait
    ? TRAIT_KEYS.filter((k) => k !== "category")
    : TRAIT_KEYS;
  const [traits, setTraits] = useState<TraitState>(defaultTraitState());
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewModel, setPreviewModel] = useState<string | null>(null);
  // Single-level undo: snapshot of the field value before the most recent Apply.
  const [undoSnapshot, setUndoSnapshot] = useState<string | null>(null);

  function setTrait(k: TraitKey, v: string) {
    setTraits((s) => ({ ...s, [k]: v }));
  }

  async function runRegen(opts: { surprise?: boolean } = {}) {
    if (!postTitle.trim()) {
      toast.error("Add a title first so the AI has context.");
      return;
    }
    setLoading(true);
    try {
      const res = await generateStyledCopy({
        fieldType,
        postId,
        postTitle,
        postCategory,
        originalText,
        traits,
        channel,
        surprise: opts.surprise,
      });
      setPreview(res.text);
      setPreviewModel(res.model);
      toast.success(`Regenerated via ${res.model}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Regeneration failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleSurprise() {
    const rolled = surpriseMe({ channel });
    setTraits(rolled);
    // Use the rolled values immediately by chaining.
    setTimeout(() => {
      // Inline regen with the new traits (state may not be flushed yet):
      generateStyledCopy({
        fieldType,
        postId,
        postTitle,
        postCategory,
        originalText,
        traits: rolled,
        channel,
        surprise: true,
      })
        .then((res) => {
          setPreview(res.text);
          setPreviewModel(res.model);
          toast.success(`Surprise via ${res.model}`);
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : "Regeneration failed";
          toast.error(msg);
        });
    }, 0);
  }

  function applyPreview() {
    if (!preview) return;
    // Snapshot the current value so Undo can restore it.
    setUndoSnapshot(originalText);
    onApply(preview);
    toast.success("Applied to field");
    setPreview(null);
    setPreviewModel(null);
  }

  function handleUndo() {
    if (undoSnapshot === null) return;
    onApply(undoSnapshot);
    setUndoSnapshot(null);
    toast.success("Reverted to previous version");
  }

  function discardPreview() {
    setPreview(null);
    setPreviewModel(null);
  }

  return (
    <div className="rounded-md border border-border/60 bg-secondary/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {heading}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => runRegen()}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
            AI Regenerate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleUndo}
            disabled={undoSnapshot === null || loading}
            className="gap-1.5"
            title={
              undoSnapshot === null
                ? "Nothing to undo"
                : "Revert the most recent AI Regenerate"
            }
          >
            <Undo2 size={14} />
            Undo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSurprise}
            disabled={loading}
            className="gap-1.5"
          >
            <Dices size={14} />
            Surprise Me!
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-3">
        {visibleTraitKeys.map((k) => (
          <div key={k} className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {TRAIT_LABELS[k]}
            </Label>
            <Select value={traits[k]} onValueChange={(v) => setTrait(k, v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={TRAIT_AUTO}>Auto</SelectItem>
                {TRAIT_OPTIONS[k].map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {preview !== null && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Preview {previewModel ? `· ${previewModel}` : ""}</span>
            <div className="flex items-center gap-1.5">
              <Button type="button" size="sm" variant="default" onClick={applyPreview} className="h-7 gap-1">
                <Check size={12} /> Apply
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={discardPreview} className="h-7 gap-1">
                <X size={12} /> Discard
              </Button>
            </div>
          </div>
          <pre className={cn(
            "whitespace-pre-wrap break-words text-xs leading-relaxed font-sans",
            "max-h-64 overflow-y-auto",
          )}>
            {preview}
          </pre>
        </div>
      )}
    </div>
  );
}

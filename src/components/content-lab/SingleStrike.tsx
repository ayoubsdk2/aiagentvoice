import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Sparkles, Save, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { AIControlStrip } from "@/components/content-lab/AIControlStrip";

const DISCLAIMER = "AI-assisted content - human review recommended";

interface GeneratedContent {
  blog_body: string;
  linkedin_hook: string;
  facebook_body: string;
  seo_metadata: {
    meta_title: string;
    meta_description: string;
    keywords: string[];
  };
}

export function SingleStrike() {
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState({ blog: true, linkedin: true, facebook: true });

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<GeneratedContent | null>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB.");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
  }

  async function handleGenerate() {
    if (!title.trim()) {
      toast.error("Please enter a title first.");
      return;
    }
    if (!platforms.blog && !platforms.linkedin && !platforms.facebook) {
      toast.error("Select at least one platform.");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("content-lab-generate", {
        body: { title: title.trim(), category: "industry" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setContent({
        blog_body: data.blog_body,
        linkedin_hook: data.linkedin_hook,
        facebook_body: data.facebook_body,
        seo_metadata: data.seo_metadata,
      });
      toast.success("Content generated. Tweak it below before saving.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveToQueue() {
    if (!content) return;
    setSaving(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const currentUser = authData.user;
      if (!currentUser) throw new Error("Please sign in again and try saving.");

      let imageUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() ?? "png";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("content-lab-images")
          .upload(path, imageFile, { contentType: imageFile.type });
        if (upErr) throw upErr;
        imageUrl = path;
      }

      const platformTargets = {
        blog: platforms.blog,
        linkedin: platforms.linkedin,
        facebook: platforms.facebook,
      };

      const status = scheduledDate ? "scheduled" : "draft";

      const { error: insErr } = await supabase.from("content_queue").insert({
        user_id: currentUser.id,
        title: title.trim(),
        scheduled_at: scheduledDate ? scheduledDate.toISOString() : null,
        post_type: "single",
        category: "industry",
        blog_body: platforms.blog ? content.blog_body : null,
        linkedin_hook: platforms.linkedin ? content.linkedin_hook : null,
        facebook_body: platforms.facebook ? content.facebook_body : null,
        image_url: imageUrl,
        status,
        seo_metadata: content.seo_metadata,
        platform_targets: platformTargets,
      });
      if (insErr) throw insErr;

      toast.success(scheduledDate ? "Saved & scheduled." : "Saved as draft.");
      setTitle("");
      setScheduledDate(undefined);
      clearImage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const hookLen = content?.linkedin_hook.length ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
          <CardDescription>
            Draft one post. Generate AI copy, then refine before sending it to the queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="cl-title">Title</Label>
            <Input
              id="cl-title"
              placeholder="e.g. Why Your Click-Charge Model Is Quietly Bleeding Margin"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cl-image">Image</Label>
            {imagePreview ? (
              <div className="relative rounded-md border border-border overflow-hidden">
                <img src={imagePreview} alt="Selected upload preview" className="w-full max-h-64 object-cover" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 rounded-full bg-background/80 backdrop-blur p-1 hover:bg-background"
                  aria-label="Remove image"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label
                htmlFor="cl-image"
                className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-md border border-dashed border-border/60 px-4 py-8 text-sm text-muted-foreground hover:bg-secondary/40 transition-colors"
              >
                <ImageIcon size={20} className="opacity-60" />
                <span>Click to upload an image (PNG, JPG · max 10 MB)</span>
              </label>
            )}
            <Input
              id="cl-image"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          <div className="space-y-2">
            <Label>Scheduled Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !scheduledDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date (optional — leave blank for draft)"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Platforms</Label>
            <div className="grid grid-cols-3 gap-3">
              {(["blog", "linkedin", "facebook"] as const).map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 cursor-pointer hover:bg-secondary/40 transition-colors capitalize"
                >
                  <Checkbox
                    checked={platforms[p]}
                    onCheckedChange={(v) => setPlatforms((s) => ({ ...s, [p]: v === true }))}
                  />
                  <span className="text-sm">{p}</span>
                </label>
              ))}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !title.trim()}
            className="w-full gap-2"
          >
            {generating ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? "Generating..." : "Generate Content"}
          </Button>

          <p className="text-xs text-muted-foreground italic text-center">{DISCLAIMER}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editable Preview</CardTitle>
          <CardDescription>
            Tweak any field, then save to the queue. Unchecked platforms are excluded on save.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!content ? (
            <div className="rounded-lg border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
              Generated copy will appear here. Fill out the form and click <strong>Generate Content</strong>.
            </div>
          ) : (
            <>
              {platforms.blog && (
                <div className="space-y-2">
                  <Label htmlFor="cl-blog">Blog (~1,200 words, SEO-optimized)</Label>
                  <Textarea
                    id="cl-blog"
                    value={content.blog_body}
                    onChange={(e) => setContent({ ...content, blog_body: e.target.value })}
                    className="min-h-[260px] font-mono text-xs leading-relaxed"
                  />
                  <AIControlStrip
                    fieldType="blog_markdown"
                    channel="blog"
                    postTitle={title}
                    postCategory="industry"
                    originalText={content.blog_body}
                    onApply={(t) => setContent({ ...content, blog_body: t })}
                  />
                </div>
              )}

              {platforms.linkedin && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="cl-li">LinkedIn Hook</Label>
                    <span
                      className={cn(
                        "text-xs font-mono",
                        hookLen > 180 ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {hookLen}/180
                    </span>
                  </div>
                  <Textarea
                    id="cl-li"
                    value={content.linkedin_hook}
                    onChange={(e) => setContent({ ...content, linkedin_hook: e.target.value })}
                    className="min-h-[80px]"
                  />
                  <AIControlStrip
                    fieldType="linkedin_hook"
                    channel="linkedin"
                    postTitle={title}
                    postCategory="industry"
                    originalText={content.linkedin_hook}
                    onApply={(t) => setContent({ ...content, linkedin_hook: t })}
                  />
                </div>
              )}

              {platforms.facebook && (
                <div className="space-y-2">
                  <Label htmlFor="cl-fb">Facebook Body</Label>
                  <Textarea
                    id="cl-fb"
                    value={content.facebook_body}
                    onChange={(e) => setContent({ ...content, facebook_body: e.target.value })}
                    className="min-h-[120px]"
                  />
                  <AIControlStrip
                    fieldType="facebook_body"
                    channel="facebook"
                    postTitle={title}
                    postCategory="industry"
                    originalText={content.facebook_body}
                    onApply={(t) => setContent({ ...content, facebook_body: t })}
                  />
                </div>
              )}

              <div className="rounded-md border border-border/60 p-3 space-y-1 bg-secondary/20">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  SEO Metadata
                </p>
                <p className="text-xs"><strong>Title:</strong> {content.seo_metadata.meta_title}</p>
                <p className="text-xs"><strong>Description:</strong> {content.seo_metadata.meta_description}</p>
                <p className="text-xs"><strong>Keywords:</strong> {content.seo_metadata.keywords.join(", ")}</p>
              </div>

              <Button
                type="button"
                onClick={handleSaveToQueue}
                disabled={saving}
                className="w-full gap-2"
                variant="default"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save size={16} />}
                {saving ? "Saving..." : scheduledDate ? "Save & Schedule" : "Save to Queue (Draft)"}
              </Button>

              <p className="text-xs text-muted-foreground italic text-center">{DISCLAIMER}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

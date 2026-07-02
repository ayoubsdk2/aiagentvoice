import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Keyboard, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OnScreenKeyboard } from "./OnScreenKeyboard";
import type { IndustryView } from "@/contexts/SandboxIndustryContext";

interface SendIndustryDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  industry: IndustryView;
  fromEmail?: string;
  fromName?: string | null;
}

type FieldKey = "replyTo" | "to" | "subject" | "message";

function parseList(s: string): string[] {
  return s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SendIndustryDialog({
  open,
  onOpenChange,
  industry,
  fromEmail: fromEmailProp,
  fromName,
}: SendIndustryDialogProps) {
  const [replyTo, setReplyTo] = useState(fromEmailProp ?? "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(
    `Try the Phaos AI ${industry.name} Voice Agent`,
  );
  const link = useMemo(
    () => `${window.location.origin}/${industry.id}-voice`,
    [industry.id],
  );
  const [message, setMessage] = useState(
    `Hi,\n\nI'd like to share the Phaos AI Voice Agent built for ${industry.name}.\n\nTry it live (no install): ${link}\n\nIt demonstrates predictive dispatch, scheduling, and integrated CRM/RMM/ERP workflows tailored to ${industry.name}.\n\n— ${fromName || replyTo}`,
  );
  const [sending, setSending] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [focusField, setFocusField] = useState<FieldKey>("message");
  const refs = useRef<Record<FieldKey, HTMLInputElement | HTMLTextAreaElement | null>>({
    replyTo: null, to: null, subject: null, message: null,
  });

  const setField = (k: FieldKey, v: string) => {
    if (k === "replyTo") setReplyTo(v);
    else if (k === "to") setTo(v);
    else if (k === "subject") setSubject(v);
    else setMessage(v);
  };
  const getField = (k: FieldKey): string =>
    k === "replyTo" ? replyTo : k === "to" ? to : k === "subject" ? subject : message;

  const insert = (text: string) => {
    const el = refs.current[focusField];
    const current = getField(focusField);
    if (el && "selectionStart" in el && el.selectionStart != null) {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const next = current.slice(0, start) + text + current.slice(end);
      setField(focusField, next);
      requestAnimationFrame(() => {
        try {
          el.focus();
          const pos = start + text.length;
          (el as HTMLInputElement).setSelectionRange(pos, pos);
        } catch { /* noop */ }
      });
    } else {
      setField(focusField, current + text);
    }
  };
  const backspace = () => {
    const el = refs.current[focusField];
    const current = getField(focusField);
    if (el && "selectionStart" in el && el.selectionStart != null) {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      if (start === end && start === 0) return;
      const next = start === end
        ? current.slice(0, start - 1) + current.slice(end)
        : current.slice(0, start) + current.slice(end);
      setField(focusField, next);
      const pos = start === end ? start - 1 : start;
      requestAnimationFrame(() => {
        try {
          el.focus();
          (el as HTMLInputElement).setSelectionRange(pos, pos);
        } catch { /* noop */ }
      });
    } else {
      setField(focusField, current.slice(0, -1));
    }
  };

  const handleSend = async () => {
    const trimmedReplyTo = replyTo.trim();
    if (!trimmedReplyTo || !EMAIL_RE.test(trimmedReplyTo)) {
      toast.error("Enter a valid Reply-To email address.");
      return;
    }
    const toList = parseList(to);
    if (toList.length === 0) {
      toast.error("Add at least one recipient in the To field.");
      return;
    }
    const bad = toList.find((e) => !EMAIL_RE.test(e));
    if (bad) {
      toast.error(`Invalid email: ${bad}`);
      return;
    }
    if (!subject.trim()) { toast.error("Subject is required."); return; }
    if (!message.trim()) { toast.error("Message is required."); return; }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-industry-invite", {
        body: {
          to: toList,
          subject: subject.trim(),
          message,
          industryId: industry.id,
          industryName: industry.name,
          link,
          replyToEmail: trimmedReplyTo,
          replyToName: fromName || undefined,
        },
      });
      if (error) throw error;
      if (data && (data as { error?: string }).error) {
        throw new Error((data as { error: string }).error);
      }
      toast.success(`Invite sent to ${toList.length} recipient${toList.length > 1 ? "s" : ""}.`);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Send failed: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send size={16} className="text-[#f5c542]" />
            Send {industry.name} Voice Agent
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 break-all">
            Share link: <span className="font-mono text-[#f5c542]">{link}</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            Emails are sent from the verified Phaos AI domain to maximize deliverability.
            Your address is set as <strong>Reply-To</strong>, so any reply comes straight to you.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2 sm:gap-3 items-center">
          <Label htmlFor="reply-to-field" className="text-xs uppercase tracking-wide">Reply-To*</Label>
          <Input
            id="reply-to-field"
            ref={(el) => { refs.current.replyTo = el; }}
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            onFocus={() => setFocusField("replyTo")}
            placeholder="you@yourcompany.com"
            autoComplete="email"
          />

          <Label htmlFor="to-field" className="text-xs uppercase tracking-wide">To*</Label>
          <Input
            id="to-field"
            ref={(el) => { refs.current.to = el; }}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onFocus={() => setFocusField("to")}
            placeholder="prospect@company.com, another@company.com"
            autoComplete="off"
          />

          <Label htmlFor="subject-field" className="text-xs uppercase tracking-wide">Subject*</Label>
          <Input
            id="subject-field"
            ref={(el) => { refs.current.subject = el; }}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => setFocusField("subject")}
          />

          <Label htmlFor="message-field" className="text-xs uppercase tracking-wide self-start pt-2">Message*</Label>
          <Textarea
            id="message-field"
            ref={(el) => { refs.current.message = el; }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={() => setFocusField("message")}
            rows={8}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowKeyboard((s) => !s)}
            className="gap-1.5"
            aria-pressed={showKeyboard}
          >
            <Keyboard size={14} />
            {showKeyboard ? "Hide" : "Show"} on-screen keyboard
          </Button>
          <span className="text-[10px] text-muted-foreground">
            Editing: <span className="font-bold uppercase">{focusField}</span>
          </span>
        </div>

        {showKeyboard && (
          <OnScreenKeyboard onInsert={insert} onBackspace={backspace} />
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="bg-[#f5c542] text-black hover:bg-[#f5c542]/90 font-bold"
          >
            {sending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Send size={14} className="mr-1.5" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

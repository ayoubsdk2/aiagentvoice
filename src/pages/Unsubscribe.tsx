import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Status = "validating" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("validating");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.valid === true) setStatus("ready");
        else if (data?.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setStatus("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error || !data?.success) {
      if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
      return;
    }
    setStatus("done");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="max-w-md w-full rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-bold mb-2">Email preferences</h1>
        {status === "validating" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Validating link...</p>
          </div>
        )}
        {status === "ready" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Click below to confirm you no longer want to receive emails from Phaos AI.
            </p>
            <button
              onClick={confirm}
              className="w-full py-3 rounded-full bg-gradient-to-r from-primary to-primary/70 text-primary-foreground font-semibold hover:opacity-95"
            >
              Confirm Unsubscribe
            </button>
          </>
        )}
        {status === "submitting" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processing...</p>
          </div>
        )}
        {status === "done" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="text-primary" size={36} />
            <p className="text-sm">You have been unsubscribed.</p>
          </div>
        )}
        {status === "already" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="text-primary" size={36} />
            <p className="text-sm">You are already unsubscribed.</p>
          </div>
        )}
        {(status === "invalid" || status === "error") && (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertCircle className="text-destructive" size={36} />
            <p className="text-sm text-muted-foreground">
              {status === "invalid"
                ? "This link is invalid or has expired."
                : "Something went wrong. Please try again."}
            </p>
          </div>
        )}
        <Link to="/" className="block mt-6 text-xs text-muted-foreground hover:text-foreground">
          ← Back to Phaos AI
        </Link>
      </div>
    </div>
  );
}

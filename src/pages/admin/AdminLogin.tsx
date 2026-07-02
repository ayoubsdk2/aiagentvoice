import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { clearAdminToken, loginAdmin, resetAdminPassword } from "@/lib/admin-session";
import { usePageMeta } from "@/lib/usePageMeta";

export default function AdminLogin() {
  usePageMeta({ title: "Admin Access — Phaos AI", description: "Restricted admin entry.", path: "/admin/login" });
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetCurrent, setResetCurrent] = useState("");
  const [resetNext, setResetNext] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetShow, setResetShow] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await loginAdmin(username, password);
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/admin";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast({ title: "Access denied", description: err instanceof Error ? err.message : "Login failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    if (resetNext !== resetConfirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (resetNext.length < 10) {
      toast({ title: "Too short", description: "New password must be at least 10 characters.", variant: "destructive" });
      return;
    }
    setResetting(true);
    try {
      await resetAdminPassword(resetCurrent, resetNext);
      clearAdminToken();
      toast({ title: "Password updated", description: "Sign in again with your new password." });
      setResetOpen(false);
      setResetCurrent(""); setResetNext(""); setResetConfirm("");
      setPassword("");
    } catch (err) {
      toast({ title: "Reset failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <h1 className="sr-only">Admin Access</h1>
      <Card className="w-full max-w-md p-8 bg-card/60 backdrop-blur border-border/60">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Admin Access</h2>
            <p className="text-xs text-muted-foreground">Restricted area — credentials required.</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-username">Username</Label>
            <Input
              id="admin-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
          >
            <KeyRound size={12} /> Reset password
          </button>
        </div>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Admin Password</DialogTitle>
            <DialogDescription>
              Enter your current password and a new password (minimum 10 characters). You will need to sign in again afterwards.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cur-pw">Current password</Label>
              <Input
                id="cur-pw"
                type={resetShow ? "text" : "password"}
                value={resetCurrent}
                onChange={(e) => setResetCurrent(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">New password</Label>
              <Input
                id="new-pw"
                type={resetShow ? "text" : "password"}
                value={resetNext}
                onChange={(e) => setResetNext(e.target.value)}
                required
                minLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirm new password</Label>
              <Input
                id="confirm-pw"
                type={resetShow ? "text" : "password"}
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                required
                minLength={10}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={resetShow} onChange={(e) => setResetShow(e.target.checked)} />
              Show passwords
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setResetOpen(false)} disabled={resetting}>Cancel</Button>
              <Button type="submit" disabled={resetting}>
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, CalendarClock, Zap, Webhook } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/use-user";
import { SingleStrike } from "@/components/content-lab/SingleStrike";
import { StrategicHub } from "@/components/content-lab/StrategicHub";
import { WebhookSettings } from "@/components/content-lab/WebhookSettings";
import { getAdminToken } from "@/lib/admin-session";

const ALLOWED_EMAIL = "daniel@phaosai.com";

export default function ContentLab() {
  const { user, loading } = useUser();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Bypass the email gate when rendered inside the credential-gated /admin section.
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin") && getAdminToken()) {
      setChecked(true);
      return;
    }
    if (loading) return;
    const email = user?.email?.toLowerCase() ?? null;
    if (!user || email !== ALLOWED_EMAIL) {
      navigate("/", { replace: true });
      return;
    }
    setChecked(true);
  }, [user, loading, navigate]);


  if (loading || !checked) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-6 w-96 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 md:p-10">
        <header className="mb-8 flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Sparkles className="text-primary" size={22} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              Content Lab
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Plan, schedule, and publish brand content across channels.
            </p>
          </div>
        </header>

        <Tabs defaultValue="strategic" className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="strategic" className="gap-2">
              <CalendarClock size={16} />
              Strategic Hub
            </TabsTrigger>
            <TabsTrigger value="single" className="gap-2">
              <Zap size={16} />
              Single Strike
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook size={16} />
              Webhooks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="strategic" className="mt-6">
            <StrategicHub />
          </TabsContent>

          <TabsContent value="single" className="mt-6">
            <SingleStrike />
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6">
            <WebhookSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

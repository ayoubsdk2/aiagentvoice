import { Suspense, lazy } from "react";
import { useParams } from "react-router-dom";
import { TopHeader } from "@/components/command-center/TopHeader";
import { SystemErrorBoundary } from "@/components/command-center/SystemErrorBoundary";
import { usePageMeta } from "@/lib/usePageMeta";
import { SandboxIndustryProvider } from "@/contexts/SandboxIndustryContext";

const VapiSandbox = lazy(() =>
  import("@/components/command-center/VapiSandbox").then((m) => ({ default: m.VapiSandbox }))
);

const Fallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function SandboxPublic() {
  // /:industryId deep-link support (e.g. aiagentvoice-ten.vercel.app/document-solutions).
  // The catch-all route uses `slug`; the explicit /i/:industryId route uses `industryId`.
  const params = useParams<{ industryId?: string; slug?: string }>();
  const rawId = params.industryId ?? params.slug;
  // Canonical share links use the `-voice` suffix (e.g. `/document-solutions-voice`);
  // strip it before resolving the industry.
  const industryId = rawId ? rawId.replace(/-voice$/i, "") : undefined;

  usePageMeta({
    title: "Phaos AI Voice Sandbox - Test It Live",
    description: "Talk to Phaos AI, the voice agent built for service businesses. Try predictive dispatch, scheduling, and integration flows across 30+ industries in your browser.",
    path: industryId ? `/${industryId}-voice` : "/",
  });
  return (
    <SandboxIndustryProvider initialIndustryId={industryId ?? null}>
      <div className="flex flex-col h-screen bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden">
        <TopHeader publicMode brandLabel="Phaos AI - Test It Live" />
        <h1 className="sr-only">Phaos AI Voice Assistant Sandbox</h1>
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
          <SystemErrorBoundary>
            <Suspense fallback={<Fallback />}>
              <VapiSandbox />
            </Suspense>
          </SystemErrorBoundary>
        </main>
      </div>
    </SandboxIndustryProvider>
  );
}

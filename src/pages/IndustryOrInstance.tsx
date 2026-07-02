import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { INDUSTRIES } from "@/lib/industries";

const SandboxPublic = lazy(() => import("@/pages/SandboxPublic"));
const SandboxInstance = lazy(() => import("@/pages/SandboxInstance"));

const Fallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/**
 * Route handler for `/:slug` — if the slug matches a known industry id we render
 * the public sandbox pre-loaded with that industry. Otherwise we fall through
 * to the legacy branded SandboxInstance lookup (custom client subdomains).
 */
export default function IndustryOrInstance() {
  const { slug } = useParams<{ slug: string }>();
  // Accept either `/<industry-id>` (legacy) or `/<industry-id>-voice` (canonical share link).
  const normalized = slug?.replace(/-voice$/i, "") ?? "";
  const isIndustry = !!normalized && INDUSTRIES.some((i) => i.id === normalized);
  return (
    <Suspense fallback={<Fallback />}>
      {isIndustry ? <SandboxPublic /> : <SandboxInstance />}
    </Suspense>
  );
}

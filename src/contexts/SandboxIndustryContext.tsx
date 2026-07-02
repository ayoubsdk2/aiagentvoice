import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_INDUSTRY_ID,
  getIndustry,
  INDUSTRIES,
  type IndustryConfig,
} from "@/lib/industries";

/**
 * UI-facing adapter shape consumed by the sandbox components. The canonical
 * source of truth is `IndustryConfig` in `@/lib/industries` — we map its fields
 * here so VapiSandbox / TopHeader keep working with their existing prop names.
 */
export interface IndustryView {
  id: string;
  name: string;
  greeting: string;
  systemPromptAddendum: string;
  questions: { label: string; prompt: string; note?: string }[];
  integrations: { acronym: string; title: string }[];
  raw: IndustryConfig;
}

function toView(cfg: IndustryConfig): IndustryView {
  return {
    id: cfg.id,
    name: cfg.displayName,
    greeting: cfg.greeting,
    systemPromptAddendum: cfg.industryAddendum,
    questions: cfg.recommendedQuestions.map((q) => ({
      label: q.title,
      prompt: q.scenario,
    })),
    integrations: cfg.integrations.map((i) => ({
      acronym: i.acronym,
      title: i.name,
    })),
    raw: cfg,
  };
}

interface SandboxIndustryContextValue {
  industries: IndustryView[];
  industry: IndustryView;
  industryId: string;
  setIndustryId: (id: string) => void;
}

const SandboxIndustryContext = createContext<SandboxIndustryContextValue | null>(null);

const VIEWS: IndustryView[] = INDUSTRIES.map(toView);

export function SandboxIndustryProvider({
  children,
  initialIndustryId,
}: {
  children: ReactNode;
  initialIndustryId?: string | null;
}) {
  const resolveInitial = () =>
    (initialIndustryId && INDUSTRIES.some((i) => i.id === initialIndustryId))
      ? initialIndustryId
      : DEFAULT_INDUSTRY_ID;

  const [industryId, setIndustryId] = useState<string>(resolveInitial());

  // If the URL param changes (user navigates between /industry slugs), sync state.
  useEffect(() => {
    if (initialIndustryId && INDUSTRIES.some((i) => i.id === initialIndustryId)) {
      setIndustryId(initialIndustryId);
    }
  }, [initialIndustryId]);

  const value = useMemo<SandboxIndustryContextValue>(() => ({
    industries: VIEWS,
    industry: toView(getIndustry(industryId)),
    industryId,
    setIndustryId,
  }), [industryId]);
  return (
    <SandboxIndustryContext.Provider value={value}>
      {children}
    </SandboxIndustryContext.Provider>
  );
}

export function useSandboxIndustry(): SandboxIndustryContextValue {
  const ctx = useContext(SandboxIndustryContext);
  if (!ctx) throw new Error("useSandboxIndustry must be used within SandboxIndustryProvider");
  return ctx;
}

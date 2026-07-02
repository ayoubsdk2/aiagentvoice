import { useDemoMode } from "@/contexts/DemoModeContext";
import { AwaitingGoLive } from "./AwaitingGoLive";
import SampleLiveDashboard from "./SampleLiveDashboard";

interface CustomerOverviewProps {
  onNavigate: (tab: string) => void;
}

export function CustomerOverview({ onNavigate }: CustomerOverviewProps) {
  const { state } = useDemoMode();
  if (state.enabled) return <SampleLiveDashboard scope={state.scope} />;
  return <AwaitingGoLive onNavigate={onNavigate} />;
}

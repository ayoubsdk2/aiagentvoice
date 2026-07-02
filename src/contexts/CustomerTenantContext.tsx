import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from "react";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { getFixture, SAMPLE_TIME_RANGES } from "@/components/customer-portal/sampleFixtures";

export type EnvMode = "Production" | "Staging" | "Sandbox";

export interface TenantContextValue {
  organization: string;
  setOrganization: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  phoneNumber: string;
  setPhoneNumber: (v: string) => void;
  timeRange: string;
  setTimeRange: (v: string) => void;
  environment: EnvMode;
  setEnvironment: (v: EnvMode) => void;
  organizations: readonly string[];
  locations: readonly string[];
  phoneNumbers: readonly string[];
  timeRanges: readonly string[];
  environments: readonly EnvMode[];
  /** True when no real tenant data exists AND demo mode is OFF. */
  isAwaitingSetup: boolean;
}

const EMPTY_PLACEHOLDER = "None — awaiting setup";
const TIME_RANGES = SAMPLE_TIME_RANGES;
const ENVIRONMENTS_FULL: EnvMode[] = ["Production", "Staging", "Sandbox"];
const ENVIRONMENTS_LIVE: EnvMode[] = ["Production", "Staging"];

const TenantCtx = createContext<TenantContextValue | null>(null);

export function CustomerTenantProvider({ children }: { children: ReactNode }) {
  const { state } = useDemoMode();

  const [organization, setOrganization] = useState(EMPTY_PLACEHOLDER);
  const [location, setLocation] = useState(EMPTY_PLACEHOLDER);
  const [phoneNumber, setPhoneNumber] = useState(EMPTY_PLACEHOLDER);
  const [timeRange, setTimeRange] = useState("Last 30 Days");
  const [environment, setEnvironment] = useState<EnvMode>("Production");

  // Derive the option lists from current demo state.
  const { organizations, locations, phoneNumbers, environments } = useMemo(() => {
    if (state.enabled) {
      const f = getFixture(state.scope);
      return {
        organizations: f.organizations,
        locations: f.locations,
        phoneNumbers: f.phoneNumbers,
        environments: ENVIRONMENTS_FULL,
      };
    }
    // Empty by default. Real-tenant hydration would replace these arrays once
    // portal_organizations / portal_locations / portal_phone_numbers return rows.
    return {
      organizations: [EMPTY_PLACEHOLDER],
      locations: [EMPTY_PLACEHOLDER],
      phoneNumbers: [EMPTY_PLACEHOLDER],
      environments: ENVIRONMENTS_LIVE,
    };
  }, [state]);

  // Whenever the option set flips (demo on/off or scope change), snap selections
  // back to the first option so we never display stale values from a different scope.
  useEffect(() => {
    setOrganization(organizations[0]);
    setLocation(locations[0]);
    setPhoneNumber(phoneNumbers[0]);
    if (!state.enabled) setEnvironment("Production");
  }, [organizations, locations, phoneNumbers, state.enabled]);

  const isAwaitingSetup = !state.enabled && organizations[0] === EMPTY_PLACEHOLDER;

  const value = useMemo<TenantContextValue>(
    () => ({
      organization, setOrganization,
      location, setLocation,
      phoneNumber, setPhoneNumber,
      timeRange, setTimeRange,
      environment, setEnvironment,
      organizations,
      locations,
      phoneNumbers,
      timeRanges: TIME_RANGES,
      environments,
      isAwaitingSetup,
    }),
    [organization, location, phoneNumber, timeRange, environment, organizations, locations, phoneNumbers, environments, isAwaitingSetup],
  );

  return <TenantCtx.Provider value={value}>{children}</TenantCtx.Provider>;
}

export function useCustomerTenant(): TenantContextValue {
  const v = useContext(TenantCtx);
  if (!v) throw new Error("useCustomerTenant must be used inside CustomerTenantProvider");
  return v;
}

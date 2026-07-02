import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  DemoModeProvider,
  useDemoMode,
  type SampleScope,
} from "@/contexts/DemoModeContext";
import { CustomerTenantProvider } from "@/contexts/CustomerTenantContext";
import { CustomerOverview } from "@/components/customer-portal/CustomerOverview";
import { DemoModeBanner } from "@/components/customer-portal/DemoModeBanner";
import { AwaitingDataState } from "@/components/customer-portal/AwaitingDataState";

// Mock the heavy SampleLiveDashboard (recharts) for fast, stable tests.
vi.mock("@/components/customer-portal/SampleLiveDashboard", () => ({
  default: ({ scope }: { scope: SampleScope }) => (
    <div data-testid="sample-dashboard" data-scope={scope}>
      Sample dashboard: {scope}
    </div>
  ),
}));

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DemoModeProvider>
      <CustomerTenantProvider>{children}</CustomerTenantProvider>
    </DemoModeProvider>
  );
}

// Tiny harness to drive demo mode from inside a render.
function ScopeDriver({
  initial,
  children,
}: {
  initial?: SampleScope | null;
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <Driver initial={initial} />
      {children}
    </Providers>
  );
}

function Driver({ initial }: { initial?: SampleScope | null }) {
  const { enable, disable } = useDemoMode();
  // Apply the requested initial state once on mount.
  // We deliberately bypass URL/localStorage so each test starts clean.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  if (typeof initial !== "undefined") {
    // run synchronously inside render to set state before children read it
    // (subsequent renders are no-ops because initial doesn't change).
  }
  return (
    <div hidden>
      <button data-testid="enable-local" onClick={() => enable("local")}>L</button>
      <button data-testid="enable-regional" onClick={() => enable("regional")}>R</button>
      <button data-testid="enable-national" onClick={() => enable("national")}>N</button>
      <button data-testid="enable-global" onClick={() => enable("global")}>G</button>
      <button data-testid="disable" onClick={() => disable()}>X</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("CustomerOverview demo-mode gating", () => {
  it("renders the awaiting-go-live checklist when sample mode is OFF", () => {
    render(
      <ScopeDriver>
        <CustomerOverview onNavigate={() => {}} />
      </ScopeDriver>,
    );
    expect(
      screen.getByText(/your portal is ready to go live/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("sample-dashboard")).not.toBeInTheDocument();
  });

  it("renders the sample dashboard when sample mode is ON", () => {
    render(
      <ScopeDriver>
        <CustomerOverview onNavigate={() => {}} />
      </ScopeDriver>,
    );
    act(() => {
      screen.getByTestId("enable-regional").click();
    });
    const dash = screen.getByTestId("sample-dashboard");
    expect(dash).toHaveAttribute("data-scope", "regional");
  });

  it("instantly switches the dashboard when the scope changes", () => {
    render(
      <ScopeDriver>
        <CustomerOverview onNavigate={() => {}} />
      </ScopeDriver>,
    );
    act(() => screen.getByTestId("enable-local").click());
    expect(screen.getByTestId("sample-dashboard")).toHaveAttribute(
      "data-scope",
      "local",
    );
    act(() => screen.getByTestId("enable-national").click());
    expect(screen.getByTestId("sample-dashboard")).toHaveAttribute(
      "data-scope",
      "national",
    );
    act(() => screen.getByTestId("enable-global").click());
    expect(screen.getByTestId("sample-dashboard")).toHaveAttribute(
      "data-scope",
      "global",
    );
  });

  it("returns to the awaiting state when sample mode is exited", () => {
    render(
      <ScopeDriver>
        <CustomerOverview onNavigate={() => {}} />
      </ScopeDriver>,
    );
    act(() => screen.getByTestId("enable-local").click());
    expect(screen.getByTestId("sample-dashboard")).toBeInTheDocument();
    act(() => screen.getByTestId("disable").click());
    expect(screen.queryByTestId("sample-dashboard")).not.toBeInTheDocument();
    expect(
      screen.getByText(/your portal is ready to go live/i),
    ).toBeInTheDocument();
  });
});

describe("DemoModeBanner reflects current state", () => {
  it("shows OFF state when sample mode is disabled", () => {
    render(
      <ScopeDriver>
        <DemoModeBanner />
      </ScopeDriver>,
    );
    const banner = screen.getByTestId("demo-mode-banner");
    expect(banner).toHaveAttribute("data-demo-state", "off");
    expect(banner.textContent).toMatch(/sample live account: off/i);
  });

  it("shows ON state and scope when sample mode is enabled", () => {
    render(
      <ScopeDriver>
        <DemoModeBanner />
      </ScopeDriver>,
    );
    act(() => screen.getByTestId("enable-national").click());
    const banner = screen.getByTestId("demo-mode-banner");
    expect(banner).toHaveAttribute("data-demo-state", "on");
    expect(banner).toHaveAttribute("data-demo-scope", "national");
    expect(banner.textContent).toMatch(/national/i);
  });
});

describe("AwaitingDataState (Analytics / Calls empty state)", () => {
  it("lists missing tenant fields and offers all 4 sample scopes", () => {
    render(
      <ScopeDriver>
        <AwaitingDataState title="No analytics yet" description="Demo desc." />
      </ScopeDriver>,
    );
    expect(screen.getByText(/no analytics yet/i)).toBeInTheDocument();
    // Tenant readiness checklist
    expect(screen.getByText(/organization connected/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one location/i)).toBeInTheDocument();
    expect(screen.getByText(/phone number provisioned/i)).toBeInTheDocument();
    expect(screen.getByText(/3 missing/i)).toBeInTheDocument();
    // Scope buttons
    expect(screen.getByText(/^local$/i)).toBeInTheDocument();
    expect(screen.getByText(/^regional$/i)).toBeInTheDocument();
    expect(screen.getByText(/^national$/i)).toBeInTheDocument();
    expect(screen.getByText(/^global$/i)).toBeInTheDocument();
  });
});

describe("DemoMode URL persistence", () => {
  it("writes the scope to ?sample= when enabled", () => {
    render(
      <ScopeDriver>
        <DemoModeBanner />
      </ScopeDriver>,
    );
    act(() => screen.getByTestId("enable-regional").click());
    expect(window.location.search).toContain("sample=regional");
  });

  it("clears ?sample= when disabled", () => {
    render(
      <ScopeDriver>
        <DemoModeBanner />
      </ScopeDriver>,
    );
    act(() => screen.getByTestId("enable-local").click());
    act(() => screen.getByTestId("disable").click());
    expect(window.location.search).not.toContain("sample=");
  });

  it("restores demo mode from ?sample=global on mount", () => {
    window.history.replaceState({}, "", "/?sample=global");
    render(
      <Providers>
        <DemoModeBanner />
      </Providers>,
    );
    const banner = screen.getByTestId("demo-mode-banner");
    expect(banner).toHaveAttribute("data-demo-state", "on");
    expect(banner).toHaveAttribute("data-demo-scope", "global");
  });
});

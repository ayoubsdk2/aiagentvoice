import { Building2, MapPin, Phone, Calendar, Layers, Info } from "lucide-react";
import { useCustomerTenant, type EnvMode } from "@/contexts/CustomerTenantContext";

/**
 * Persistent tenant context bar shown in the customer portal only.
 * Never rendered for internal operators (preserves the current internal layout).
 */
export function TenantContextBar() {
  const t = useCustomerTenant();
  const awaiting = t.isAwaitingSetup;

  return (
    <div className="border-b border-border/40 bg-card/40 backdrop-blur-xl">
      {awaiting && (
        <div className="flex items-start gap-2 px-4 md:px-6 py-2 border-b border-border/30 bg-primary/[0.06] text-[11px] text-muted-foreground">
          <Info size={12} className="text-primary mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold text-foreground">Awaiting go-live setup.</span>{" "}
            Organization, location, and phone-number selectors stay disabled until your
            real tenant data is connected. Toggle{" "}
            <span className="font-semibold text-foreground">View Sample Account</span>{" "}
            in the header to preview a fully populated dashboard.
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-2.5 text-xs">
        <ContextSelect
          icon={<Building2 size={12} />}
          label="Org"
          value={t.organization}
          onChange={t.setOrganization}
          options={t.organizations}
          disabled={awaiting}
          disabledHint="Connect your organization to enable"
        />
        <ContextSelect
          icon={<MapPin size={12} />}
          label="Location"
          value={t.location}
          onChange={t.setLocation}
          options={t.locations}
          disabled={awaiting}
          disabledHint="Add a location to enable"
        />
        <ContextSelect
          icon={<Phone size={12} />}
          label="Number"
          value={t.phoneNumber}
          onChange={t.setPhoneNumber}
          options={t.phoneNumbers}
          disabled={awaiting}
          disabledHint="Provision a phone number to enable"
        />
        <ContextSelect
          icon={<Calendar size={12} />}
          label="Range"
          value={t.timeRange}
          onChange={t.setTimeRange}
          options={t.timeRanges}
        />
        <ContextSelect
          icon={<Layers size={12} />}
          label="Env"
          value={t.environment}
          onChange={(v) => t.setEnvironment(v as EnvMode)}
          options={t.environments}
          accent={
            t.environment === "Production"
              ? "border-[hsl(var(--success))]/40 text-[hsl(var(--success))]"
              : t.environment === "Staging"
              ? "border-amber-500/40 text-amber-400"
              : "border-primary/40 text-primary"
          }
        />
      </div>
    </div>
  );
}


interface SelectProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  accent?: string;
  disabled?: boolean;
  disabledHint?: string;
}

function ContextSelect({ icon, label, value, onChange, options, accent, disabled, disabledHint }: SelectProps) {
  return (
    <label
      title={disabled ? disabledHint : undefined}
      className={`group inline-flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors ${
        disabled
          ? "bg-secondary/20 border-dashed border-border/40 text-muted-foreground/60 cursor-not-allowed"
          : `bg-secondary/40 hover:bg-secondary/60 ${accent ?? "border-border/50 text-muted-foreground"}`
      }`}
    >
      {icon}
      <span className="text-[10px] uppercase tracking-widest font-bold opacity-70">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={disabled && disabledHint ? `${label} — ${disabledHint}` : label}
        disabled={disabled}
        className="bg-transparent text-foreground text-xs font-semibold focus:outline-none cursor-pointer pr-1 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-background text-foreground">{o}</option>
        ))}
      </select>
    </label>
  );
}


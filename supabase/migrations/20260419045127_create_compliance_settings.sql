CREATE TABLE public.compliance_settings (
    customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
    ada_accessibility boolean NOT NULL DEFAULT false,
    audit_trail_logging boolean NOT NULL DEFAULT false,
    call_recording_consent_required boolean NOT NULL DEFAULT false,
    data_retention_hours integer NOT NULL DEFAULT 720,
    gdpr_minimization boolean NOT NULL DEFAULT false,
    hipaa_phi_redaction boolean NOT NULL DEFAULT false,
    opt_out_handling boolean NOT NULL DEFAULT false,
    pci_dss_billing boolean NOT NULL DEFAULT false,
    pii_scrubbing boolean NOT NULL DEFAULT false,
    prompt_injection_defense_enabled boolean NOT NULL DEFAULT false,
    tcpa_compliance boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.compliance_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_compliance_settings_updated_at
BEFORE UPDATE ON public.compliance_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

import type { SampleScope } from "@/contexts/DemoModeContext";

export interface KpiFixture {
  callsHandled: string;
  resolutionRate: string;
  avgHandleTime: string;
  qualifiedLeads: string;
  callsDelta: string;
  resolutionDelta: string;
  ahtDelta: string;
  leadsDelta: string;
}

export interface CallVolumePoint { day: string; inbound: number; outbound: number }
export interface IntentSlice { name: string; value: number; color: string }
export interface ResolutionPoint { hr: string; auto: number; escalated: number }
export interface TranscriptFixture {
  id: string;
  caller: string;
  intent: string;
  model: string;
  error: string | null;
  snippet: string;
  outcome: string;
  duration: string;
}
export interface LeadFixture {
  name: string;
  score: number;
  intent: string;
  value: string;
}
export interface IntegrationFixture { name: string; status: string; health: string }
export interface ComplianceFixture { name: string; status: string; tone: "ok" | "warn" }
export interface RoiFixture {
  laborHours: string;
  costAvoided: string;
  firstCallResolution: string;
  csat: string;
}

export interface SampleFixture {
  organization: string;
  organizations: string[];
  locations: string[];
  phoneNumbers: string[];
  kpis: KpiFixture;
  callVolume: CallVolumePoint[];
  intent: IntentSlice[];
  resolution: ResolutionPoint[];
  transcripts: TranscriptFixture[];
  leads: LeadFixture[];
  integrations: IntegrationFixture[];
  compliance: ComplianceFixture[];
  roi: RoiFixture;
}

const PURPLE = "hsl(270 70% 55%)";
const MUTED = "hsl(260 10% 50%)";
const LIGHT = "hsl(0 0% 96%)";

/* ============================ LOCAL — Central Florida ============================ */
const LOCAL: SampleFixture = {
  organization: "Suncoast Document Solutions",
  organizations: ["Suncoast Document Solutions"],
  locations: [
    "All locations",
    "Orlando HQ",
    "Lakeland Service Center",
    "Kissimmee Sales Office",
    "Sanford Logistics",
    "Winter Park Showroom",
  ],
  phoneNumbers: [
    "All numbers",
    "+1 (407) 555-0142",
    "+1 (321) 555-0188",
    "+1 (863) 555-0207",
    "+1 (407) 555-0311",
  ],
  kpis: {
    callsHandled: "118",
    resolutionRate: "87.4%",
    avgHandleTime: "2:58",
    qualifiedLeads: "9",
    callsDelta: "+12.6%",
    resolutionDelta: "+1.4pt",
    ahtDelta: "-8s",
    leadsDelta: "+3",
  },
  callVolume: [
    { day: "Mon", inbound: 22, outbound: 6 },
    { day: "Tue", inbound: 26, outbound: 7 },
    { day: "Wed", inbound: 19, outbound: 5 },
    { day: "Thu", inbound: 24, outbound: 8 },
    { day: "Fri", inbound: 28, outbound: 9 },
    { day: "Sat", inbound: 8, outbound: 1 },
    { day: "Sun", inbound: 4, outbound: 0 },
  ],
  intent: [
    { name: "Service", value: 52, color: PURPLE },
    { name: "Toner", value: 33, color: MUTED },
    { name: "Sales", value: 15, color: LIGHT },
  ],
  resolution: [
    { hr: "00", auto: 90, escalated: 10 },
    { hr: "04", auto: 88, escalated: 12 },
    { hr: "08", auto: 82, escalated: 18 },
    { hr: "12", auto: 85, escalated: 15 },
    { hr: "16", auto: 89, escalated: 11 },
    { hr: "20", auto: 93, escalated: 7 },
  ],
  transcripts: [
    {
      id: "TR-1042",
      caller: "+1 (407) 555-0188",
      intent: "Service",
      model: "Sharp MX-M365N",
      error: "SC542",
      snippet:
        "AdventHealth Orlando billing office reported a fuser jam. Phoebe walked through cooldown and dispatched a Lakeland tech for same-day service.",
      outcome: "Resolved",
      duration: "3:21",
    },
    {
      id: "TR-1041",
      caller: "+1 (321) 555-0233",
      intent: "Toner",
      model: "Sharp BP-70C45",
      error: null,
      snippet:
        "Rosen Hotels reorder for cyan and magenta toner. Phoebe confirmed Sanford warehouse stock and scheduled next-day delivery.",
      outcome: "Auto-fulfilled",
      duration: "1:12",
    },
    {
      id: "TR-1040",
      caller: "+1 (863) 555-0411",
      intent: "Sales",
      model: "Sharp MX-B455W",
      error: null,
      snippet:
        "UCF Burnett Honors College asked about lease renewal pricing for 4 units. Routed to Kissimmee sales rep with full call context.",
      outcome: "Lead created",
      duration: "4:42",
    },
  ],
  leads: [
    { name: "AdventHealth Orlando", score: 93, intent: "MX-M905 fleet (8 units)", value: "$58,400" },
    { name: "Rosen Hotels & Resorts", score: 88, intent: "Color MFP refresh", value: "$41,200" },
    { name: "UCF — Burnett Honors College", score: 82, intent: "Lease renewal (4 units)", value: "$22,800" },
    { name: "Publix HQ pilot", score: 79, intent: "ScanSnap rollout", value: "$18,650" },
    { name: "Orlando Magic front office", score: 71, intent: "Toner contract", value: "$9,300" },
  ],
  integrations: [
    { name: "Sharp ODMS", status: "Connected", health: "100%" },
    { name: "Salesforce", status: "Connected", health: "98%" },
    { name: "QuickBooks", status: "Connected", health: "97%" },
    { name: "eAutomate", status: "Available", health: "—" },
    { name: "ServiceNow", status: "Available", health: "—" },
    { name: "HubSpot", status: "Available", health: "—" },
  ],
  compliance: [
    { name: "HIPAA", status: "Active", tone: "ok" },
    { name: "PCI-DSS", status: "Active", tone: "ok" },
    { name: "TCPA", status: "Active", tone: "ok" },
    { name: "Florida Stat. §501", status: "Active", tone: "ok" },
    { name: "SOC 2 Type II", status: "Audit in progress", tone: "warn" },
  ],
  roi: {
    laborHours: "48 hrs",
    costAvoided: "$3,420",
    firstCallResolution: "87.4%",
    csat: "4.7 / 5",
  },
};

/* ============================ REGIONAL — Northeast USA ============================ */
const REGIONAL: SampleFixture = {
  organization: "Northeast MPS Alliance",
  organizations: ["Northeast MPS Alliance"],
  locations: [
    "All locations",
    "Boston, MA",
    "Providence, RI",
    "Hartford, CT",
    "New York, NY",
    "Newark, NJ",
    "Philadelphia, PA",
    "Pittsburgh, PA",
    "Albany, NY",
  ],
  phoneNumbers: [
    "All numbers",
    "+1 (617) 555-0240",
    "+1 (401) 555-0181",
    "+1 (860) 555-0299",
    "+1 (212) 555-0140",
    "+1 (973) 555-0322",
    "+1 (215) 555-0488",
    "+1 (412) 555-0511",
    "+1 (518) 555-0166",
  ],
  kpis: {
    callsHandled: "478",
    resolutionRate: "88.6%",
    avgHandleTime: "2:44",
    qualifiedLeads: "31",
    callsDelta: "+15.2%",
    resolutionDelta: "+2.0pt",
    ahtDelta: "-11s",
    leadsDelta: "+7",
  },
  callVolume: [
    { day: "Mon", inbound: 78, outbound: 18 },
    { day: "Tue", inbound: 92, outbound: 24 },
    { day: "Wed", inbound: 84, outbound: 21 },
    { day: "Thu", inbound: 101, outbound: 29 },
    { day: "Fri", inbound: 112, outbound: 33 },
    { day: "Sat", inbound: 38, outbound: 6 },
    { day: "Sun", inbound: 22, outbound: 3 },
  ],
  intent: [
    { name: "Service", value: 48, color: PURPLE },
    { name: "Toner", value: 28, color: MUTED },
    { name: "Sales", value: 24, color: LIGHT },
  ],
  resolution: [
    { hr: "00", auto: 91, escalated: 9 },
    { hr: "04", auto: 87, escalated: 13 },
    { hr: "08", auto: 80, escalated: 20 },
    { hr: "12", auto: 86, escalated: 14 },
    { hr: "16", auto: 91, escalated: 9 },
    { hr: "20", auto: 94, escalated: 6 },
  ],
  transcripts: [
    {
      id: "TR-3812",
      caller: "+1 (617) 555-0240",
      intent: "Service",
      model: "Konica bizhub C658",
      error: "J-12",
      snippet:
        "Mass General Brigham radiology reported paper jam J-12 with HIPAA-sensitive print queue. Phoebe verified queue purge, dispatched Boston-area tech.",
      outcome: "Resolved",
      duration: "4:08",
    },
    {
      id: "TR-3811",
      caller: "+1 (212) 555-0140",
      intent: "Sales",
      model: "Sharp MX-M6571",
      error: null,
      snippet:
        "NYU Langone procurement asked for service contract renewal pricing across 14 floors. Routed to NYC enterprise rep with full transcript.",
      outcome: "Lead created",
      duration: "5:32",
    },
    {
      id: "TR-3810",
      caller: "+1 (215) 555-0488",
      intent: "Service",
      model: "Ricoh IM C6500",
      error: "SC899",
      snippet:
        "Vanguard Malvern campus reported SC899 controller error. Phoebe escalated to PCI-cleared field engineer; chain-of-custody logged.",
      outcome: "Escalated",
      duration: "6:14",
    },
  ],
  leads: [
    { name: "Mass General Brigham", score: 95, intent: "HIPAA fleet refresh — 42 units", value: "$612,000" },
    { name: "NYU Langone Health", score: 91, intent: "5-year service contract", value: "$284,500" },
    { name: "JPMorgan Chase NJ campus", score: 87, intent: "PCI scanning rollout", value: "$198,400" },
    { name: "Carnegie Mellon University", score: 82, intent: "Lab printer refresh", value: "$74,200" },
    { name: "Vanguard Malvern", score: 80, intent: "Audit-grade compliance package", value: "$152,800" },
  ],
  integrations: [
    { name: "Sharp ODMS", status: "Connected", health: "100%" },
    { name: "Salesforce", status: "Connected", health: "99%" },
    { name: "ServiceNow", status: "Connected", health: "98%" },
    { name: "eAutomate", status: "Connected", health: "100%" },
    { name: "Continuum", status: "Connected", health: "97%" },
    { name: "QuickBooks", status: "Available", health: "—" },
  ],
  compliance: [
    { name: "HIPAA", status: "Active", tone: "ok" },
    { name: "PCI-DSS", status: "Active", tone: "ok" },
    { name: "TCPA", status: "Active", tone: "ok" },
    { name: "NY SHIELD Act", status: "Active", tone: "ok" },
    { name: "MA 201 CMR 17", status: "Active", tone: "ok" },
    { name: "SOC 2 Type II", status: "Audit in progress", tone: "warn" },
  ],
  roi: {
    laborHours: "192 hrs",
    costAvoided: "$13,440",
    firstCallResolution: "88.6%",
    csat: "4.8 / 5",
  },
};

/* ============================ NATIONAL — 10 US metros ============================ */
const NATIONAL: SampleFixture = {
  organization: "American Print Services Network",
  organizations: ["American Print Services Network"],
  locations: [
    "All locations",
    "New York, NY",
    "Los Angeles, CA",
    "Chicago, IL",
    "Houston, TX",
    "Phoenix, AZ",
    "Philadelphia, PA",
    "San Antonio, TX",
    "San Diego, CA",
    "Dallas, TX",
    "Austin, TX",
  ],
  phoneNumbers: [
    "All numbers",
    "+1 (800) 555-0100 (toll-free)",
    "+1 (212) 555-0140 — NYC",
    "+1 (213) 555-0220 — LA",
    "+1 (312) 555-0181 — Chicago",
    "+1 (713) 555-0244 — Houston",
    "+1 (602) 555-0316 — Phoenix",
    "+1 (215) 555-0488 — Philadelphia",
    "+1 (210) 555-0511 — San Antonio",
    "+1 (619) 555-0622 — San Diego",
    "+1 (214) 555-0733 — Dallas",
    "+1 (512) 555-0844 — Austin",
  ],
  kpis: {
    callsHandled: "1,842",
    resolutionRate: "89.1%",
    avgHandleTime: "2:39",
    qualifiedLeads: "104",
    callsDelta: "+19.8%",
    resolutionDelta: "+2.4pt",
    ahtDelta: "-14s",
    leadsDelta: "+22",
  },
  callVolume: [
    { day: "Mon", inbound: 268, outbound: 72 },
    { day: "Tue", inbound: 312, outbound: 91 },
    { day: "Wed", inbound: 289, outbound: 84 },
    { day: "Thu", inbound: 341, outbound: 108 },
    { day: "Fri", inbound: 384, outbound: 124 },
    { day: "Sat", inbound: 142, outbound: 28 },
    { day: "Sun", inbound: 106, outbound: 14 },
  ],
  intent: [
    { name: "Service", value: 46, color: PURPLE },
    { name: "Toner", value: 27, color: MUTED },
    { name: "Sales", value: 27, color: LIGHT },
  ],
  resolution: [
    { hr: "00", auto: 92, escalated: 8 },
    { hr: "04", auto: 88, escalated: 12 },
    { hr: "08", auto: 82, escalated: 18 },
    { hr: "12", auto: 87, escalated: 13 },
    { hr: "16", auto: 91, escalated: 9 },
    { hr: "20", auto: 94, escalated: 6 },
  ],
  transcripts: [
    {
      id: "TR-9442",
      caller: "+1 (214) 555-0733",
      intent: "Service",
      model: "Sharp MX-M5070",
      error: "U2-90",
      snippet:
        "American Airlines DFW kiosk #14 reported U2-90 transfer-belt error. Phoebe coordinated with onsite IT and dispatched same-day field tech.",
      outcome: "Resolved",
      duration: "4:51",
    },
    {
      id: "TR-9441",
      caller: "+1 (312) 555-0181",
      intent: "Sales",
      model: "Sharp BP-70M45",
      error: null,
      snippet:
        "Walmart Stores HQ procurement requested national fleet refresh proposal across 312 facilities. Routed to enterprise team with executive summary.",
      outcome: "Lead created",
      duration: "7:18",
    },
    {
      id: "TR-9440",
      caller: "+1 (213) 555-0220",
      intent: "Service",
      model: "Konica bizhub C750i",
      error: "C-2557",
      snippet:
        "Kaiser Permanente LA reported C-2557 fuser unit warning on HIPAA-cleared device. Phoebe queued preventive service ticket without exposing PHI.",
      outcome: "Resolved",
      duration: "3:44",
    },
  ],
  leads: [
    { name: "Walmart Stores HQ", score: 96, intent: "National fleet refresh — 312 sites", value: "$4.82M" },
    { name: "Kaiser Permanente", score: 94, intent: "HIPAA managed-print expansion", value: "$2.14M" },
    { name: "American Airlines (DFW)", score: 91, intent: "Airport kiosk printer rollout", value: "$1.38M" },
    { name: "CVS Health", score: 89, intent: "Pharmacy MFP standardization", value: "$1.92M" },
    { name: "Bank of America", score: 88, intent: "PCI-DSS scanning fleet", value: "$2.45M" },
    { name: "Lockheed Martin", score: 87, intent: "CMMC-compliant secure print", value: "$1.66M" },
    { name: "Marriott International", score: 84, intent: "Hospitality fleet contract", value: "$988,000" },
    { name: "Target Corporation", score: 82, intent: "Regional rollout — Midwest", value: "$1.12M" },
    { name: "GE Aviation", score: 80, intent: "Industrial print on shop floor", value: "$742,000" },
    { name: "Disney Parks Operations", score: 78, intent: "MX-M5070 fleet refresh", value: "$614,000" },
  ],
  integrations: [
    { name: "Sharp ODMS", status: "Connected", health: "100%" },
    { name: "Salesforce", status: "Connected", health: "99%" },
    { name: "ServiceNow", status: "Connected", health: "100%" },
    { name: "eAutomate", status: "Connected", health: "98%" },
    { name: "NetSuite", status: "Connected", health: "97%" },
    { name: "Workday", status: "Connected", health: "99%" },
    { name: "QuickBooks", status: "Connected", health: "97%" },
    { name: "HubSpot", status: "Available", health: "—" },
  ],
  compliance: [
    { name: "HIPAA", status: "Active", tone: "ok" },
    { name: "PCI-DSS", status: "Active", tone: "ok" },
    { name: "TCPA", status: "Active", tone: "ok" },
    { name: "CCPA / CPRA", status: "Active", tone: "ok" },
    { name: "CMMC L2", status: "Active", tone: "ok" },
    { name: "SOC 2 Type II", status: "Audit in progress", tone: "warn" },
  ],
  roi: {
    laborHours: "742 hrs",
    costAvoided: "$51,940",
    firstCallResolution: "89.1%",
    csat: "4.8 / 5",
  },
};

/* ============================ GLOBAL — 10 countries ============================ */
const GLOBAL: SampleFixture = {
  organization: "Phaos Global Managed Print",
  organizations: ["Phaos Global Managed Print"],
  locations: [
    "All locations",
    "USA — New York HQ",
    "United Kingdom — London",
    "Germany — Frankfurt",
    "France — Paris",
    "Japan — Tokyo",
    "Australia — Sydney",
    "Canada — Toronto",
    "Brazil — São Paulo",
    "United Arab Emirates — Dubai",
    "Singapore",
  ],
  phoneNumbers: [
    "All numbers",
    "+1 (212) 555-0140 — New York",
    "+44 20 7946 0188 — London",
    "+49 69 1234 5678 — Frankfurt",
    "+33 1 70 18 29 88 — Paris",
    "+81 3 4567 8901 — Tokyo",
    "+61 2 8001 4422 — Sydney",
    "+1 (416) 555-0277 — Toronto",
    "+55 11 4002 8922 — São Paulo",
    "+971 4 555 0166 — Dubai",
    "+65 6555 0188 — Singapore",
  ],
  kpis: {
    callsHandled: "6,214",
    resolutionRate: "90.3%",
    avgHandleTime: "2:31",
    qualifiedLeads: "318",
    callsDelta: "+24.6%",
    resolutionDelta: "+3.1pt",
    ahtDelta: "-19s",
    leadsDelta: "+58",
  },
  callVolume: [
    { day: "Mon", inbound: 902, outbound: 244 },
    { day: "Tue", inbound: 1024, outbound: 312 },
    { day: "Wed", inbound: 988, outbound: 298 },
    { day: "Thu", inbound: 1142, outbound: 366 },
    { day: "Fri", inbound: 1268, outbound: 412 },
    { day: "Sat", inbound: 552, outbound: 118 },
    { day: "Sun", inbound: 338, outbound: 64 },
  ],
  intent: [
    { name: "Service", value: 44, color: PURPLE },
    { name: "Toner / Supplies", value: 26, color: MUTED },
    { name: "Sales / Renewal", value: 30, color: LIGHT },
  ],
  resolution: [
    { hr: "00", auto: 93, escalated: 7 },
    { hr: "04", auto: 90, escalated: 10 },
    { hr: "08", auto: 85, escalated: 15 },
    { hr: "12", auto: 88, escalated: 12 },
    { hr: "16", auto: 92, escalated: 8 },
    { hr: "20", auto: 95, escalated: 5 },
  ],
  transcripts: [
    {
      id: "TR-22841",
      caller: "+44 20 7946 0188",
      intent: "Service",
      model: "Sharp MX-M6571",
      error: "E7-10",
      snippet:
        "HSBC Canary Wharf reported E7-10 LSU error. Phoebe handled in English, scheduled London-based field engineer, logged GDPR-compliant ticket.",
      outcome: "Resolved",
      duration: "3:58",
    },
    {
      id: "TR-22840",
      caller: "+81 3 4567 8901",
      intent: "Sales",
      model: "Sharp BP-50C55",
      error: null,
      snippet:
        "Toyota Motor Corp Aichi plant requested factory-floor MFP refresh quote in Japanese. Phoebe handed off to Tokyo enterprise team with translated summary.",
      outcome: "Lead created",
      duration: "6:02",
    },
    {
      id: "TR-22839",
      caller: "+49 69 1234 5678",
      intent: "Service",
      model: "Konica bizhub C750i",
      error: "C-E001",
      snippet:
        "Siemens Frankfurt reported C-E001 firmware mismatch on Industry 4.0 line. Phoebe coordinated remote firmware push within DSGVO retention window.",
      outcome: "Resolved",
      duration: "5:21",
    },
  ],
  leads: [
    { name: "HSBC Holdings (London)", score: 97, intent: "Global fleet contract — 84 sites", value: "$6.92M" },
    { name: "Siemens AG (Frankfurt)", score: 95, intent: "Industry 4.0 plant-floor print", value: "$4.18M" },
    { name: "L'Oréal Group (Paris)", score: 92, intent: "Luxury retail kiosk fleet", value: "$2.84M" },
    { name: "Toyota Motor Corp (Tokyo)", score: 92, intent: "Manufacturing-floor MFP refresh", value: "$3.66M" },
    { name: "Commonwealth Bank (Sydney)", score: 89, intent: "Branch secure-print rollout", value: "$1.94M" },
    { name: "RBC Royal Bank (Toronto)", score: 88, intent: "Canadian branch fleet refresh", value: "$2.08M" },
    { name: "Petrobras (São Paulo)", score: 85, intent: "Ruggedized oilfield print", value: "$1.42M" },
    { name: "Emirates Group (Dubai)", score: 84, intent: "Airport ground-ops print", value: "$1.71M" },
    { name: "DBS Bank (Singapore)", score: 82, intent: "APAC HQ fleet standardization", value: "$1.55M" },
    { name: "Pfizer Global (NYC)", score: 81, intent: "GxP-compliant lab print", value: "$2.22M" },
  ],
  integrations: [
    { name: "Sharp ODMS", status: "Connected", health: "100%" },
    { name: "Salesforce", status: "Connected", health: "99%" },
    { name: "ServiceNow", status: "Connected", health: "100%" },
    { name: "SAP S/4HANA", status: "Connected", health: "98%" },
    { name: "Oracle ERP Cloud", status: "Connected", health: "97%" },
    { name: "Workday", status: "Connected", health: "99%" },
    { name: "ServiceMax", status: "Connected", health: "98%" },
    { name: "Coupa", status: "Connected", health: "97%" },
  ],
  compliance: [
    { name: "HIPAA (US)", status: "Active", tone: "ok" },
    { name: "PCI-DSS", status: "Active", tone: "ok" },
    { name: "GDPR (EU)", status: "Active", tone: "ok" },
    { name: "UK Data Protection Act", status: "Active", tone: "ok" },
    { name: "APPI (Japan)", status: "Active", tone: "ok" },
    { name: "LGPD (Brazil)", status: "Active", tone: "ok" },
    { name: "PIPEDA (Canada)", status: "Active", tone: "ok" },
    { name: "Australian Privacy Act", status: "Active", tone: "ok" },
    { name: "PDPA (Singapore)", status: "Active", tone: "ok" },
    { name: "ISO 27001", status: "Certified", tone: "ok" },
    { name: "SOC 2 Type II", status: "Audit in progress", tone: "warn" },
  ],
  roi: {
    laborHours: "2,484 hrs",
    costAvoided: "$184,260",
    firstCallResolution: "90.3%",
    csat: "4.9 / 5",
  },
};

const FIXTURES: Record<SampleScope, SampleFixture> = {
  local: LOCAL,
  regional: REGIONAL,
  national: NATIONAL,
  global: GLOBAL,
};

export function getFixture(scope: SampleScope): SampleFixture {
  return FIXTURES[scope];
}

const TIME_RANGES = ["Today", "This Week", "Last 7 Days", "Last 30 Days", "Last 90 Days", "This Year"];
export const SAMPLE_TIME_RANGES = TIME_RANGES;

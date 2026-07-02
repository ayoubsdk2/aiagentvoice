/**
 * Sharp MFP Knowledge Base — Local Constants
 * Differentiates BP-70C series vs MX series for finishers, paper capacity,
 * speed, toner yield, and other technical specifications.
 */

export interface MfpSpec {
  model: string;
  series: "BP-70C" | "MX";
  ppmBw: number;
  ppmColor: number;
  tonerYieldBw: number;
  tonerYieldColor: number;
  maxPaperCapacity: number;
  standardPaperCapacity: number;
  maxSubstrateGsm: number;
  minSubstrateGsm: number;
  duplexStandard: boolean;
  finisherOptions: string[];
  monthlyDutyMax: number;
  recommendedVolume: string;
  resolution: string;
  connectivity: string[];
  features: string[];
}

export const SHARP_MFP_DATABASE: Record<string, MfpSpec> = {
  // ─── BP-70C Series ───────────────────────────────────
  "BP-70C65": {
    model: "BP-70C65",
    series: "BP-70C",
    ppmBw: 65,
    ppmColor: 65,
    tonerYieldBw: 40000,
    tonerYieldColor: 24000,
    maxPaperCapacity: 6300,
    standardPaperCapacity: 650,
    maxSubstrateGsm: 300,
    minSubstrateGsm: 52,
    duplexStandard: true,
    finisherOptions: [
      "Inner Finisher",
      "Staple/Stacker Finisher (MX-FN31)",
      "Saddle Stitch Finisher (MX-FN32)",
      "Inner 2/3 Hole Punch (MX-PN14)",
    ],
    monthlyDutyMax: 350000,
    recommendedVolume: "15,000–50,000 clicks/month",
    resolution: "1200 x 1200 dpi",
    connectivity: ["Ethernet", "USB 3.0", "Wi-Fi (optional)", "NFC"],
    features: ["Retractable Keyboard", "10.1\" Touchscreen", "Sharp OSA 5.5", "Fiery Controller (optional)"],
  },
  "BP-70C55": {
    model: "BP-70C55",
    series: "BP-70C",
    ppmBw: 55,
    ppmColor: 55,
    tonerYieldBw: 40000,
    tonerYieldColor: 24000,
    maxPaperCapacity: 6300,
    standardPaperCapacity: 650,
    maxSubstrateGsm: 300,
    minSubstrateGsm: 52,
    duplexStandard: true,
    finisherOptions: [
      "Inner Finisher",
      "Staple/Stacker Finisher (MX-FN31)",
      "Saddle Stitch Finisher (MX-FN32)",
      "Inner 2/3 Hole Punch (MX-PN14)",
    ],
    monthlyDutyMax: 300000,
    recommendedVolume: "10,000–40,000 clicks/month",
    resolution: "1200 x 1200 dpi",
    connectivity: ["Ethernet", "USB 3.0", "Wi-Fi (optional)", "NFC"],
    features: ["Retractable Keyboard", "10.1\" Touchscreen", "Sharp OSA 5.5"],
  },
  "BP-70C45": {
    model: "BP-70C45",
    series: "BP-70C",
    ppmBw: 45,
    ppmColor: 45,
    tonerYieldBw: 40000,
    tonerYieldColor: 24000,
    maxPaperCapacity: 6300,
    standardPaperCapacity: 650,
    maxSubstrateGsm: 300,
    minSubstrateGsm: 52,
    duplexStandard: true,
    finisherOptions: [
      "Inner Finisher",
      "Staple/Stacker Finisher (MX-FN31)",
      "Saddle Stitch Finisher (MX-FN32)",
    ],
    monthlyDutyMax: 250000,
    recommendedVolume: "5,000–30,000 clicks/month",
    resolution: "1200 x 1200 dpi",
    connectivity: ["Ethernet", "USB 3.0", "Wi-Fi (optional)", "NFC"],
    features: ["10.1\" Touchscreen", "Sharp OSA 5.5"],
  },
  "BP-70C36": {
    model: "BP-70C36",
    series: "BP-70C",
    ppmBw: 36,
    ppmColor: 36,
    tonerYieldBw: 40000,
    tonerYieldColor: 24000,
    maxPaperCapacity: 6300,
    standardPaperCapacity: 650,
    maxSubstrateGsm: 256,
    minSubstrateGsm: 55,
    duplexStandard: true,
    finisherOptions: [
      "Inner Finisher",
      "Staple/Stacker Finisher (MX-FN31)",
    ],
    monthlyDutyMax: 200000,
    recommendedVolume: "3,000–20,000 clicks/month",
    resolution: "1200 x 1200 dpi",
    connectivity: ["Ethernet", "USB 3.0", "Wi-Fi (optional)"],
    features: ["10.1\" Touchscreen", "Sharp OSA 5.5"],
  },

  // ─── MX Series ───────────────────────────────────────
  "MX-6071": {
    model: "MX-6071",
    series: "MX",
    ppmBw: 60,
    ppmColor: 60,
    tonerYieldBw: 40000,
    tonerYieldColor: 24000,
    maxPaperCapacity: 6600,
    standardPaperCapacity: 1200,
    maxSubstrateGsm: 300,
    minSubstrateGsm: 52,
    duplexStandard: true,
    finisherOptions: [
      "Inner Finisher (MX-FN27)",
      "Finisher (MX-FN28)",
      "Saddle Stitch Finisher (MX-FN29)",
      "3-Hole Punch Unit",
      "Inserter (MX-RB26)",
    ],
    monthlyDutyMax: 350000,
    recommendedVolume: "15,000–50,000 clicks/month",
    resolution: "1200 x 1200 dpi",
    connectivity: ["Ethernet", "USB 3.0", "Wi-Fi", "Bluetooth", "NFC"],
    features: ["15.4\" Touchscreen", "Sharp OSA 5.5", "Fiery Controller (optional)", "Multi-fold Unit"],
  },
  "MX-5071": {
    model: "MX-5071",
    series: "MX",
    ppmBw: 50,
    ppmColor: 50,
    tonerYieldBw: 40000,
    tonerYieldColor: 24000,
    maxPaperCapacity: 6600,
    standardPaperCapacity: 1200,
    maxSubstrateGsm: 300,
    minSubstrateGsm: 52,
    duplexStandard: true,
    finisherOptions: [
      "Inner Finisher (MX-FN27)",
      "Finisher (MX-FN28)",
      "Saddle Stitch Finisher (MX-FN29)",
      "3-Hole Punch Unit",
    ],
    monthlyDutyMax: 300000,
    recommendedVolume: "10,000–40,000 clicks/month",
    resolution: "1200 x 1200 dpi",
    connectivity: ["Ethernet", "USB 3.0", "Wi-Fi", "Bluetooth", "NFC"],
    features: ["15.4\" Touchscreen", "Sharp OSA 5.5"],
  },
  "MX-4071": {
    model: "MX-4071",
    series: "MX",
    ppmBw: 40,
    ppmColor: 40,
    tonerYieldBw: 40000,
    tonerYieldColor: 24000,
    maxPaperCapacity: 6600,
    standardPaperCapacity: 1200,
    maxSubstrateGsm: 256,
    minSubstrateGsm: 55,
    duplexStandard: true,
    finisherOptions: [
      "Inner Finisher (MX-FN27)",
      "Finisher (MX-FN28)",
      "Saddle Stitch Finisher (MX-FN29)",
    ],
    monthlyDutyMax: 250000,
    recommendedVolume: "5,000–25,000 clicks/month",
    resolution: "1200 x 1200 dpi",
    connectivity: ["Ethernet", "USB 3.0", "Wi-Fi"],
    features: ["10.1\" Touchscreen", "Sharp OSA 5.5"],
  },
  "MX-3071": {
    model: "MX-3071",
    series: "MX",
    ppmBw: 30,
    ppmColor: 30,
    tonerYieldBw: 27500,
    tonerYieldColor: 15000,
    maxPaperCapacity: 6300,
    standardPaperCapacity: 650,
    maxSubstrateGsm: 256,
    minSubstrateGsm: 55,
    duplexStandard: true,
    finisherOptions: [
      "Inner Finisher (MX-FN27)",
      "Finisher (MX-FN28)",
    ],
    monthlyDutyMax: 150000,
    recommendedVolume: "2,000–15,000 clicks/month",
    resolution: "1200 x 1200 dpi",
    connectivity: ["Ethernet", "USB 3.0", "Wi-Fi"],
    features: ["10.1\" Touchscreen", "Sharp OSA 5.5"],
  },
  "MX-2651": {
    model: "MX-2651",
    series: "MX",
    ppmBw: 26,
    ppmColor: 26,
    tonerYieldBw: 27500,
    tonerYieldColor: 15000,
    maxPaperCapacity: 3100,
    standardPaperCapacity: 650,
    maxSubstrateGsm: 220,
    minSubstrateGsm: 55,
    duplexStandard: true,
    finisherOptions: [
      "Inner Finisher",
    ],
    monthlyDutyMax: 100000,
    recommendedVolume: "1,000–10,000 clicks/month",
    resolution: "600 x 600 dpi",
    connectivity: ["Ethernet", "USB 3.0", "Wi-Fi (optional)"],
    features: ["10.1\" Touchscreen", "Sharp OSA 5.5"],
  },
};

/**
 * Industry terminology glossary — maps common terms to their
 * correct industry-standard equivalents for contextual correction.
 */
export const INDUSTRY_TERMINOLOGY: Record<string, { term: string; definition: string }> = {
  substrate: {
    term: "Substrate",
    definition: "The material (paper, card stock, label, etc.) being printed on. Measured in GSM.",
  },
  gsm: {
    term: "GSM (Grams per Square Meter)",
    definition: "Weight measurement for substrate thickness. Standard copy paper is 75–80 GSM; card stock is 200+ GSM.",
  },
  click_rate: {
    term: "Click Rate (Cost per Click / CPC)",
    definition: "The per-page cost charged under a managed print contract. Includes toner, parts, and service.",
  },
  duty_cycle: {
    term: "Duty Cycle",
    definition: "Maximum pages per month the device can handle without accelerated wear. Not the recommended volume.",
  },
  ppm: {
    term: "PPM (Pages Per Minute)",
    definition: "Rated output speed measured in A4/Letter pages per minute under standard test conditions.",
  },
  toner_yield: {
    term: "Toner Yield",
    definition: "Estimated page count per cartridge at 5% average coverage (ISO/IEC 19798 standard).",
  },
  finisher: {
    term: "Finisher",
    definition: "Post-processing attachment for stapling, hole-punching, booklet-making, or saddle-stitching.",
  },
  adf: {
    term: "ADF (Auto Document Feeder)",
    definition: "Feeds multi-page originals automatically for scanning/copying. DSPF = Duplex Single Pass Feeder.",
  },
  osa: {
    term: "OSA (Open Systems Architecture)",
    definition: "Sharp's platform for third-party application integration directly on the MFP touchscreen.",
  },
  fiery: {
    term: "Fiery Controller",
    definition: "High-end RIP (Raster Image Processor) for color-critical environments and production print workflows.",
  },
  rip: {
    term: "RIP (Raster Image Processor)",
    definition: "Converts page description language (PostScript, PDF) into raster images for printing.",
  },
  pcl: {
    term: "PCL (Printer Command Language)",
    definition: "HP-originated page description language widely supported across MFPs. PCL6 is the current standard.",
  },
  postscript: {
    term: "PostScript (PS)",
    definition: "Adobe page description language. PS3 is the standard for graphic-arts quality output.",
  },
};

/**
 * Detect Sharp MFP model mentions in text.
 * Returns matching specs for all models found.
 */
export function detectMfpModels(text: string): MfpSpec[] {
  const upper = text.toUpperCase();
  const found: MfpSpec[] = [];

  for (const [key, spec] of Object.entries(SHARP_MFP_DATABASE)) {
    if (upper.includes(key.toUpperCase()) || upper.includes(key.replace("-", "").toUpperCase())) {
      found.push(spec);
    }
  }

  // Fuzzy match series references
  if (found.length === 0) {
    if (upper.includes("BP-70C") || upper.includes("BP70C")) {
      found.push(SHARP_MFP_DATABASE["BP-70C65"]);
    }
    if (upper.includes("MX-60") || upper.includes("MX60")) {
      found.push(SHARP_MFP_DATABASE["MX-6071"]);
    }
    if (upper.includes("MX-50") || upper.includes("MX50")) {
      found.push(SHARP_MFP_DATABASE["MX-5071"]);
    }
    if (upper.includes("MX-40") || upper.includes("MX40")) {
      found.push(SHARP_MFP_DATABASE["MX-4071"]);
    }
    if (upper.includes("MX-30") || upper.includes("MX30")) {
      found.push(SHARP_MFP_DATABASE["MX-3071"]);
    }
  }

  return found;
}

/**
 * Detect industry terminology used in text.
 * Returns relevant glossary entries.
 */
export function detectTerminology(text: string): Array<{ term: string; definition: string }> {
  const lower = text.toLowerCase();
  const found: Array<{ term: string; definition: string }> = [];

  const termKeywords: Record<string, string[]> = {
    substrate: ["substrate", "paper type", "media type", "card stock", "label stock"],
    gsm: ["gsm", "grams per square", "paper weight", "media weight"],
    click_rate: ["click rate", "cost per click", "cpc", "cost per page", "price per page"],
    duty_cycle: ["duty cycle", "monthly duty", "max pages"],
    ppm: ["ppm", "pages per minute", "print speed", "speed"],
    toner_yield: ["toner yield", "cartridge yield", "page yield", "toner life"],
    finisher: ["finisher", "stapler", "saddle stitch", "booklet maker", "hole punch"],
    adf: ["adf", "document feeder", "dspf", "auto feeder"],
  };

  for (const [key, keywords] of Object.entries(termKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      const entry = INDUSTRY_TERMINOLOGY[key];
      if (entry) found.push(entry);
    }
  }

  return found;
}

/**
 * Format spec summary for display in the Audit Trail.
 */
export function formatSpecSummary(spec: MfpSpec): string[] {
  return [
    `MODEL: ${spec.model} (${spec.series} Series)`,
    `PPM: ${spec.ppmBw} BW / ${spec.ppmColor} Color`,
    `TONER YIELD: ${spec.tonerYieldBw.toLocaleString()} BW / ${spec.tonerYieldColor.toLocaleString()} Color`,
    `PAPER: ${spec.standardPaperCapacity} std → ${spec.maxPaperCapacity.toLocaleString()} max`,
    `SUBSTRATE: ${spec.minSubstrateGsm}–${spec.maxSubstrateGsm} GSM`,
    `FINISHERS: ${spec.finisherOptions.length} options available`,
    `DUTY: ${spec.monthlyDutyMax.toLocaleString()} pages/month`,
  ];
}

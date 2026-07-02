/**
 * Tiny linear-regression forecast utility for KPI projection.
 * Pure function, no external math deps.
 */

export interface ForecastPoint {
  x: number; // sequential index
  y: number;
}

export interface ForecastResult {
  slope: number;
  intercept: number;
  r2: number;
  /** y predicted for x = lastX + steps */
  predict: (steps: number) => number;
}

export function linearForecast(points: ForecastPoint[]): ForecastResult | null {
  if (points.length < 2) return null;
  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssTot = points.reduce((a, p) => a + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((a, p) => a + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  const lastX = Math.max(...points.map((p) => p.x));
  return {
    slope,
    intercept,
    r2,
    predict: (steps: number) => slope * (lastX + steps) + intercept,
  };
}

/** Public industry benchmarks for contact-center / voice-AI workloads (2024 medians). */
export const INDUSTRY_BENCHMARKS = {
  /** Source: Metrigy 2024 AI for CX study — median IVA/voicebot self-service rate. */
  voiceAiDeflectionRate: 0.45,
  /** Source: ICMI 2024 contact-center benchmark — median first-contact resolution. */
  firstContactResolutionRate: 0.74,
  /** Source: Talkdesk 2024 benchmark — median average handle time (sec) for service calls. */
  avgHandleTimeSec: 360,
  /** Source: Forrester 2024 — median fully-loaded human agent cost per minute (USD). */
  humanAgentCostPerMinUsd: 1.1,
} as const;

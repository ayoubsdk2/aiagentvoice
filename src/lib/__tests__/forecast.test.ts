import { describe, it, expect } from "vitest";
import { linearForecast, INDUSTRY_BENCHMARKS } from "@/lib/forecast";

describe("linearForecast", () => {
  it("returns null for <2 points", () => {
    expect(linearForecast([])).toBeNull();
    expect(linearForecast([{ x: 0, y: 1 }])).toBeNull();
  });
  it("recovers a perfect line", () => {
    const r = linearForecast([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ])!;
    expect(r.slope).toBeCloseTo(2, 6);
    expect(r.intercept).toBeCloseTo(1, 6);
    expect(r.r2).toBeCloseTo(1, 6);
    expect(r.predict(1)).toBeCloseTo(9, 6);
  });
});

describe("INDUSTRY_BENCHMARKS", () => {
  it("exposes finite numeric medians", () => {
    expect(Number.isFinite(INDUSTRY_BENCHMARKS.voiceAiDeflectionRate)).toBe(true);
    expect(INDUSTRY_BENCHMARKS.avgHandleTimeSec).toBeGreaterThan(0);
  });
});

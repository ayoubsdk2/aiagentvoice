import { describe, it, expect } from "vitest";
import { rowsToCsv } from "@/lib/csv-export";

describe("rowsToCsv", () => {
  it("returns empty string for empty input", () => {
    expect(rowsToCsv([])).toBe("");
  });
  it("quotes every cell and escapes quotes", () => {
    const csv = rowsToCsv([{ a: 'he said "hi"', b: 1 }]);
    expect(csv.split("\n")[0]).toBe('"a","b"');
    expect(csv.split("\n")[1]).toBe('"he said ""hi""","1"');
  });
  it("respects column order", () => {
    const csv = rowsToCsv([{ a: 1, b: 2 }], ["b", "a"]);
    expect(csv.split("\n")[0]).toBe('"b","a"');
  });
  it("handles null/undefined as empty cells", () => {
    const csv = rowsToCsv([{ a: null, b: undefined }]);
    expect(csv.split("\n")[1]).toBe('"",""');
  });
});

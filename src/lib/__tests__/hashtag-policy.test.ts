import { describe, it, expect } from "vitest";
import { enforceHashtags } from "../content-lab/hashtagPolicy";

describe("enforceHashtags", () => {
  it("LinkedIn: pads under-tagged hooks to exactly 3 with category-aware fallbacks", () => {
    const out = enforceHashtags(
      "Toner waste is killing your margins. Here is the fix.",
      "linkedin",
      "Industry (Standard Tech/MPS)",
    );
    expect(out.tagsApplied).toHaveLength(3);
    expect(out.text.match(/#[A-Za-z0-9_]+/g)).toHaveLength(3);
    expect(out.text).toContain("#ManagedPrint");
  });

  it("LinkedIn: trims over-tagged hooks down to exactly 3, preserving order", () => {
    const out = enforceHashtags(
      "Print fleets are hard. #ManagedPrint #MPS #AIAutomation #PrintOps #FieldService",
      "linkedin",
      "Industry (Standard Tech/MPS)",
    );
    expect(out.tagsApplied).toEqual(["#ManagedPrint", "#MPS", "#AIAutomation"]);
    expect(out.text.match(/#[A-Za-z0-9_]+/g)).toHaveLength(3);
  });

  it("LinkedIn: respects 180-char limit by trimming the body, not the tags", () => {
    const longBody =
      "This is a very long LinkedIn opener that goes on and on about all the operational headaches of running a multi-site print fleet across many cities and time zones with weekly reviews and quarterly business reviews.";
    const out = enforceHashtags(longBody, "linkedin", "Industry", 180);
    expect(out.text.length).toBeLessThanOrEqual(180);
    expect(out.text.match(/#[A-Za-z0-9_]+/g)).toHaveLength(3);
  });

  it("Facebook: enforces exactly 2 tags", () => {
    const out = enforceHashtags(
      "How do you keep your team motivated through a transformation?",
      "facebook",
      "Leadership (Management/Culture)",
    );
    expect(out.tagsApplied).toHaveLength(2);
    expect(out.text.match(/#[A-Za-z0-9_]+/g)).toHaveLength(2);
    expect(out.text).toContain("#Leadership");
  });

  it("Faith category gets reverent fallback tags, not generic industry ones", () => {
    const out = enforceHashtags(
      "Stewardship is a quiet discipline.",
      "linkedin",
      "Faith (Theology/Values)",
    );
    expect(out.tagsApplied).toContain("#FaithAtWork");
    expect(out.tagsApplied).not.toContain("#ManagedPrint");
  });

  it("Blog: strips ALL hashtags, leaves body clean", () => {
    const out = enforceHashtags(
      "## Intro\n\nFleets are hard #ManagedPrint #MPS\n\n## Body\n\nMore text #PrintOps",
      "blog",
      "Industry",
    );
    expect(out.tagsApplied).toEqual([]);
    expect(out.text.match(/#[A-Za-z0-9_]+/g)).toBeNull();
    expect(out.text).toContain("Intro");
    expect(out.text).toContain("Body");
  });

  it("LinkedIn: deduplicates case-insensitive duplicates from the model", () => {
    const out = enforceHashtags(
      "Quick take. #ManagedPrint #managedprint #MPS",
      "linkedin",
      "Industry",
    );
    // 2 unique → padded to 3
    expect(out.tagsApplied).toHaveLength(3);
    const lower = out.tagsApplied.map((t) => t.toLowerCase());
    expect(new Set(lower).size).toBe(3);
  });
});

import { describe, expect, it } from "vitest";
import { getSlotSummary, getStatusLabel } from "@/lib/content-lab/scheduler";

describe("content scheduler presentation helpers", () => {
  it("recognizes weekday LinkedIn morning slots", () => {
    const slot = getSlotSummary("2026-04-27T12:00:00.000Z");
    expect(slot?.code).toBe("linkedin_0800_a");
    expect(slot?.platform).toBe("linkedin");
  });

  it("maps status labels clearly", () => {
    expect(getStatusLabel({
      id: "1",
      title: "Post",
      scheduled_at: null,
      category: "A",
      status: "draft",
      linkedin_hook: null,
      facebook_body: null,
      blog_body: null,
    })).toBe("Generated");

    expect(getStatusLabel({
      id: "2",
      title: "Post",
      scheduled_at: null,
      category: "A",
      status: "scheduled",
      linkedin_hook: null,
      facebook_body: null,
      blog_body: null,
    })).toBe("Scheduled");
  });
});

import { describe, it, expect } from "vitest";
import { cleanTextForTTS } from "@/lib/sanitize-tts";

describe("cleanTextForTTS", () => {
  it("strips headers", () => {
    expect(cleanTextForTTS("# Hello\n## World")).toBe("Hello. World");
  });
  it("strips bold and italic", () => {
    expect(cleanTextForTTS("This is **bold** and _italic_")).toBe("This is bold and italic");
  });
  it("strips inline code and code blocks", () => {
    expect(cleanTextForTTS("Use `npm i` here")).toBe("Use npm i here");
    expect(cleanTextForTTS("before\n```\ncode\n```\nafter")).toContain("before");
    expect(cleanTextForTTS("before\n```\ncode\n```\nafter")).toContain("after");
  });
  it("strips link syntax keeping text", () => {
    expect(cleanTextForTTS("see [docs](https://x.io) now")).toBe("see docs now");
  });
  it("strips bullet markers", () => {
    expect(cleanTextForTTS("- one\n- two")).toBe("one. two");
  });
  it("strips numbered list markers", () => {
    expect(cleanTextForTTS("1. one\n2. two")).toBe("one. two");
  });
  it("collapses whitespace", () => {
    expect(cleanTextForTTS("a    b   c")).toBe("a b c");
  });
});

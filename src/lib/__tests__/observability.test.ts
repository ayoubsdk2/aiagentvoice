import { describe, it, expect } from "vitest";
import { tracer, startSpan } from "@/lib/observability";

describe("observability", () => {
  it("module loads without throwing when OTLP endpoint is unset", () => {
    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe("function");
  });

  it("startSpan returns an end() callback that is safe to call", () => {
    const end = startSpan("test.span", { foo: "bar", count: 1, flag: true });
    expect(typeof end).toBe("function");
    expect(() => end()).not.toThrow();
  });

  it("startSpan accepts undefined attribute values without error", () => {
    const end = startSpan("test.span.optional", { defined: "yes", missing: undefined });
    expect(() => end()).not.toThrow();
  });

  it("end(err) records the error path without throwing", () => {
    const end = startSpan("test.span.err");
    expect(() => end(new Error("boom"))).not.toThrow();
  });

  it("tracer.startSpan can be used directly and ended", () => {
    const span = tracer.startSpan("direct.span");
    span.setAttribute("k", "v");
    expect(() => span.end()).not.toThrow();
  });
});

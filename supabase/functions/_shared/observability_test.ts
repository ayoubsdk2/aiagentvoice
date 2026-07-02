import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { startSpan } from "./observability.ts";

Deno.test("startSpan is a no-op when OTEL_EXPORTER_OTLP_ENDPOINT is unset", async () => {
  // No endpoint configured in test env; should resolve without throwing
  const end = startSpan("test.op", { foo: "bar", n: 42, b: true });
  await end();
  assert(true);
});

Deno.test("startSpan end is idempotent", async () => {
  const end = startSpan("test.idem");
  await end();
  await end(); // second call is a no-op
  assert(true);
});

Deno.test("startSpan accepts error and resolves", async () => {
  const end = startSpan("test.err");
  await end(new Error("boom"));
  assertEquals(true, true);
});

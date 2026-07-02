/**
 * Deno tests for the integration test runner. Network calls are stubbed via
 * a global fetch mock so tests run offline.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runIntegrationTest, REQUIRED_FIELDS } from "./integration-tests.ts";

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return Promise.resolve(handler(url, init));
  }) as typeof fetch;
}

function restoreFetch() { globalThis.fetch = originalFetch; }

Deno.test("telnyx: missing api_key fails", async () => {
  const r = await runIntegrationTest("telnyx", {});
  assertEquals(r.ok, false);
  assert(r.message?.includes("api_key"));
});

Deno.test("telnyx: 200 → ok", async () => {
  mockFetch(() => new Response(JSON.stringify({ data: [] }), { status: 200 }));
  try {
    const r = await runIntegrationTest("telnyx", { api_key: "KEY" });
    assertEquals(r.ok, true);
  } finally { restoreFetch(); }
});

Deno.test("telnyx: 401 → invalid key", async () => {
  mockFetch(() => new Response("nope", { status: 401 }));
  try {
    const r = await runIntegrationTest("telnyx", { api_key: "BAD" });
    assertEquals(r.ok, false);
    assert(r.message?.toLowerCase().includes("invalid"));
  } finally { restoreFetch(); }
});

Deno.test("eautomate: rejects without base_url", async () => {
  const r = await runIntegrationTest("eautomate", { username: "u", password: "p" });
  assertEquals(r.ok, false);
});

Deno.test("eautomate: OData metadata response → ok", async () => {
  mockFetch(() => new Response("<edmx><EntityType /></edmx>", { status: 200 }));
  try {
    const r = await runIntegrationTest("eautomate", {
      base_url: "https://ea.example.com",
      username: "svc",
      password: "pw",
    });
    assertEquals(r.ok, true);
  } finally { restoreFetch(); }
});

Deno.test("sales_chain: rejects missing creds", async () => {
  const r = await runIntegrationTest("sales_chain", { base_url: "https://x" });
  assertEquals(r.ok, false);
});

Deno.test("generic integration falls back to required-field validation", async () => {
  const required = REQUIRED_FIELDS.servicenow;
  assert(required.length > 0);
  const incomplete = await runIntegrationTest("servicenow", { instance_url: "https://x" });
  assertEquals(incomplete.ok, false);
  const filled = await runIntegrationTest("servicenow", {
    instance_url: "https://x", username: "u", password: "p",
  });
  assertEquals(filled.ok, true);
});

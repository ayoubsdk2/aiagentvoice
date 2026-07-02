/**
 * Edge-function observability shim — Deno-compatible.
 *
 * We intentionally avoid the heavy OTel SDK in edge functions (cold-start
 * cost + ESM compatibility). Instead this exports a minimal tracer-like API
 * that POSTs OTLP-shaped JSON to OTEL_EXPORTER_OTLP_ENDPOINT when set, and
 * is a no-op otherwise.
 *
 * Mirrors the surface of src/lib/observability.ts (`tracer`, `startSpan`).
 */

const SERVICE_NAME = "voice-phaosai-edge";
const ENDPOINT = Deno.env.get("OTEL_EXPORTER_OTLP_ENDPOINT") ?? "";
const ENV = Deno.env.get("ENV") ?? "production";

interface SpanRecord {
  name: string;
  startNs: bigint;
  attributes: Record<string, string | number | boolean>;
  traceId: string;
  spanId: string;
}

function randHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function nowNs(): bigint {
  return BigInt(Date.now()) * 1_000_000n;
}

async function exportSpan(span: SpanRecord, endNs: bigint, error?: unknown): Promise<void> {
  if (!ENDPOINT) return;
  const payload = {
    resourceSpans: [{
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: SERVICE_NAME } },
          { key: "deployment.environment", value: { stringValue: ENV } },
        ],
      },
      scopeSpans: [{
        scope: { name: SERVICE_NAME },
        spans: [{
          traceId: span.traceId,
          spanId: span.spanId,
          name: span.name,
          kind: 1,
          startTimeUnixNano: span.startNs.toString(),
          endTimeUnixNano: endNs.toString(),
          attributes: Object.entries(span.attributes).map(([k, v]) => ({
            key: k,
            value: typeof v === "number"
              ? { doubleValue: v }
              : typeof v === "boolean"
                ? { boolValue: v }
                : { stringValue: String(v) },
          })),
          status: error ? { code: 2, message: String((error as Error)?.message ?? error) } : { code: 1 },
        }],
      }],
    }],
  };
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("[observability] export failed:", (e as Error).message);
  }
}

export function startSpan(
  name: string,
  attributes: Record<string, string | number | boolean | undefined> = {},
): (err?: unknown) => Promise<void> {
  const cleanAttrs: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(attributes)) {
    if (v !== undefined) cleanAttrs[k] = v as string | number | boolean;
  }
  const span: SpanRecord = {
    name,
    startNs: nowNs(),
    attributes: cleanAttrs,
    traceId: randHex(16),
    spanId: randHex(8),
  };
  let ended = false;
  return async (err?: unknown) => {
    if (ended) return;
    ended = true;
    await exportSpan(span, nowNs(), err);
  };
}

/** Add an attribute to the most-recent span. The minimal shim doesn't track
 *  context, so callers should accumulate attributes in a local object and
 *  pass them at startSpan() time, or call startSpan again with merged attrs. */
export const tracer = {
  startSpan: (name: string, attrs?: Record<string, string | number | boolean>) => {
    const end = startSpan(name, attrs);
    return {
      setAttribute: (_k: string, _v: unknown) => { /* no-op in shim */ },
      end: () => { void end(); },
    };
  },
};

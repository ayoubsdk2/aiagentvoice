/**
 * Observability — OpenTelemetry tracing scaffold (browser/edge compatible).
 *
 * Initializes a WebTracerProvider with an OTLP HTTP exporter when
 * `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` is set, otherwise behaves as a no-op.
 *
 * Usage:
 *   import { tracer, startSpan } from "@/lib/observability";
 *   const end = startSpan("checkout.submit", { user_id: id });
 *   try { ... } finally { end(); }
 *
 * Or use the OTel API directly:
 *   const span = tracer.startSpan("op"); ...; span.end();
 *
 * No-op until you provision an OTLP backend (Grafana Cloud, Honeycomb, Jaeger).
 */
import { trace, type Span, type Tracer, SpanStatusCode } from "@opentelemetry/api";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-web";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

const SERVICE_NAME = "voice-phaosai";
const SERVICE_VERSION = (import.meta.env?.VITE_APP_VERSION as string) ?? "dev";
const OTLP_ENDPOINT = (import.meta.env?.VITE_OTEL_EXPORTER_OTLP_ENDPOINT as string) ?? "";

let initialized = false;

function initObservability() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  if (!OTLP_ENDPOINT) {
    // No-op mode: tracer.startSpan still works (returns a non-recording span).
    return;
  }

  try {
    const resource = resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        (import.meta.env?.MODE as string) ?? "production",
    });

    const exporter = new OTLPTraceExporter({ url: OTLP_ENDPOINT });
    const provider = new WebTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    provider.register();
  } catch (err) {
    // Never let telemetry crash the app
    console.warn("[observability] init failed:", err);
  }
}

initObservability();

export const tracer: Tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);

/**
 * Start a span and return a function that ends it.
 * Records exceptions automatically if you pass them to the returned `end(err)`.
 */
export function startSpan(
  name: string,
  attributes?: Record<string, string | number | boolean | undefined>,
): (err?: unknown) => void {
  const span: Span = tracer.startSpan(name);
  if (attributes) {
    for (const [k, v] of Object.entries(attributes)) {
      if (v !== undefined) span.setAttribute(k, v as string | number | boolean);
    }
  }
  return (err?: unknown) => {
    if (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: String((err as Error)?.message ?? err) });
    }
    span.end();
  };
}

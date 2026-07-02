// Minimal Langfuse REST tracer for Deno. Sends ingestion batches via
// the public /api/public/ingestion endpoint so we avoid pulling the
// Node-only Langfuse SDK into the edge runtime.
// Docs: https://langfuse.com/docs/api

import { createLogger } from "./secure-logger.ts";

const log = createLogger("langfuse");

function host(): string {
  return Deno.env.get("LANGFUSE_HOST") || "https://cloud.langfuse.com";
}

function basicAuth(): string | null {
  const pub = Deno.env.get("LANGFUSE_PUBLIC_KEY");
  const sec = Deno.env.get("LANGFUSE_SECRET_KEY");
  if (!pub || !sec) return null;
  return "Basic " + btoa(`${pub}:${sec}`);
}

interface IngestionEvent {
  id: string;
  type: string;
  timestamp: string;
  body: Record<string, unknown>;
}

async function ingest(events: IngestionEvent[]): Promise<void> {
  const auth = basicAuth();
  if (!auth) return; // Silently skip when not configured.
  try {
    const res = await fetch(`${host()}/api/public/ingestion`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ batch: events }),
    });
    if (!res.ok) {
      log.warn("ingest failed", { status: res.status });
    }
  } catch (err) {
    log.warn("ingest error", { err: String(err) });
  }
}

const uuid = () => crypto.randomUUID();
const ts = () => new Date().toISOString();

export interface Trace {
  id: string;
  end: (output?: unknown) => Promise<void>;
  span: (name: string, input?: unknown) => Span;
}

export interface Span {
  id: string;
  end: (output?: unknown, status?: "success" | "error") => Promise<void>;
}

export function startTrace(name: string, input?: unknown, meta?: Record<string, unknown>): Trace {
  const id = uuid();
  void ingest([{
    id: uuid(),
    type: "trace-create",
    timestamp: ts(),
    body: { id, name, input, metadata: meta ?? {} },
  }]);
  return {
    id,
    end: (output) =>
      ingest([{
        id: uuid(),
        type: "trace-create",
        timestamp: ts(),
        body: { id, output },
      }]),
    span: (spanName, spanInput) => {
      const sid = uuid();
      const startedAt = ts();
      void ingest([{
        id: uuid(),
        type: "span-create",
        timestamp: startedAt,
        body: { id: sid, traceId: id, name: spanName, input: spanInput, startTime: startedAt },
      }]);
      return {
        id: sid,
        end: (output, status = "success") =>
          ingest([{
            id: uuid(),
            type: "span-update",
            timestamp: ts(),
            body: {
              id: sid,
              traceId: id,
              output,
              endTime: ts(),
              level: status === "error" ? "ERROR" : "DEFAULT",
            },
          }]),
      };
    },
  };
}

// Convenience wrapper: run an async handler inside a trace.
export async function withTrace<T>(
  name: string,
  fn: (trace: Trace) => Promise<T>,
  input?: unknown,
  meta?: Record<string, unknown>,
): Promise<T> {
  const trace = startTrace(name, input, meta);
  try {
    const result = await fn(trace);
    await trace.end(result);
    return result;
  } catch (err) {
    await trace.end({ error: String(err) });
    throw err;
  }
}

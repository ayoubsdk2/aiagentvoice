// Secure log wrapper used across every Retell-era edge function.
// Recursively scans payloads and redacts any field whose key looks like a
// credential or matches a tenant_secrets column name so raw tokens never
// reach console output, log aggregators, or error traces.

const SECRET_KEY_PATTERN =
  /(api[_-]?key|token|secret|password|signing|authorization|bearer|access[_-]?key|private[_-]?key)/i;

const TENANT_SECRETS_FIELDS = new Set([
  "retell_api_key",
  "telnyx_api_key",
  "qstash_token",
  "qstash_signing_key",
  "firecrawl_api_key",
  "render_action_router_secret",
  "langfuse_public_key",
  "langfuse_secret_key",
]);

const REDACTED = "***REDACTED***";

function shouldRedactKey(key: string): boolean {
  return TENANT_SECRETS_FIELDS.has(key) || SECRET_KEY_PATTERN.test(key);
}

export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth-limit]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    // Mask anything that looks like a JWT or long opaque token in free text.
    if (value.length > 40 && /[A-Za-z0-9_\-\.]{40,}/.test(value)) {
      return value.slice(0, 4) + "…" + REDACTED;
    }
    return value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = shouldRedactKey(k) ? REDACTED : sanitize(v, depth + 1);
  }
  return out;
}

function emit(level: "info" | "warn" | "error", scope: string, msg: string, meta?: unknown) {
  const line = {
    t: new Date().toISOString(),
    level,
    scope,
    msg,
    ...(meta !== undefined ? { meta: sanitize(meta) } : {}),
  };
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(JSON.stringify(line));
}

export function createLogger(scope: string) {
  return {
    info: (msg: string, meta?: unknown) => emit("info", scope, msg, meta),
    warn: (msg: string, meta?: unknown) => emit("warn", scope, msg, meta),
    error: (msg: string, meta?: unknown) => emit("error", scope, msg, meta),
  };
}

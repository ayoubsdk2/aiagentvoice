/**
 * SSRF guardrail for tenant-provided URLs.
 *
 * Rejects any URL that:
 *   - is not http(s)
 *   - resolves to a literal RFC-1918 / loopback / link-local / unique-local IP
 *   - targets localhost / metadata hostnames
 *
 * Note: we cannot DNS-resolve from inside Edge runtime portably, so we block
 * literal IPs in those ranges + a hostname denylist. This is the same posture
 * used by qa-webhook-ping.
 */

const HOSTNAME_DENYLIST = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata",
]);

export function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = m.slice(1).map((n) => parseInt(n, 10));
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  if (a >= 224) return true; // multicast + reserved
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(host: string): boolean {
  // host may be wrapped in [...] from URL
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique-local
  if (h.startsWith("fe80")) return true; // link-local
  return false;
}

export function assertSafePublicUrl(raw: string, label = "url"): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`${label}: invalid URL`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`${label}: only http(s) allowed`);
  }
  const host = u.hostname.toLowerCase();
  if (!host) throw new Error(`${label}: missing host`);
  if (HOSTNAME_DENYLIST.has(host)) {
    throw new Error(`${label}: host not allowed`);
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error(`${label}: host not allowed`);
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    throw new Error(`${label}: private/internal address not allowed`);
  }
  return u;
}

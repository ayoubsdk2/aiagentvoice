// Smoke-test webhook URLs by sending a benign POST and timing the response.
// Used by the QA dashboard's "Webhooks" tab.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: u.user.id,
      _role: "phaos_admin",
    });
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: "phaos_admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url } = (await req.json()) as { url?: string };
    let parsed: URL;
    try {
      parsed = new URL(url ?? "");
    } catch {
      return new Response(JSON.stringify({ error: "valid url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (parsed.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "https url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const host = parsed.hostname.toLowerCase();
    const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    const isIpv6Literal = host.startsWith("[") || host.includes(":");
    const blockedHostnames = new Set(["localhost", "ip6-localhost", "ip6-loopback", "metadata.google.internal"]);
    const isPrivateIpv4 = (h: string) => {
      const p = h.split(".").map((n) => parseInt(n, 10));
      if (p.length !== 4 || p.some((n) => isNaN(n) || n < 0 || n > 255)) return true;
      const [a, b] = p;
      if (a === 10) return true;
      if (a === 127) return true;
      if (a === 0) return true;
      if (a === 169 && b === 254) return true; // link-local incl. AWS IMDS
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
      if (a >= 224) return true; // multicast/reserved
      return false;
    };
    if (
      blockedHostnames.has(host) ||
      host.endsWith(".internal") ||
      host.endsWith(".local") ||
      isIpv6Literal ||
      (isIpv4 && isPrivateIpv4(host))
    ) {
      return new Response(JSON.stringify({ error: "target host not allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Resolve DNS and ensure no resolved address points at private ranges
    try {
      const records = await Deno.resolveDns(host, "A").catch(() => [] as string[]);
      if (records.some((ip) => isPrivateIpv4(ip))) {
        return new Response(JSON.stringify({ error: "target resolves to private network" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const v6 = await Deno.resolveDns(host, "AAAA").catch(() => [] as string[]);
      if (v6.length > 0) {
        // Conservative: block any IPv6 resolution to avoid ::1, fc00::/7, fe80::/10, etc.
        return new Response(JSON.stringify({ error: "ipv6 targets not allowed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      // DNS failure → let fetch attempt fail naturally
    }
    const url_ = parsed.toString();

    const start = Date.now();
    let status = 0;
    let ok = false;
    let errorMessage: string | null = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch(url_, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "error",
        body: JSON.stringify({
          ping: true,
          source: "phaos-qa",
          ts: new Date().toISOString(),
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      status = resp.status;
      ok = resp.ok;
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : "fetch failed";
    }
    const latency_ms = Date.now() - start;

    return new Response(
      JSON.stringify({ ok, status, latency_ms, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("qa-webhook-ping error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

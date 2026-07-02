/**
 * Agentic Tools Edge Function
 * Handles tool-calling for printing/copier industry workflows.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Tool JSON Schemas (OpenAI function-calling format) ─────

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "trigger_service_dispatch",
      description:
        "Dispatches a field technician to service a device based on its serial number and error code. Returns technician name, ETA, and priority level.",
      parameters: {
        type: "object",
        properties: {
          serial_number: {
            type: "string",
            description: "The device serial number (e.g., 'SHP-MX365N-00412')",
          },
          error_code: {
            type: "string",
            description: "The error code displayed on the device (e.g., 'E7-10', 'H5-01')",
          },
        },
        required: ["serial_number", "error_code"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "verify_toner_levels",
      description:
        "Checks current toner levels for a managed print device. Returns percentage remaining for each cartridge color and triggers auto-replenishment if below threshold.",
      parameters: {
        type: "object",
        properties: {
          device_id: {
            type: "string",
            description: "The managed device identifier (e.g., 'DEV-BP70C45-0087')",
          },
        },
        required: ["device_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "collect_meter_reading",
      description:
        "Records a meter reading for billing purposes. Validates the new count is higher than the previous month's reading to prevent billing errors.",
      parameters: {
        type: "object",
        properties: {
          serial_number: {
            type: "string",
            description: "The device serial number",
          },
          bw_count: {
            type: "number",
            description: "Current black & white page counter reading",
          },
        },
        required: ["serial_number", "bw_count"],
      },
    },
  },
];

// ─── Mock Handlers ──────────────────────────────────────────

function handleServiceDispatch(params: { serial_number: string; error_code: string }) {
  const technicians = [
    { name: "Mike Reynolds", region: "Northeast", rating: 4.9 },
    { name: "Sarah Chen", region: "West Coast", rating: 4.8 },
    { name: "David Okafor", region: "Southeast", rating: 4.7 },
  ];
  const tech = technicians[Math.floor(Math.random() * technicians.length)];
  const etaMinutes = 30 + Math.floor(Math.random() * 90);
  const priority = params.error_code.startsWith("E7") ? "critical" : params.error_code.startsWith("H") ? "high" : "standard";

  return {
    tool: "trigger_service_dispatch",
    result: {
      dispatch_id: `DSP-${Date.now().toString(36).toUpperCase()}`,
      serial_number: params.serial_number,
      error_code: params.error_code,
      technician: tech,
      eta_minutes: etaMinutes,
      eta_display: `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m`,
      priority,
      status: "dispatched",
      created_at: new Date().toISOString(),
    },
  };
}

function handleVerifyToner(params: { device_id: string }) {
  const levels = {
    black: Math.floor(Math.random() * 100),
    cyan: Math.floor(Math.random() * 100),
    magenta: Math.floor(Math.random() * 100),
    yellow: Math.floor(Math.random() * 100),
  };
  const threshold = 15;
  const replenishmentTriggered = Object.values(levels).some((l) => l < threshold);

  return {
    tool: "verify_toner_levels",
    result: {
      device_id: params.device_id,
      levels,
      threshold_pct: threshold,
      replenishment_triggered: replenishmentTriggered,
      low_cartridges: Object.entries(levels)
        .filter(([, v]) => v < threshold)
        .map(([k]) => k),
      checked_at: new Date().toISOString(),
    },
  };
}

function handleMeterReading(params: { serial_number: string; bw_count: number }) {
  // Mock previous month's reading
  const previousReading = 10000 + Math.floor(Math.random() * 50000);
  const isValid = params.bw_count > previousReading;

  return {
    tool: "collect_meter_reading",
    result: {
      serial_number: params.serial_number,
      submitted_count: params.bw_count,
      previous_count: previousReading,
      is_valid: isValid,
      delta: isValid ? params.bw_count - previousReading : null,
      validation_message: isValid
        ? `Reading accepted. ${params.bw_count - previousReading} pages since last reading.`
        : `Rejected: submitted count (${params.bw_count}) is not higher than previous (${previousReading}). Please verify the meter.`,
      recorded_at: new Date().toISOString(),
    },
  };
}

// ─── Handler ────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require an authenticated caller. The Vapi assistant calls this on behalf of
  // a logged-in user (their JWT is propagated). Public callers must not be able
  // to enumerate tool schemas or invoke tool handlers.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error } = await supa.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (error || !data?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { action, tool_name, params } = body;

    // Return tool schemas for agent registration
    if (action === "get_schemas") {
      return new Response(JSON.stringify({ tools: TOOL_DEFINITIONS }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute a tool call
    if (action === "execute") {
      let result;
      switch (tool_name) {
        case "trigger_service_dispatch":
          result = handleServiceDispatch(params);
          break;
        case "verify_toner_levels":
          result = handleVerifyToner(params);
          break;
        case "collect_meter_reading":
          result = handleMeterReading(params);
          break;
        default:
          return new Response(JSON.stringify({ error: `Unknown tool: ${tool_name}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

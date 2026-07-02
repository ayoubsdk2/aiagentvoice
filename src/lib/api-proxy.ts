import { supabase } from "@/integrations/supabase/client";

type ServiceName = "openai" | "elevenlabs" | "livekit" | "deepgram";

interface ProxyRequest {
  service: ServiceName;
  action?: string;
  payload?: Record<string, unknown>;
}

export async function callApiProxy({ service, action = "default", payload = {} }: ProxyRequest) {
  const { data, error } = await supabase.functions.invoke("api-proxy", {
    body: { service, action, payload },
  });

  if (error) {
    throw new Error(`API proxy error: ${error.message}`);
  }

  return data;
}

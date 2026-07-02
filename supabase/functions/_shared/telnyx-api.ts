// Minimal Telnyx V2 API client used by the provisioning workflow.
// All calls use bearer auth with TELNYX_API_KEY.
// Docs: https://developers.telnyx.com/api/

const TELNYX_BASE = "https://api.telnyx.com/v2";

function authHeaders(): HeadersInit {
  const key = Deno.env.get("TELNYX_API_KEY");
  if (!key) throw new Error("TELNYX_API_KEY missing");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function telnyx<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${TELNYX_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`telnyx ${init.method ?? "GET"} ${path} ${res.status}: ${text.slice(0, 500)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export interface TelnyxAvailableNumber {
  phone_number: string;
  region_information?: Array<{ region_type: string; region_name: string }>;
}

export async function searchNumberByAreaCode(areaCode: string): Promise<TelnyxAvailableNumber | null> {
  if (!/^\d{3}$/.test(areaCode)) throw new Error(`invalid area_code: ${areaCode}`);
  const params = new URLSearchParams();
  params.set("filter[country_code]", "US");
  params.set("filter[national_destination_code]", areaCode);
  params.set("filter[features][]", "voice");
  params.set("filter[limit]", "5");
  const data = await telnyx<{ data: TelnyxAvailableNumber[] }>(`/available_phone_numbers?${params.toString()}`);
  return data.data?.[0] ?? null;
}

export interface TelnyxPurchasedNumber {
  order_id: string;
  phone_number: string;
}

export async function purchaseNumber(phoneNumber: string): Promise<TelnyxPurchasedNumber> {
  const order = await telnyx<{ data: { id: string; phone_numbers: Array<{ id: string; phone_number: string }> } }>(
    "/number_orders",
    {
      method: "POST",
      body: JSON.stringify({ phone_numbers: [{ phone_number: phoneNumber }] }),
    },
  );
  const first = order.data.phone_numbers?.[0];
  if (!first) throw new Error("telnyx order returned no phone numbers");
  // NOTE: first.id is the order-line UUID; routing PATCHes require the
  // numeric phone-number id resolved via /phone_numbers?filter[phone_number]=...
  return { order_id: order.data.id, phone_number: first.phone_number };
}

// Resolves the 19-digit Telnyx phone-number id by E.164. Telnyx provisions
// purchased numbers asynchronously, so we poll briefly.
export async function getPhoneNumberIdByE164(e164: string): Promise<string> {
  const params = new URLSearchParams();
  params.set("filter[phone_number]", e164);
  for (let attempt = 0; attempt < 6; attempt++) {
    const data = await telnyx<{ data: Array<{ id: string; phone_number: string }> }>(
      `/phone_numbers?${params.toString()}`,
    );
    const hit = data.data?.find((n) => n.phone_number === e164) ?? data.data?.[0];
    if (hit?.id) return hit.id;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`phone_number_id_not_found:${e164}`);
}

export async function attachToConnection(phoneNumberId: string, connectionId: string): Promise<void> {
  await telnyx(`/phone_numbers/${phoneNumberId}`, {
    method: "PATCH",
    body: JSON.stringify({ connection_id: connectionId }),
  });
}

export async function releaseNumber(phoneNumberId: string): Promise<void> {
  try {
    await telnyx(`/phone_numbers/${phoneNumberId}`, { method: "DELETE" });
  } catch (err) {
    console.error("[telnyx] release failed", phoneNumberId, err);
  }
}

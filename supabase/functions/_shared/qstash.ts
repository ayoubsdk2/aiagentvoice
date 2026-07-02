// Upstash QStash publish helper. Used to enqueue idempotent provisioning jobs.

interface PublishArgs {
  url: string;            // target URL the worker function is reachable at
  body: unknown;
  deduplicationId: string;
  retries?: number;       // default 3
  delaySeconds?: number;
}

export async function publishQStash(args: PublishArgs): Promise<{ messageId: string }> {
  const token = Deno.env.get("QSTASH_TOKEN");
  if (!token) throw new Error("QSTASH_TOKEN missing");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Upstash-Retries": String(args.retries ?? 3),
    "Upstash-Deduplication-Id": args.deduplicationId,
  };
  if (args.delaySeconds) headers["Upstash-Delay"] = `${args.delaySeconds}s`;

  const res = await fetch(`https://qstash.upstash.io/v2/publish/${encodeURI(args.url)}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`qstash publish ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// OpenAI embeddings (text-embedding-3-small, 1536 dims) used for the
// pgvector knowledge base.

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${body.slice(0, 300)}`);
  const json = JSON.parse(body) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embedTexts([text]))[0];
}

import Anthropic from "@anthropic-ai/sdk";
import { Resource, ResourceCategory } from "@/types";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
}

export async function searchWithAI(
  query: string,
  resources: Resource[],
  state?: string | null,
  category?: ResourceCategory | null,
): Promise<{ resources: Resource[]; ai_summary: string }> {
  const resourceList = resources.slice(0, 50).map(r =>
    `ID:${r.id} | ${r.name} | ${r.category} | ${r.city}, ${r.state} | ${r.status}${r.urgent ? " | URGENT" : ""}`
  ).join("\n");

  const prompt = `You are a humanitarian resource finder helping refugees and asylum seekers.

Available resources in ${state || "the US"}:
${resourceList}

User query: "${query}"
${category ? `Filter: ${category} resources only` : ""}

Return a JSON object with:
1. "resource_ids": array of IDs most relevant to the query (max 10, prioritize urgent)
2. "summary": 1-2 sentence plain-language summary of what you found and why it's relevant

Respond with ONLY valid JSON.`;

  const message = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  try {
    const parsed = JSON.parse(text);
    const matchedIds = new Set<string>(parsed.resource_ids || []);
    const matched = resources.filter(r => matchedIds.has(r.id));
    return { resources: matched, ai_summary: parsed.summary || "" };
  } catch {
    return { resources: [], ai_summary: "Unable to process search results." };
  }
}

export async function triageUrgency(resourceDescription: string): Promise<boolean> {
  const message = await getClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16,
    messages: [{
      role: "user",
      content: `Is this a crisis/emergency resource? Answer only "yes" or "no".\n\n${resourceDescription}`,
    }],
  });
  const text = message.content[0].type === "text" ? message.content[0].text.toLowerCase() : "no";
  return text.includes("yes");
}

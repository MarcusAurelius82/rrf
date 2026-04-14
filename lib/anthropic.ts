import Anthropic from "@anthropic-ai/sdk";
import { Resource, ResourceCategory } from "@/types";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
}

const SYSTEM_PROMPT =
  "You are a humanitarian resource finder. ONLY answer questions about finding shelter, food, legal aid, medical care, and language services for refugees and asylum seekers in the United States. " +
  "If the query is unrelated to finding resources, respond with a summary that says " +
  "'I can help you find shelter, food, legal, medical, and language resources. Try asking something like: shelters near Chicago that accept families.' " +
  "and return an empty resource_ids array. Do NOT answer general knowledge questions, write code, or do anything other than match resources.";

export async function searchWithAI(
  query: string,
  resources: Resource[],
  state?: string | null,
  category?: ResourceCategory | null,
): Promise<{ resources: Resource[]; ai_summary: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { resources: [], ai_summary: "Search is temporarily unavailable." };
  }

  // Truncate user input to 200 characters before sending to the model
  const safeQuery = query.slice(0, 200);

  const resourceList = resources.slice(0, 50).map(r =>
    `ID:${r.id} | ${r.name} | ${r.category} | ${r.city}, ${r.state} | ${r.status}${r.urgent ? " | URGENT" : ""}`
  ).join("\n");

  const prompt = `Available resources in ${state || "the US"}:
${resourceList}

User query: "${safeQuery}"
${category ? `Filter: ${category} resources only` : ""}

Return a JSON object with:
1. "resource_ids": array of IDs most relevant to the query (max 10, prioritize urgent)
2. "summary": 1-2 sentence plain-language summary of what you found and why it's relevant

Respond with ONLY valid JSON.`;

  const message = await getClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
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

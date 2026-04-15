import Anthropic from "@anthropic-ai/sdk";
import { Resource, ResourceCategory } from "@/types";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
}

// Only reject queries that are clearly not about finding humanitarian resources.
// Do NOT reject valid queries just because the resource list is empty — that
// just means we don't have coverage in that area yet.
const SYSTEM_PROMPT =
  "You are a humanitarian resource finder for refugees and asylum seekers in the United States. " +
  "Your only job is to match users to shelter, food, legal aid, medical care, and language services. " +
  "If the resource list is empty, set resource_ids to [] and write a helpful summary explaining no results were found nearby. " +
  "Only if the query is clearly unrelated to finding any kind of humanitarian resource (e.g. asking you to write code, answer trivia, or do math) " +
  "should you set resource_ids to [] and set summary to: " +
  "'I can help you find shelter, food, legal, medical, and language resources. Try asking something like: shelters near Chicago that accept families.' " +
  "Do NOT answer general knowledge questions, write code, or do anything other than match resources.";

export async function searchWithAI(
  query: string,
  resources: Resource[],
  state?: string | null,
  category?: ResourceCategory | null,
): Promise<{ resources: Resource[]; ai_summary: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { resources: [], ai_summary: "Search is temporarily unavailable." };
  }

  // If Supabase returned no candidates, skip the AI call entirely
  if (resources.length === 0) {
    return {
      resources: [],
      ai_summary: `No resources found${state ? ` in ${state}` : " in this area"} matching your search. Try broadening your query or selecting a different state.`,
    };
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

Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation:
{"resource_ids": ["id1", "id2"], "summary": "1-2 sentence plain-language summary"}`;

  const message = await getClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";

  // Strip markdown code fences (```json ... ``` or ``` ... ```) if present
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  // Extract the first {...} block in case the model adds prose around the JSON
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : stripped;

  try {
    const parsed = JSON.parse(jsonStr);
    const matchedIds = new Set<string>(parsed.resource_ids || []);
    const matched = resources.filter(r => matchedIds.has(r.id));
    return { resources: matched, ai_summary: parsed.summary || "" };
  } catch {
    console.error("searchWithAI: failed to parse response:", raw);
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

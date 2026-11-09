import { z } from "zod";
import { buildScopePlan, scopeSuggestionSchema, type ScopePlan } from "@/server/scoping";

export const SCOPE_PROMPT_VERSION = "kintovo-scope-v1";

const outputSchema = z.object({
  workstreams: z.array(scopeSuggestionSchema).min(1).max(8),
  questions: z.array(z.string().trim().min(4).max(240)).max(12),
  assumptions: z.array(z.string().trim().min(4).max(300)).max(12),
});

type ScopeInput = { objective: string; targetAudience?: string | null; budgetMin?: number | null; budgetMax?: number | null; deadline?: Date | null };

export async function generateScopePlan(input: ScopeInput): Promise<{ plan: ScopePlan; source: "RULES_V1" | "AI_COMPATIBLE"; promptVersion: string }> {
  const fallback = buildScopePlan(input);
  const apiUrl = process.env.AI_API_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (process.env.AI_PROVIDER !== "compatible" || !apiUrl || !apiKey || !model) return { plan: fallback, source: "RULES_V1", promptVersion: SCOPE_PROMPT_VERSION };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `You are Kintovo's project-planning assistant. Return only JSON with workstreams, questions, assumptions. Each workstream must have name, description, capabilities, recommendedRoles, deliverables, dependencies, assumptions, rationale. Make suggestions only; never state unverified market facts, legal/tax/regulatory advice, or final hiring decisions. Keep uncertainty visible. Prompt version: ${SCOPE_PROMPT_VERSION}.` },
          { role: "user", content: JSON.stringify({ objective: input.objective, targetAudience: input.targetAudience ?? null, budgetMin: input.budgetMin ?? null, budgetMax: input.budgetMax ?? null, deadline: input.deadline?.toISOString() ?? null }) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const payload: unknown = await response.json();
    const text = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) }).parse(payload).choices[0].message.content;
    const plan = outputSchema.parse(JSON.parse(text));
    console.info(`[Kintovo scope] provider=compatible prompt=${SCOPE_PROMPT_VERSION} outcome=success`);
    return { plan, source: "AI_COMPATIBLE", promptVersion: SCOPE_PROMPT_VERSION };
  } catch {
    console.info(`[Kintovo scope] provider=compatible prompt=${SCOPE_PROMPT_VERSION} outcome=fallback`);
    return { plan: fallback, source: "RULES_V1", promptVersion: SCOPE_PROMPT_VERSION };
  } finally {
    clearTimeout(timeout);
  }
}

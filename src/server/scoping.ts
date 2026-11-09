import { z } from "zod";

export const scopeSuggestionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(1000),
  capabilities: z.array(z.string().trim().min(2).max(100)).max(12),
  recommendedRoles: z.array(z.string().trim().min(2).max(100)).max(8),
  deliverables: z.array(z.string().trim().min(2).max(180)).max(12),
  dependencies: z.array(z.string().trim().min(2).max(180)).max(8),
  assumptions: z.array(z.string().trim().min(2).max(300)).max(8),
  rationale: z.string().trim().min(2).max(500),
});

export type ScopeSuggestion = z.infer<typeof scopeSuggestionSchema>;
export type ScopePlan = { workstreams: ScopeSuggestion[]; questions: string[]; assumptions: string[] };

/** Explainable local fallback. These recommendations are always editable by the buyer. */
export function suggestWorkstreams(objective: string): ScopeSuggestion[] {
  const text = objective.toLowerCase();
  const suggestions: ScopeSuggestion[] = [];
  const add = (name: string, description: string, capabilities: string[], recommendedRoles: string[], deliverables: string[], rationale: string) => suggestions.push({
    name, description, capabilities, recommendedRoles, deliverables, dependencies: [],
    assumptions: ["The buyer will confirm scope, budget, timeline, and access to required information before work begins."], rationale,
  });
  if (/\b(launch|enter|market|audience|customer|competitor|research|locali[sz])\b/.test(text)) {
    add("Market research", "Understand local audiences, competitors, and practical market context.", ["Market research", "Audience insight"], ["Market researcher", "Local-market strategist"], ["Audience and competitor summary", "Research findings and evidence"], "The objective refers to a market, audience, launch, customer, or research question.");
  }
  if (/\b(brand|creative|design|content|message|campaign|locali[sz])\b/.test(text)) {
    add("Localised creative", "Adapt messaging and creative assets to the intended audience.", ["Brand strategy", "Graphic design", "Content production"], ["Brand strategist", "Designer", "Content producer"], ["Localised messaging direction", "Draft creative assets"], "The objective mentions creative, brand, content, messaging, or localisation work.");
  }
  if (/\b(creator|influencer|campaign|reach|social|audience)\b/.test(text)) {
    add("Creator distribution", "Plan creator content around a relevant audience and clear deliverables.", ["Creator partnerships", "Campaign management"], ["Creator partnerships lead", "Content creator"], ["Creator brief and selection criteria", "Content and publishing plan"], "The objective names creators, influencers, social reach, or a campaign.");
  }
  if (/\b(digital|growth|app|software|web|product)\b/.test(text)) {
    add("Digital growth", "Identify digital channels and product work needed to support the goal.", ["Digital marketing", "Software and digital services"], ["Digital marketer", "Product specialist"], ["Channel recommendations", "Growth experiment plan"], "The objective refers to a digital product, software, web, app, or growth goal.");
  }
  if (suggestions.length === 0) {
    add("Discovery and planning", "Clarify the audience, delivery approach, and capabilities needed for the stated goal.", ["Business strategy", "Market research"], ["Business strategist", "Market researcher"], ["Discovery summary", "Recommended next-step plan"], "The objective does not match a specific rule, so a general discovery step is suggested.");
  }
  return suggestions;
}

export function buildScopePlan(input: { objective: string; targetAudience?: string | null; budgetMin?: number | null; budgetMax?: number | null; deadline?: Date | null }): ScopePlan {
  const assumptions = ["Recommendations are a planning draft and do not represent confirmed market research.", "Roles, deliverables, and dependencies require buyer and human-review confirmation."];
  const questions = [
    ...(!input.targetAudience?.trim() ? ["Which customer or user group should this work prioritise?"] : []),
    ...(input.budgetMin == null && input.budgetMax == null ? ["What budget range should the plan work within?"] : []),
    ...(!input.deadline ? ["When do you need the first useful outcome?"] : []),
  ];
  return { workstreams: suggestWorkstreams(input.objective), questions, assumptions };
}

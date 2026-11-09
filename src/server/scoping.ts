export type ScopeSuggestion = { name: string; description: string; capabilities: string[] };

/** Explainable local fallback. These recommendations are always editable by the buyer. */
export function suggestWorkstreams(objective: string): ScopeSuggestion[] {
  const text = objective.toLowerCase();
  const suggestions: ScopeSuggestion[] = [];
  const add = (name: string, description: string, capabilities: string[]) => suggestions.push({ name, description, capabilities });
  if (/\b(launch|enter|market|audience|customer|competitor|research|locali[sz])\b/.test(text)) {
    add("Market research", "Understand local audiences, competitors, and practical market context.", ["Market research", "Audience insight"]);
  }
  if (/\b(brand|creative|design|content|message|campaign|locali[sz])\b/.test(text)) {
    add("Localised creative", "Adapt messaging and creative assets to the intended audience.", ["Brand strategy", "Graphic design", "Content production"]);
  }
  if (/\b(creator|influencer|campaign|reach|social|audience)\b/.test(text)) {
    add("Creator distribution", "Plan creator content around a relevant audience and clear deliverables.", ["Creator partnerships", "Campaign management"]);
  }
  if (/\b(digital|growth|app|software|web|product)\b/.test(text)) {
    add("Digital growth", "Identify digital channels and product work needed to support the goal.", ["Digital marketing", "Software and digital services"]);
  }
  if (suggestions.length === 0) {
    add("Discovery and planning", "Clarify the audience, delivery approach, and capabilities needed for the stated goal.", ["Business strategy", "Market research"]);
  }
  return suggestions;
}

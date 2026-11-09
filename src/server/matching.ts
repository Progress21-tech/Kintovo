export type MatchCandidate = {
  categories: string[];
  skills: string[];
  marketExperience: string | null;
  languages: string[];
  availabilityStatus: string;
  indicativeRate: number | null;
};

export type MatchContext = {
  capabilities: string[];
  roles: string[];
  targetMarket: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  requiredLanguages?: string[];
};

export type MatchResult = { score: number; reasons: string[]; gaps: string[] };

const normalise = (value: string) => value.trim().toLowerCase();
const overlaps = (candidate: string[], requirements: string[]) => candidate.filter((item) => requirements.some((required) => normalise(item) === normalise(required)));

/** A transparent rules-based fit signal, not a universal popularity rank or hiring decision. */
export function explainMatch(candidate: MatchCandidate, context: MatchContext): MatchResult {
  const required = [...context.capabilities, ...context.roles];
  const matchedSkills = overlaps(candidate.skills, required);
  const matchedCategories = overlaps(candidate.categories, context.roles);
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  if (matchedSkills.length) { score += Math.min(40, matchedSkills.length * 20); reasons.push(`Skill overlap: ${matchedSkills.join(", ")}`); }
  else gaps.push("No exact listed skill overlap");
  if (matchedCategories.length) { score += 25; reasons.push(`Category fit: ${matchedCategories.join(", ")}`); }
  else gaps.push("No exact category match");

  const market = candidate.marketExperience?.toLowerCase() ?? "";
  if (context.targetMarket && market.includes(normalise(context.targetMarket))) { score += 20; reasons.push(`Relevant market experience mentions ${context.targetMarket}`); }
  else gaps.push("Market experience not confirmed by profile");

  if (candidate.availabilityStatus === "AVAILABLE") { score += 10; reasons.push("Profile marked available"); }
  else if (candidate.availabilityStatus === "AVAILABLE_FROM") reasons.push("Profile lists a future availability date");
  else gaps.push("Availability is not marked as current");

  if (candidate.indicativeRate !== null && context.budgetMax != null && candidate.indicativeRate <= context.budgetMax) {
    score += 5;
    reasons.push("Indicative rate is within the brief's maximum budget");
  } else if (candidate.indicativeRate !== null && context.budgetMin != null && candidate.indicativeRate < context.budgetMin) {
    reasons.push("Indicative rate is below the brief's stated range; negotiate final terms");
  } else if (candidate.indicativeRate !== null && context.budgetMax != null) gaps.push("Indicative rate exceeds the stated maximum");

  const missingLanguages = (context.requiredLanguages ?? []).filter((language) => !candidate.languages.some((item) => normalise(item) === normalise(language)));
  if (missingLanguages.length) gaps.push(`Language not listed: ${missingLanguages.join(", ")}`);
  else if (context.requiredLanguages?.length) { score += 5; reasons.push("Required language is listed"); }

  return { score: Math.min(score, 100), reasons, gaps };
}

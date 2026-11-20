import type { ProfileParse } from "../types";

/**
 * Deterministic guardrails applied after Zod validation (spec §8.2 "honest extraction"):
 * - destinations must be in the registry, else moved to unmappedPlaces
 * - a budget is kept only if that number literally appears in the text
 * - suggested destinations must be in the registry
 * - "missing" is recomputed from the result, not trusted from the model
 */
export function sanitizeParse(parse: ProfileParse, text: string, registryIds: Set<string>): ProfileParse {
  const out: ProfileParse = structuredClone(parse);

  const kept: ProfileParse["destinations"] = [];
  for (const d of out.destinations) {
    if (registryIds.has(d.destinationId)) {
      if (!kept.some((k) => k.destinationId === d.destinationId)) kept.push(d);
    } else {
      out.unmappedPlaces.push({ text: d.sourceText || d.destinationId, question: `Where is "${d.sourceText || d.destinationId}"?` });
    }
  }
  out.destinations = kept;

  out.unmappedPlaces = out.unmappedPlaces.map((u) =>
    u.suggestedDestinationId && !registryIds.has(u.suggestedDestinationId) ? { text: u.text, question: u.question } : u,
  );

  if (out.budgetMax) {
    const digits = text.replace(/,/g, "");
    const n = Math.round(out.budgetMax.value);
    if (!new RegExp(`\\b${n}\\b`).test(digits)) delete out.budgetMax;
  }

  if (out.travelMode) delete out.travelModeOptions;

  const missing = new Set<ProfileParse["missing"][number]>();
  if (!out.budgetMax) missing.add("budget");
  if (!out.travelMode && !(out.travelModeOptions && out.travelModeOptions.length)) missing.add("travelMode");
  if (out.destinations.length === 0 && out.unmappedPlaces.length === 0) missing.add("destinations");
  out.missing = [...missing];

  return out;
}

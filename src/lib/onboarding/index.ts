/**
 * Onboarding client logic (spec §8.1). Pure functions, no React.
 *
 * Field-confirmation rule ("only confirmed fields reach the engine"):
 *   Every AI-extracted field gets a `fieldMeta` entry { sourceType: "ai", confirmed: false }.
 *   `effectiveProfile()` is applied before ranking. For each unconfirmed AI field it swaps in
 *   the NEUTRAL value below, so the engine behaves as if that field were absent:
 *     budgetMax                → NEUTRAL_BUDGET ($1,000)    travelMode → "walk", hasCar → false
 *     lifestyle.noise/cooking/guests → "either" / "medium" / "sometimes"
 *     requirements.*           → false (no hard requirement)
 *     destinations.<id>        → destination dropped
 *     desiredAmenities.<key>   → amenity dropped
 *   Weights are never AI-sourced (they come from defaults + this-or-that answers).
 *   Fields typed or edited by the user are sourceType "user", confirmed: true.
 */
import { DEFAULT_WEIGHTS, applyThisOrThat } from "@/lib/engine";
import { getDestination } from "@/lib/data";
import type {
  Destination,
  Dim,
  FeatureKey,
  FieldMeta,
  Lifestyle,
  MemberProfile,
  ProfileParse,
  Requirements,
  TravelMode,
} from "@/lib/types";

export const NEUTRAL_BUDGET = 1000;
export const NEUTRAL_LIFESTYLE: Lifestyle = { noise: "either", cooking: "medium", guests: "sometimes" };
export const NEUTRAL_REQUIREMENTS: Requirements = { privateBedroom: false, parking: false, inUnitLaundry: false };
export const NEUTRAL_TRAVEL_MODE: TravelMode = "walk";

export const LIFESTYLE_KEYS = ["noise", "cooking", "guests"] as const;
export const REQUIREMENT_KEYS = ["privateBedroom", "parking", "inUnitLaundry"] as const;

export type FieldKey =
  | "budgetMax"
  | "travelMode"
  | "hasCar"
  | `lifestyle.${keyof Lifestyle}`
  | `requirements.${keyof Requirements}`
  | `destinations.${string}`
  | `desiredAmenities.${FeatureKey}`;

/** Example chips for the onboarding textarea. The first is the exact §8.3 demo sentence. */
export const EXAMPLE_PROMPTS: { label: string; text: string }[] = [
  {
    // The stage demo sentence (cached in demo-parse-cache.json, so it parses instantly and the same every time).
    label: "North Campus aerospace engineer",
    text: "I'm an aerospace engineering student. I'm on North Campus four days a week and Central Campus twice a week. I bike everywhere and don't have a car. I cook a lot, so I want a big kitchen, a dishwasher and in-unit laundry. I need a quiet place to live, and my budget is $1,100 a month.",
  },
  {
    label: "Med campus, bikes everywhere",
    text: "I'm a nursing student, at the Medical Campus four days a week and Central twice. I bike everywhere, need in-unit laundry for scrubs, and my cap is $900.",
  },
  {
    label: "Quiet late-night studier",
    text: "I study late at the Duderstadt Center most nights and need a quiet place with my own bedroom. I walk to class on Central Campus. Budget around $1,100.",
  },
  {
    label: "Social host with a car",
    text: "I have a car and need parking. I'm at Ross most days, love having friends over, and want a social building with a big kitchen. Up to $1,200 a month.",
  },
];

export function importanceFor(visitsPerWeek: number): 1 | 2 | 3 {
  if (visitsPerWeek >= 4) return 3;
  if (visitsPerWeek >= 2) return 2;
  return 1;
}

/** A blank, neutral Student A. Used as the base for parsing and for the manual fallback form. */
export function neutralProfile(base: MemberProfile, displayName?: string): MemberProfile {
  return {
    ...base,
    displayName: displayName?.trim() || base.displayName,
    budgetMax: NEUTRAL_BUDGET,
    budgetIsHardCap: false,
    travelMode: NEUTRAL_TRAVEL_MODE,
    hasCar: false,
    destinations: [],
    lifestyle: { ...NEUTRAL_LIFESTYLE },
    requirements: { ...NEUTRAL_REQUIREMENTS },
    desiredAmenities: [],
    weights: { ...DEFAULT_WEIGHTS },
    fieldMeta: {},
    // About-you details and places belong to the student, never to the template persona.
    major: undefined,
    organizations: [],
    places: [],
    photo: undefined,
    schedule: null,
  };
}

const aiMeta = (sourceText: string, confidence: number): FieldMeta => ({
  sourceType: "ai",
  sourceText,
  confidence,
  confirmed: false,
});

export const userMeta = (sourceText?: string): FieldMeta => ({
  sourceType: "user",
  ...(sourceText ? { sourceText } : {}),
  confirmed: true,
});

/**
 * Map a ProfileParse onto Student A. Each extracted field overwrites the base value and gets
 * fieldMeta { sourceType: "ai", sourceText, confidence, confirmed: false }.
 * Fields the parse did not mention keep the base value (and its meta).
 */
export function parseToProfile(parse: ProfileParse, base: MemberProfile): MemberProfile {
  const p: MemberProfile = {
    ...base,
    lifestyle: { ...base.lifestyle },
    requirements: { ...base.requirements },
    destinations: [...base.destinations],
    desiredAmenities: [...base.desiredAmenities],
    weights: { ...base.weights },
    fieldMeta: { ...base.fieldMeta },
  };

  const validDests = parse.destinations.filter((d) => getDestination(d.destinationId));
  if (validDests.length > 0) {
    for (const d of validDests) {
      const visits = d.visitsPerWeek ?? 2;
      const next: Destination = { destinationId: d.destinationId, visitsPerWeek: visits, importance: importanceFor(visits) };
      p.destinations = [...p.destinations.filter((x) => x.destinationId !== d.destinationId), next];
      p.fieldMeta[`destinations.${d.destinationId}`] = aiMeta(d.sourceText, d.confidence);
    }
  }

  if (parse.budgetMax) {
    p.budgetMax = Math.round(parse.budgetMax.value);
    p.fieldMeta.budgetMax = aiMeta(parse.budgetMax.sourceText, parse.budgetMax.confidence);
  }
  if (parse.travelMode) {
    p.travelMode = parse.travelMode.value;
    p.fieldMeta.travelMode = aiMeta(parse.travelMode.sourceText, parse.travelMode.confidence);
  } else if (parse.travelModeOptions?.length) {
    // No follow-up question any more: an ambiguous mode defaults to walk, or bike if bike was mentioned.
    p.travelMode = defaultTravelMode(parse);
  }
  if (parse.hasCar) {
    p.hasCar = parse.hasCar.value;
    p.fieldMeta.hasCar = aiMeta(parse.hasCar.sourceText, parse.hasCar.confidence);
  }
  for (const k of LIFESTYLE_KEYS) {
    const f = parse.lifestyle[k];
    if (!f) continue;
    (p.lifestyle as unknown as Record<string, string>)[k] = f.value;
    p.fieldMeta[`lifestyle.${k}`] = aiMeta(f.sourceText, f.confidence);
  }
  for (const k of REQUIREMENT_KEYS) {
    const f = parse.requirements[k];
    if (!f) continue;
    p.requirements[k] = f.value;
    p.fieldMeta[`requirements.${k}`] = aiMeta(f.sourceText, f.confidence);
  }
  for (const a of parse.desiredAmenities) {
    if (!p.desiredAmenities.includes(a.value)) p.desiredAmenities.push(a.value);
    p.fieldMeta[`desiredAmenities.${a.value}`] = aiMeta(a.sourceText, a.confidence);
  }
  return p;
}

// ---------- confirmation rule ----------

export function isUnconfirmedAi(meta: FieldMeta | undefined): boolean {
  return !!meta && meta.sourceType === "ai" && !meta.confirmed;
}

/** The profile the engine sees: unconfirmed AI fields replaced with neutral values. */
export function effectiveProfile(profile: MemberProfile): MemberProfile {
  const meta = profile.fieldMeta;
  if (!Object.values(meta).some(isUnconfirmedAi)) return profile;
  const p: MemberProfile = {
    ...profile,
    lifestyle: { ...profile.lifestyle },
    requirements: { ...profile.requirements },
  };
  if (isUnconfirmedAi(meta.budgetMax)) p.budgetMax = NEUTRAL_BUDGET;
  if (isUnconfirmedAi(meta.travelMode)) p.travelMode = NEUTRAL_TRAVEL_MODE;
  if (isUnconfirmedAi(meta.hasCar)) p.hasCar = false;
  for (const k of LIFESTYLE_KEYS) {
    if (isUnconfirmedAi(meta[`lifestyle.${k}`])) (p.lifestyle as unknown as Record<string, string>)[k] = NEUTRAL_LIFESTYLE[k];
  }
  for (const k of REQUIREMENT_KEYS) {
    if (isUnconfirmedAi(meta[`requirements.${k}`])) p.requirements[k] = false;
  }
  p.destinations = profile.destinations.filter((d) => !isUnconfirmedAi(meta[`destinations.${d.destinationId}`]));
  p.desiredAmenities = profile.desiredAmenities.filter((a) => !isUnconfirmedAi(meta[`desiredAmenities.${a}`]));
  return p;
}

export function unconfirmedCount(profile: MemberProfile): number {
  return Object.values(profile.fieldMeta).filter(isUnconfirmedAi).length;
}

/** Share of tracked fields that are confirmed (seed profiles with no meta → 1). */
export function readiness(profile: MemberProfile): number {
  const metas = Object.values(profile.fieldMeta);
  if (metas.length === 0) return 1;
  return metas.filter((m) => m.confirmed).length / metas.length;
}

export function confirmField(profile: MemberProfile, key: FieldKey): MemberProfile {
  const m = profile.fieldMeta[key];
  if (!m) return profile;
  return { ...profile, fieldMeta: { ...profile.fieldMeta, [key]: { ...m, confirmed: true } } };
}

export function confirmAll(profile: MemberProfile): MemberProfile {
  return {
    ...profile,
    fieldMeta: Object.fromEntries(Object.entries(profile.fieldMeta).map(([k, m]) => [k, { ...m, confirmed: true }])),
  };
}

/** Mark a field as edited by the user (keeps the original quote for transparency). */
export function markEdited(profile: MemberProfile, key: FieldKey): MemberProfile {
  const prev = profile.fieldMeta[key];
  return { ...profile, fieldMeta: { ...profile.fieldMeta, [key]: userMeta(prev?.sourceText) } };
}

/** Remove a field: value goes back to neutral and its meta is dropped. */
export function removeField(profile: MemberProfile, key: FieldKey): MemberProfile {
  const fieldMeta = { ...profile.fieldMeta };
  delete fieldMeta[key];
  const p: MemberProfile = { ...profile, fieldMeta, lifestyle: { ...profile.lifestyle }, requirements: { ...profile.requirements } };
  if (key === "budgetMax") p.budgetMax = NEUTRAL_BUDGET;
  else if (key === "travelMode") p.travelMode = NEUTRAL_TRAVEL_MODE;
  else if (key === "hasCar") p.hasCar = false;
  else if (key.startsWith("lifestyle.")) {
    const k = key.slice("lifestyle.".length) as keyof Lifestyle;
    (p.lifestyle as unknown as Record<string, string>)[k] = NEUTRAL_LIFESTYLE[k];
  } else if (key.startsWith("requirements.")) {
    p.requirements[key.slice("requirements.".length) as keyof Requirements] = false;
  } else if (key.startsWith("destinations.")) {
    const id = key.slice("destinations.".length);
    p.destinations = profile.destinations.filter((d) => d.destinationId !== id);
  } else if (key.startsWith("desiredAmenities.")) {
    const a = key.slice("desiredAmenities.".length) as FeatureKey;
    p.desiredAmenities = profile.desiredAmenities.filter((x) => x !== a);
  }
  return p;
}

// ---------- follow-up questions ----------

export type FollowUp =
  | { id: string; kind: "place"; question: string; placeText: string; suggestedDestinationId?: string }
  | { id: string; kind: "budget"; question: string }
  | { id: string; kind: "destinations"; question: string };

/** The mode used when the text doesn't settle one (there is no travel-mode question): bike if it
 *  was one of the options the student mentioned, otherwise walk. An explicit mode always wins. */
export function defaultTravelMode(parse: ProfileParse): TravelMode {
  if (parse.travelMode) return parse.travelMode.value;
  return parse.travelModeOptions?.includes("bike") ? "bike" : NEUTRAL_TRAVEL_MODE;
}

/** Follow-ups, chosen by rules from the parse (spec §8.1 step 5 + §8.3). */
export function buildFollowUps(parse: ProfileParse, opts: { budgetProvided: boolean }): FollowUp[] {
  const out: FollowUp[] = [];
  parse.unmappedPlaces.forEach((u, i) =>
    out.push({ id: `place-${i}`, kind: "place", question: u.question, placeText: u.text, suggestedDestinationId: u.suggestedDestinationId }),
  );
  if (parse.missing.includes("budget") && !parse.budgetMax && !opts.budgetProvided) {
    out.push({ id: "budget", kind: "budget", question: "What's the most you can pay per month, including your share of rent?" });
  }
  if (parse.missing.includes("destinations") && parse.destinations.length === 0) {
    out.push({ id: "destinations", kind: "destinations", question: "Where do you spend most weekdays?" });
  }
  return out;
}

export function addDestination(profile: MemberProfile, destinationId: string, visitsPerWeek: number, sourceText?: string): MemberProfile {
  const next: Destination = { destinationId, visitsPerWeek, importance: importanceFor(visitsPerWeek) };
  return {
    ...profile,
    destinations: [...profile.destinations.filter((d) => d.destinationId !== destinationId), next],
    fieldMeta: { ...profile.fieldMeta, [`destinations.${destinationId}`]: userMeta(sourceText) },
  };
}

export function setTravelMode(profile: MemberProfile, mode: TravelMode): MemberProfile {
  const prev = profile.fieldMeta.travelMode;
  return {
    ...profile,
    travelMode: mode,
    hasCar: mode === "drive" ? true : profile.hasCar,
    fieldMeta: { ...profile.fieldMeta, travelMode: userMeta(prev?.sourceText) },
  };
}

export function setBudget(profile: MemberProfile, budget: number, sourceText?: string): MemberProfile {
  return {
    ...profile,
    budgetMax: Math.max(100, Math.round(budget)),
    fieldMeta: { ...profile.fieldMeta, budgetMax: userMeta(sourceText ?? profile.fieldMeta.budgetMax?.sourceText) },
  };
}

// ---------- this-or-that (spec §8.1 step 6, §7.5) ----------

export interface ThisOrThatOption {
  label: string;
  hint: string;
  dim: Dim;
}

export interface ThisOrThat {
  id: "closer_space" | "rent_amenities" | "private_cheaper" | "quiet_social" | "cooking_convenience";
  prompt: string;
  a: ThisOrThatOption;
  b: ThisOrThatOption;
}

export const THIS_OR_THAT: ThisOrThat[] = [
  {
    id: "closer_space",
    prompt: "Which matters more day to day?",
    a: { label: "Closer to where I go", hint: "Shorter trips to class", dim: "commute" },
    b: { label: "More space at home", hint: "Bigger rooms, more bathrooms", dim: "space" },
  },
  {
    id: "rent_amenities",
    prompt: "If you had to pick one…",
    a: { label: "Lower rent", hint: "Keep more money each month", dim: "affordability" },
    b: { label: "Better amenities", hint: "Laundry, dishwasher, A/C", dim: "amenities" },
  },
  {
    id: "private_cheaper",
    prompt: "Your bedroom situation",
    a: { label: "A room of my own", hint: "Even if it costs more", dim: "space" },
    b: { label: "Cheaper, even if shared", hint: "Split a room to save", dim: "affordability" },
  },
  {
    id: "quiet_social",
    prompt: "What should home feel like?",
    a: { label: "Quiet", hint: "Study and sleep come first", dim: "lifestyle" },
    b: { label: "Social", hint: "Friends over, shared spaces", dim: "lifestyle" },
  },
  {
    id: "cooking_convenience",
    prompt: "Evenings look more like…",
    a: { label: "Cooking at home", hint: "A real kitchen matters", dim: "lifestyle" },
    b: { label: "Grabbing food near campus", hint: "Being close matters more", dim: "commute" },
  },
];

/**
 * Rule-based question selection: skip a question the text already answered.
 * Returns the questions to ask plus the ones skipped (with the quote that answered them).
 */
export function selectThisOrThat(parse: ProfileParse | null): { ask: ThisOrThat[]; skipped: { q: ThisOrThat; because: string }[] } {
  const ask: ThisOrThat[] = [];
  const skipped: { q: ThisOrThat; because: string }[] = [];
  for (const q of THIS_OR_THAT) {
    let because: string | undefined;
    if (q.id === "private_cheaper") because = parse?.requirements.privateBedroom?.sourceText;
    if (q.id === "quiet_social") because = parse?.lifestyle.noise?.sourceText;
    if (q.id === "cooking_convenience") because = parse?.lifestyle.cooking?.sourceText;
    if (because) skipped.push({ q, because });
    else ask.push(q);
  }
  return { ask, skipped };
}

export type ThisOrThatAnswer = "a" | "b" | "either" | "skip";

/** Apply one answer: ±0.05 weight shift via the engine, plus the lifestyle field it implies. */
export function applyThisOrThatAnswer(profile: MemberProfile, q: ThisOrThat, answer: ThisOrThatAnswer): MemberProfile {
  if (answer === "skip") return profile;
  const p: MemberProfile = { ...profile, lifestyle: { ...profile.lifestyle }, fieldMeta: { ...profile.fieldMeta } };
  if (q.id === "quiet_social") {
    p.lifestyle.noise = answer === "a" ? "quiet" : answer === "b" ? "social" : "either";
    p.fieldMeta["lifestyle.noise"] = userMeta();
    return p;
  }
  if (q.id === "cooking_convenience" && answer !== "either") {
    p.lifestyle.cooking = answer === "a" ? "high" : "low";
    p.fieldMeta["lifestyle.cooking"] = userMeta();
  }
  if (answer === "either") return p;
  const chosen = answer === "a" ? q.a.dim : q.b.dim;
  const over = answer === "a" ? q.b.dim : q.a.dim;
  p.weights = applyThisOrThat(p.weights, chosen, over);
  return p;
}

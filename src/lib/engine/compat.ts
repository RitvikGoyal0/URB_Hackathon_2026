import type { Dim, FeatureKey, Id, Lifestyle, MemberProfile, Requirements, TravelMode } from "../types";
import { DIMS } from "../types";
import { cmpStr, money } from "./format";
import { normalizeWeights } from "./weights";

/**
 * Roommate similarity (V3 §5.7). Pure, deterministic and symmetric.
 * Every part of two profiles gives a 0–1 similarity; the score is their weighted average × 100.
 * The two biggest contributors (weight × similarity, only parts with similarity ≥ 0.5) become
 * the reasons, as template sentences built from the profiles.
 */
export type CompatPart = "budget" | "places" | "lifestyle" | "priorities" | "travel" | "mustHaves" | "amenities" | "majorClubs";

export const COMPAT_WEIGHTS: Record<CompatPart, number> = {
  budget: 0.2,
  places: 0.2,
  lifestyle: 0.2,
  priorities: 0.1,
  travel: 0.05,
  mustHaves: 0.1,
  amenities: 0.05,
  majorClubs: 0.1,
};
const PARTS = Object.keys(COMPAT_WEIGHTS) as CompatPart[];

/** ± band around each budget whose overlap measures budget similarity. */
export const BUDGET_BAND = 0.15;

export interface Compat {
  score: number;
  label: "Great match" | "Good match" | "Some overlap" | "Different weeks";
  parts: Record<CompatPart, number>;
  reasons: string[];
}

export function compatLabel(score: number): Compat["label"] {
  if (score >= 80) return "Great match";
  if (score >= 65) return "Good match";
  if (score >= 50) return "Some overlap";
  return "Different weeks";
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);

/** Overlap ÷ union of the two ±15% budget bands (1 = same budget, 0 = no overlap). */
export function budgetSimilarity(a: number, b: number): number {
  const [a0, a1] = [a * (1 - BUDGET_BAND), a * (1 + BUDGET_BAND)];
  const [b0, b1] = [b * (1 - BUDGET_BAND), b * (1 + BUDGET_BAND)];
  const inter = Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  const union = Math.max(a1, b1) - Math.min(a0, b0);
  return union > 0 ? clamp01(inter / union) : 1;
}

/** Share of each person's week by place (campus areas + located custom places by building/pin label). */
function placeShares(m: MemberProfile): Map<string, number> {
  const raw = new Map<string, number>();
  for (const d of m.destinations) if (d.visitsPerWeek > 0) raw.set(d.destinationId, (raw.get(d.destinationId) ?? 0) + d.visitsPerWeek);
  for (const p of m.places ?? []) {
    if (p.visitsPerWeek <= 0) continue;
    const key = p.location.refId ?? `pin:${p.location.lat.toFixed(3)},${p.location.lng.toFixed(3)}`;
    raw.set(key, (raw.get(key) ?? 0) + p.visitsPerWeek);
  }
  const total = [...raw.values()].reduce((s, v) => s + v, 0);
  return new Map([...raw].map(([k, v]) => [k, total > 0 ? v / total : 0]));
}

/** Histogram intersection of where each person spends their week. */
export function placesSimilarity(a: MemberProfile, b: MemberProfile): number {
  const sa = placeShares(a);
  const sb = placeShares(b);
  if (sa.size === 0 && sb.size === 0) return 0.5;
  let s = 0;
  for (const [k, v] of sa) s += Math.min(v, sb.get(k) ?? 0);
  return clamp01(s);
}

const ORDER: { [K in keyof Lifestyle]: Lifestyle[K][] } = {
  noise: ["quiet", "either", "social"],
  cooking: ["low", "medium", "high"],
  guests: ["rare", "sometimes", "often"],
};
/** Exact = 1, adjacent = 0.5, opposite = 0 (averaged over noise, cooking and guests). */
export function lifestyleSimilarity(a: Lifestyle, b: Lifestyle): number {
  const keys = Object.keys(ORDER) as (keyof Lifestyle)[];
  const per: number[] = keys.map((k) => {
    const order = ORDER[k] as string[];
    const d = Math.abs(order.indexOf(a[k]) - order.indexOf(b[k]));
    return d === 0 ? 1 : d === 1 ? 0.5 : 0;
  });
  return per.reduce((s, v) => s + v, 0) / per.length;
}

export function prioritySimilarity(a: MemberProfile["weights"], b: MemberProfile["weights"]): number {
  const wa = normalizeWeights(a);
  const wb = normalizeWeights(b);
  const l1 = DIMS.reduce((s, d) => s + Math.abs(wa[d] - wb[d]), 0);
  return clamp01(1 - l1 / 2);
}

export function travelSimilarity(a: MemberProfile, b: MemberProfile): number {
  if (a.travelMode === b.travelMode) return 1;
  return a.hasCar === b.hasCar ? 0.5 : 0;
}

export function mustHaveSimilarity(a: Requirements, b: Requirements): number {
  const keys = Object.keys(a) as (keyof Requirements)[];
  return keys.filter((k) => a[k] === b[k]).length / keys.length;
}

export function amenitySimilarity(a: FeatureKey[], b: FeatureKey[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  const inter = [...sa].filter((x) => sb.has(x)).length;
  return inter / new Set([...sa, ...sb]).size;
}

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();
function sharedOrgs(a: MemberProfile, b: MemberProfile): string[] {
  const sb = new Set((b.organizations ?? []).map(norm));
  return [...new Set(a.organizations ?? [])].filter((o) => o.trim() && sb.has(norm(o))).sort(cmpStr);
}
/** Same major = 0.5, at least one shared organization = 0.5. */
export function majorClubSimilarity(a: MemberProfile, b: MemberProfile): number {
  const major = norm(a.major) !== "" && norm(a.major) === norm(b.major) ? 0.5 : 0;
  return major + (sharedOrgs(a, b).length > 0 ? 0.5 : 0);
}

// ---------- reasons (templates only) ----------

const MODE_PHRASE: Record<TravelMode, string> = { walk: "walking", bike: "biking", bus: "taking the bus", drive: "driving" };
const DIM_PHRASE: Record<Dim, string> = {
  affordability: "rent",
  commute: "a short commute",
  amenities: "amenities",
  lifestyle: "the right vibe at home",
  space: "space",
};
const AMENITY_PHRASE: Record<FeatureKey, string> = {
  inUnitLaundry: "in-unit laundry",
  dishwasher: "a dishwasher",
  parking: "parking",
  furnished: "a furnished place",
  largeKitchen: "a big kitchen",
  socialAmenities: "social spaces",
  quietBuilding: "a quiet building",
  petFriendly: "pets",
  ac: "A/C",
};

const GUESTS_PHRASE: Record<Lifestyle["guests"], string> = {
  rare: "Both rarely have guests over",
  sometimes: "Both have guests over now and then",
  often: "Both like having people over",
};

function topSharedPlace(a: MemberProfile, b: MemberProfile, placeName: (id: string) => string | undefined): string | null {
  const sa = placeShares(a);
  const sb = placeShares(b);
  const best = [...sa]
    .map(([k, v]) => [k, Math.min(v, sb.get(k) ?? 0)] as const)
    .filter(([, v]) => v > 0)
    .sort((x, y) => y[1] - x[1] || cmpStr(x[0], y[0]))[0];
  return best ? (placeName(best[0]) ?? null) : null;
}

function reasonFor(part: CompatPart, a: MemberProfile, b: MemberProfile, placeName: (id: string) => string | undefined): string | null {
  switch (part) {
    case "budget": {
      const [lo, hi] = [Math.min(a.budgetMax, b.budgetMax), Math.max(a.budgetMax, b.budgetMax)];
      return lo === hi ? `Same budget (${money(lo)})` : `Similar budgets (${money(lo)}–${money(hi)})`;
    }
    case "places": {
      const p = topSharedPlace(a, b, placeName);
      return p ? `Both on ${p} most weeks` : null;
    }
    case "lifestyle": {
      if (a.lifestyle.noise === b.lifestyle.noise && a.lifestyle.noise === "quiet") return "Both want a quiet home";
      if (a.lifestyle.cooking === b.lifestyle.cooking && a.lifestyle.cooking === "high") return "Both love to cook";
      if (a.lifestyle.noise === b.lifestyle.noise && a.lifestyle.noise === "social") return "Both like a social home";
      if (a.lifestyle.guests === b.lifestyle.guests) return GUESTS_PHRASE[a.lifestyle.guests];
      return "Similar habits at home";
    }
    case "priorities": {
      const wa = normalizeWeights(a.weights);
      const wb = normalizeWeights(b.weights);
      const top = [...DIMS].sort((x, y) => wa[y] + wb[y] - (wa[x] + wb[x]) || cmpStr(x, y))[0];
      return `Both care most about ${DIM_PHRASE[top]}`;
    }
    case "travel":
      return a.travelMode === b.travelMode ? `Both get around by ${MODE_PHRASE[a.travelMode]}` : null;
    case "mustHaves":
      return a.requirements.privateBedroom && b.requirements.privateBedroom ? "Both need a private bedroom" : "Same must-haves";
    case "amenities": {
      const shared = a.desiredAmenities.filter((x) => b.desiredAmenities.includes(x)).sort(cmpStr);
      return shared.length ? `Both want ${AMENITY_PHRASE[shared[0]]}` : null;
    }
    case "majorClubs": {
      const orgs = sharedOrgs(a, b);
      if (orgs.length) return `Both in ${orgs[0]}`;
      return a.major ? `Both study ${a.major}` : null;
    }
  }
}

export function compatibility(a: MemberProfile, b: MemberProfile, placeName: (id: string) => string | undefined = () => undefined): Compat {
  const parts: Record<CompatPart, number> = {
    budget: budgetSimilarity(a.budgetMax, b.budgetMax),
    places: placesSimilarity(a, b),
    lifestyle: lifestyleSimilarity(a.lifestyle, b.lifestyle),
    priorities: prioritySimilarity(a.weights, b.weights),
    travel: travelSimilarity(a, b),
    mustHaves: mustHaveSimilarity(a.requirements, b.requirements),
    amenities: amenitySimilarity(a.desiredAmenities, b.desiredAmenities),
    majorClubs: majorClubSimilarity(a, b),
  };
  const raw = PARTS.reduce((s, p) => s + COMPAT_WEIGHTS[p] * parts[p], 0);
  const score = Math.round(raw * 100);
  const reasons = PARTS.filter((p) => parts[p] >= 0.5)
    .sort((x, y) => COMPAT_WEIGHTS[y] * parts[y] - COMPAT_WEIGHTS[x] * parts[x] || PARTS.indexOf(x) - PARTS.indexOf(y))
    .map((p) => reasonFor(p, a, b, placeName))
    .filter((r): r is string => !!r)
    .slice(0, 2);
  return { score, label: compatLabel(score), parts, reasons };
}

/** Candidates ranked by similarity to `me` (highest first, ties by id). */
export function rankRoommates(
  me: MemberProfile,
  candidates: MemberProfile[],
  placeName?: (id: string) => string | undefined,
): { member: MemberProfile; compat: Compat }[] {
  return candidates
    .filter((c) => c.id !== me.id)
    .map((member) => ({ member, compat: compatibility(me, member, placeName) }))
    .sort((x, y) => y.compat.score - x.compat.score || cmpStr(x.member.id as Id, y.member.id as Id));
}

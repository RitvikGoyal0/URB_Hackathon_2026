import type {
  Blocker,
  CampusDestination,
  CommuteMatrix,
  Dim,
  Eligibility,
  Listing,
  MemberProfile,
  MemberResult,
  RankOptions,
  RankedResult,
  Subscore,
  Warning,
  Weights,
} from "../types";
import { DIMS } from "../types";
import { GROUP_MEAN_WEIGHT, GROUP_MIN_WEIGHT, MAX_PEOPLE_PER_SHARED_BEDROOM } from "./constants";
import { FEATURE_LABEL, bedroomsPhrase, capitalize, cmpStr, money, round1 } from "./format";
import { perPersonRent } from "./rent";
import {
  type Scored,
  destinationNameMap,
  scoreAffordability,
  scoreAmenities,
  scoreCommute,
  scoreLifestyle,
  scoreSpace,
} from "./subscores";
import { normalizeWeights } from "./weights";

/**
 * Rank listings for a group (spec §7). Pure and deterministic.
 *
 * - Hard checks (§7.3) produce blockers / warnings; blocked listings are still scored and ranked.
 * - Per-member subscores 0–100 (§7.4); null subscores have their weight redistributed
 *   proportionally (`effectiveWeights`).
 * - groupScore = 0.75 × mean + 0.25 × min over members with a non-null score (§7.6).
 * - coverage.total = 5 dimensions; coverage.evaluated = dimensions for which the listing's data
 *   was sufficient to score EVERY member who has a preference in that dimension. A dimension is
 *   "not evaluated" only when listing data is missing (e.g. unknown rent, or every lifestyle
 *   feature a member cares about is unknown) — not when a member simply has no preference.
 * - eligibility: "blocked" if any blocker; else "eligible_with_unknowns" if coverage < total or a
 *   price / required feature is unverified; else "eligible". Unverified occupancy is reported as a
 *   warning but does not demote the tier (almost no listing publishes it; bedroom count is checked).
 * - Sort: eligible → eligible_with_unknowns → blocked; within a tier by groupScore desc
 *   (null last); ties by listing id ascending. rank = 1..n.
 */
export function rankListings(
  listings: Listing[],
  members: MemberProfile[],
  matrix: CommuteMatrix,
  destinations: CampusDestination[],
  options: RankOptions = {},
): RankedResult[] {
  const groupSize = Math.max(1, options.groupSize ?? members.length);
  const destNames = destinationNameMap(destinations);

  const results = listings.map((listing) => scoreListing(listing, members, matrix, destNames, groupSize));
  results.sort(compareResults);
  results.forEach((r, i) => (r.rank = i + 1));
  return results;
}

const TIER: Record<Eligibility, number> = { eligible: 0, eligible_with_unknowns: 1, blocked: 2 };

export function compareResults(a: RankedResult, b: RankedResult): number {
  const t = TIER[a.eligibility] - TIER[b.eligibility];
  if (t !== 0) return t;
  const ga = a.groupScore ?? -Infinity;
  const gb = b.groupScore ?? -Infinity;
  if (ga !== gb) return gb - ga;
  return cmpStr(a.listingId, b.listingId);
}

function scoreListing(
  listing: Listing,
  members: MemberProfile[],
  matrix: CommuteMatrix,
  destNames: Map<string, string>,
  groupSize: number,
): RankedResult {
  const rent = perPersonRent(listing, groupSize);
  const { blockers, warnings } = hardChecks(listing, members, rent, groupSize);
  const missingDims = new Set<Dim>();

  const perMember: MemberResult[] = members.map((m) => {
    const commute = scoreCommute(listing, m, matrix, destNames);
    const scored: Record<Dim, Scored> = {
      affordability: scoreAffordability(listing, m, rent, groupSize),
      commute,
      amenities: scoreAmenities(listing, m),
      lifestyle: scoreLifestyle(listing, m),
      space: scoreSpace(listing, m, groupSize),
    };
    for (const d of DIMS) if (scored[d].nullCause === "missing_data") missingDims.add(d);
    const subscores = Object.fromEntries(
      DIMS.map((d) => [d, { score: scored[d].score, reason: scored[d].reason, evidence: scored[d].evidence } satisfies Subscore]),
    ) as Record<Dim, Subscore>;
    const { score, effectiveWeights } = weightedScore(subscores, m.weights);
    return { memberId: m.id, score, subscores, effectiveWeights, perPersonRent: rent, commutes: commute.commutes };
  });

  const scoredMembers = perMember.filter((p) => p.score !== null);
  let mean: number | null = null;
  let min: number | null = null;
  let groupScore: number | null = null;
  let leastSatisfiedMemberId: string | null = null;
  if (scoredMembers.length > 0) {
    const scores = scoredMembers.map((p) => p.score as number);
    const rawMean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const rawMin = Math.min(...scores);
    mean = round1(rawMean);
    min = round1(rawMin);
    groupScore = round1(GROUP_MEAN_WEIGHT * rawMean + GROUP_MIN_WEIGHT * rawMin);
    leastSatisfiedMemberId = scoredMembers.find((p) => p.score === rawMin)!.memberId;
  }

  const coverage = { evaluated: DIMS.length - missingDims.size, total: DIMS.length };
  const unverifiedHard = warnings.some((w) => w.kind === "affordability_unverified" || w.kind === "feature_unverified");
  const eligibility: Eligibility =
    blockers.length > 0 ? "blocked" : coverage.evaluated < coverage.total || unverifiedHard ? "eligible_with_unknowns" : "eligible";

  return {
    listingId: listing.id,
    rank: 0,
    groupScore,
    mean,
    min,
    leastSatisfiedMemberId,
    coverage,
    perMember,
    blockers,
    warnings,
    eligibility,
  };
}

/**
 * Weighted member score over non-null subscores. Weights are first normalized to sum 1, then
 * the weight of every null subscore is redistributed proportionally over the computed ones.
 */
export function weightedScore(
  subscores: Record<Dim, Subscore>,
  weights: Weights,
): { score: number | null; effectiveWeights: Weights } {
  const w = normalizeWeights(weights);
  const live = DIMS.filter((d) => subscores[d].score !== null);
  const liveSum = live.reduce((s, d) => s + w[d], 0);
  const effectiveWeights = Object.fromEntries(
    DIMS.map((d) => [d, liveSum > 0 && subscores[d].score !== null ? w[d] / liveSum : 0]),
  ) as Weights;
  if (liveSum <= 0) return { score: null, effectiveWeights };
  const score = live.reduce((s, d) => s + effectiveWeights[d] * (subscores[d].score as number), 0);
  return { score: round1(score), effectiveWeights };
}

/** Hard checks (§7.3). Unknown NEVER satisfies a requirement: it becomes a warning at best. */
export function hardChecks(
  listing: Listing,
  members: MemberProfile[],
  rent: number | null,
  groupSize: number,
): { blockers: Blocker[]; warnings: Warning[] } {
  const blockers: Blocker[] = [];
  const warnings: Warning[] = [];
  const g = Math.max(1, groupSize);
  const br = listing.bedrooms;

  // ---- capacity
  if (listing.maxOccupancy !== undefined && listing.maxOccupancy < g) {
    blockers.push({ kind: "capacity", message: `Max occupancy is ${listing.maxOccupancy}; the group has ${g}.` });
  }
  const tooFewEvenShared = br * MAX_PEOPLE_PER_SHARED_BEDROOM < g;
  if (tooFewEvenShared) {
    blockers.push({
      kind: "capacity",
      message: `${br <= 0 ? capitalize(bedroomsPhrase(br)) : `Only ${bedroomsPhrase(br)}`}: can't fit ${g} people even sharing ${MAX_PEOPLE_PER_SHARED_BEDROOM} per room.`,
    });
  }
  const needPrivate = members.filter((m) => m.requirements.privateBedroom);
  if (br < g) {
    if (needPrivate.length > 0) {
      for (const m of needPrivate) {
        blockers.push({
          kind: "capacity",
          memberId: m.id,
          message: `${br <= 0 ? capitalize(bedroomsPhrase(br)) : `Only ${bedroomsPhrase(br)}`} for ${g} people; ${m.displayName} needs a private bedroom.`,
        });
      }
    } else if (!tooFewEvenShared) {
      warnings.push({ kind: "shared_bedrooms", message: `Shared bedrooms needed (${bedroomsPhrase(br)} for ${g} people).` });
    }
  } else {
    for (const m of needPrivate) {
      if (listing.privateBedrooms === false) {
        blockers.push({ kind: "capacity", memberId: m.id, message: `Bedrooms are shared; ${m.displayName} needs a private bedroom.` });
      } else if (listing.privateBedrooms === null) {
        warnings.push({ kind: "feature_unverified", memberId: m.id, message: `Unverified: private bedrooms (${m.displayName} requires one).` });
      }
    }
  }
  if (listing.maxOccupancy === undefined) {
    warnings.push({ kind: "occupancy_unverified", message: "Occupancy unverified — confirm with property." });
  }

  // ---- budget
  if (rent === null) {
    warnings.push({ kind: "affordability_unverified", message: "Affordability unverified — contact for pricing." });
  } else {
    for (const m of members) {
      if (rent > m.budgetMax) {
        const diff = rent - m.budgetMax;
        blockers.push({ kind: "budget", memberId: m.id, amount: diff, message: `Exceeds ${m.displayName}'s budget by ${money(diff)}/mo.` });
      }
    }
  }

  // ---- required features
  for (const m of members) {
    for (const key of ["parking", "inUnitLaundry"] as const) {
      if (!m.requirements[key]) continue;
      const v = listing.features[key];
      if (v === false) {
        blockers.push({ kind: "required_feature", memberId: m.id, message: `No ${FEATURE_LABEL[key]}; ${m.displayName} requires it.` });
      } else if (v === null) {
        warnings.push({ kind: "feature_unverified", memberId: m.id, message: `Unverified: ${FEATURE_LABEL[key]} (${m.displayName} requires it).` });
      }
    }
  }

  // ---- utilities
  if (listing.rent.utilitiesIncluded === false) {
    warnings.push({
      kind: "utilities_excluded",
      message: `Rent excludes utilities${listing.rent.fees.length === 0 ? " (no utility fee data)" : ""}.`,
    });
  }
  return { blockers, warnings };
}

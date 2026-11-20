import type {
  CampusDestination,
  CommuteMatrix,
  Dim,
  Listing,
  MemberProfile,
  RankOptions,
  RankedResult,
  Subscore,
} from "../types";
import { perPersonRent } from "./rent";

/**
 * STUB — the Engine track replaces this body with the full §7 implementation.
 * Signature is FROZEN: rankListings(listings, members, matrix, destinations, options?)
 */
export function rankListings(
  listings: Listing[],
  members: MemberProfile[],
  _matrix: CommuteMatrix,
  _destinations: CampusDestination[],
  options: RankOptions = {},
): RankedResult[] {
  const groupSize = options.groupSize ?? members.length;
  const stubSub = (): Subscore => ({ score: 50, reason: "stub", evidence: [] });
  const results: RankedResult[] = listings.map((l) => ({
    listingId: l.id,
    rank: 0,
    groupScore: 50,
    mean: 50,
    min: 50,
    leastSatisfiedMemberId: members[0]?.id ?? null,
    coverage: { evaluated: 5, total: 5 },
    perMember: members.map((m) => ({
      memberId: m.id,
      score: 50,
      subscores: Object.fromEntries(
        (["affordability", "commute", "amenities", "lifestyle", "space"] as Dim[]).map((d) => [d, stubSub()]),
      ) as Record<Dim, Subscore>,
      effectiveWeights: m.weights,
      perPersonRent: perPersonRent(l, groupSize),
      commutes: [],
    })),
    blockers: [],
    warnings: [],
    eligibility: "eligible",
  }));
  results.forEach((r, i) => (r.rank = i + 1));
  return results;
}

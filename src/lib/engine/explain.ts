import type { CampusDestination, Explanation, Listing, MemberProfile, RankedResult } from "../types";

/**
 * STUB — Engine track implements §7.7 templates.
 * Signature is FROZEN: explainListing(result, listing, members, destinations)
 */
export function explainListing(
  result: RankedResult,
  _listing: Listing,
  members: MemberProfile[],
  _destinations: CampusDestination[],
): Explanation {
  return {
    summary: "Explanation pending (stub).",
    strengths: [],
    compromise: null,
    perMember: Object.fromEntries(members.map((m) => [m.id, []])),
  };
  void result;
}

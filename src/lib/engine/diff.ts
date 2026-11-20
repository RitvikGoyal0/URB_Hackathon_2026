import type { Listing, MemberProfile, RankedResult, RankingDiff } from "../types";

/**
 * STUB — Engine track implements §7.7 "What changed?".
 * Signature is FROZEN: diffRankings(before, after, ctx)
 * ctx.changedInputs: human-readable input changes, e.g. ["Sam's budget $700 → $850"]
 */
export function diffRankings(
  before: RankedResult[],
  after: RankedResult[],
  ctx: { changedInputs: string[]; listings: Listing[]; members: MemberProfile[] },
): RankingDiff {
  return {
    changedInputs: ctx.changedInputs,
    becameEligible: [],
    becameBlocked: [],
    rankMoves: [],
    newTop: after[0]?.listingId ?? null,
    previousTop: before[0]?.listingId ?? null,
    biggestDriver: null,
    sentences: [],
  };
}

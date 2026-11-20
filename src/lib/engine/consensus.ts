import type { Id, Vote } from "../types";

export type ConsensusLabel =
  | "Awaiting Reviews"
  | "Everyone Interested"
  | "Strong Interest"
  | "Significant Disagreement"
  | "Mixed Opinions"
  | "Under Consideration";

/** Consensus rules for a 4-person group (spec §9). Uses each member's latest vote on the listing. */
export function consensus(votes: Vote[], listingId: Id, groupSize = 4): ConsensusLabel {
  const latest = new Map<Id, Vote>();
  for (const v of votes) {
    if (v.listingId !== listingId) continue;
    const prev = latest.get(v.memberId);
    if (!prev || prev.at <= v.at) latest.set(v.memberId, v);
  }
  const vals = [...latest.values()].map((v) => v.value);
  const interested = vals.filter((v) => v === "interested").length;
  const pass = vals.filter((v) => v === "pass").length;
  if (vals.length < 2) return "Awaiting Reviews";
  if (interested === groupSize) return "Everyone Interested";
  if (interested >= 3 && pass === 0) return "Strong Interest";
  if (pass >= 2) return "Significant Disagreement";
  if (interested > 0 && pass > 0) return "Mixed Opinions";
  return "Under Consideration";
}

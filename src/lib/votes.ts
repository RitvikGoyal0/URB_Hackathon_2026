import type { Vote, VoteValue } from "./types";

/** Latest vote per member for one listing (ties keep the later entry). */
export function latestVotesFor(votes: Vote[], listingId: string): Map<string, VoteValue> {
  const out = new Map<string, VoteValue>();
  for (const v of [...votes].sort((a, b) => a.at.localeCompare(b.at))) if (v.listingId === listingId) out.set(v.memberId, v.value);
  return out;
}

/** "2 Interested · 0 Maybe · 0 Pass · 2 waiting" (V3 §7.7). Votes from people outside the group are ignored. */
export function voteTally(latest: Map<string, VoteValue>, people: { id: string }[]) {
  const count = (k: VoteValue) => people.filter((p) => latest.get(p.id) === k).length;
  const interested = count("interested");
  const maybe = count("maybe");
  const pass = count("pass");
  const waiting = people.length - interested - maybe - pass;
  return { interested, maybe, pass, waiting, text: `${interested} Interested · ${maybe} Maybe · ${pass} Pass · ${waiting} waiting` };
}

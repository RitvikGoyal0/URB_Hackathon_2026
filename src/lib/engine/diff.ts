import type { Blocker, Dim, Id, Listing, MemberProfile, RankedResult, RankingDiff } from "../types";
import { DIMS } from "../types";
import { COMPARE_MIN_POINTS, MUCH_CLOSER_POINTS, RANK_MOVE_THRESHOLD } from "./constants";
import { humanizeId, joinList, round1 } from "./format";
import { busEffectiveMinutes, commuteCurve, destinationWeight } from "./subscores";

/**
 * "What changed?" (spec §7.7). Every sentence is built from the diff data below — nothing
 * is hardcoded.
 *
 * - becameEligible / becameBlocked: blocked ↔ not blocked between the two rankings.
 * - rankMoves: listings whose rank moved by ≥ 2 (sorted by new rank).
 * - newTop / previousTop: the #1 listing after / before (always set when the lists are
 *   non-empty; the top changed iff they differ).
 * - biggestDriver: the largest |subscore delta| for the same (listing, member, dim), searched
 *   first among the listings that changed (new #1, eligibility flips, rank moves), else all.
 * - The comparison clause ("much closer to North Campus for Maya") compares the commute
 *   subscores of the new #1 vs the previous #1 (both in `after`) for the member with the
 *   largest gap, then names that member's destination with the largest weighted gain.
 */
export function diffRankings(
  before: RankedResult[],
  after: RankedResult[],
  ctx: { changedInputs: string[]; listings: Listing[]; members: MemberProfile[] },
): RankingDiff {
  const bMap = new Map(before.map((r) => [r.listingId, r]));
  const aMap = new Map(after.map((r) => [r.listingId, r]));
  const listingName = new Map(ctx.listings.map((l) => [l.id, l.name]));
  const memberById = new Map(ctx.members.map((m) => [m.id, m]));
  const nameOf = (id: Id) => listingName.get(id) ?? id;
  const memberName = (id: Id) => memberById.get(id)?.displayName ?? id;

  const afterSorted = [...after].sort((x, y) => x.rank - y.rank);
  const beforeSorted = [...before].sort((x, y) => x.rank - y.rank);
  const previousTop = beforeSorted[0]?.listingId ?? null;
  const newTop = afterSorted[0]?.listingId ?? null;
  const topChanged = previousTop !== null && newTop !== null && previousTop !== newTop;

  const becameEligible: Id[] = [];
  const becameBlocked: Id[] = [];
  const rankMoves: RankingDiff["rankMoves"] = [];
  for (const a of afterSorted) {
    const b = bMap.get(a.listingId);
    if (!b) continue;
    if (b.eligibility === "blocked" && a.eligibility !== "blocked") becameEligible.push(a.listingId);
    if (b.eligibility !== "blocked" && a.eligibility === "blocked") becameBlocked.push(a.listingId);
    if (Math.abs(b.rank - a.rank) >= RANK_MOVE_THRESHOLD) rankMoves.push({ listingId: a.listingId, from: b.rank, to: a.rank });
  }

  // ---- biggest driver
  const focus = [...(topChanged && newTop ? [newTop] : []), ...becameEligible, ...becameBlocked, ...rankMoves.map((m) => m.listingId)];
  const candidates = [...new Set(focus.length ? focus : afterSorted.map((a) => a.listingId))];
  let biggestDriver: RankingDiff["biggestDriver"] = null;
  let driverBefore = 0;
  let driverAfter = 0;
  for (const id of candidates) {
    const a = aMap.get(id);
    const b = bMap.get(id);
    if (!a || !b) continue;
    for (const am of a.perMember) {
      const bm = b.perMember.find((p) => p.memberId === am.memberId);
      if (!bm) continue;
      for (const dim of DIMS) {
        const as = am.subscores[dim].score;
        const bs = bm.subscores[dim].score;
        if (as === null || bs === null) continue;
        const delta = round1(as - bs);
        if (delta !== 0 && (biggestDriver === null || Math.abs(delta) > Math.abs(biggestDriver.delta))) {
          biggestDriver = { listingId: id, memberId: am.memberId, dim, delta };
          driverBefore = bs;
          driverAfter = as;
        }
      }
    }
  }

  // ---- comparison clause: new #1 vs previous #1, both as scored in `after`
  const comparison = topChanged ? compareTops(aMap.get(newTop!), aMap.get(previousTop!), memberById) : null;

  // ---- sentences
  const sentences: string[] = [];
  if (ctx.changedInputs.length) sentences.push(`Changed: ${ctx.changedInputs.join("; ")}.`);

  let comparisonUsed = false;
  for (const id of becameEligible) {
    const removed = diffBlockers(bMap.get(id)!.blockers, aMap.get(id)!.blockers);
    const budgetFor = [...new Set(removed.filter((x) => x.kind === "budget" && x.memberId).map((x) => memberName(x.memberId!)))];
    let s =
      budgetFor.length > 0 && removed.every((x) => x.kind === "budget")
        ? `${nameOf(id)} became affordable for ${joinList(budgetFor)}`
        : `${nameOf(id)} is no longer blocked${removed[0] ? ` (was: ${stripDot(removed[0].message)})` : ""}`;
    if (id === newTop && comparison) {
      s += `, and ${comparison}`;
      comparisonUsed = true;
    }
    sentences.push(`${s}.`);
  }
  for (const id of becameBlocked) {
    const added = diffBlockers(aMap.get(id)!.blockers, bMap.get(id)!.blockers);
    sentences.push(`${nameOf(id)} is now blocked${added[0] ? `: ${stripDot(added[0].message)}` : ""}.`);
  }
  if (topChanged) {
    const wasRank = bMap.get(newTop!)?.rank;
    const prevNow = aMap.get(previousTop!)?.rank;
    sentences.push(
      `${nameOf(newTop!)} is now #1${wasRank ? ` (was #${wasRank})` : ""}, ahead of ${nameOf(previousTop!)}${prevNow ? ` (now #${prevNow})` : ""}.`,
    );
    if (comparison && !comparisonUsed) sentences.push(`Compared with ${nameOf(previousTop!)}, ${comparison}.`);
  }
  const mentioned = new Set([...(topChanged ? [newTop!, previousTop!] : []), ...becameEligible, ...becameBlocked]);
  const otherMoves = rankMoves
    .filter((m) => !mentioned.has(m.listingId))
    .sort((x, y) => Math.abs(y.to - y.from) - Math.abs(x.to - x.from) || x.to - y.to)
    .slice(0, 3);
  for (const m of otherMoves) {
    sentences.push(`${nameOf(m.listingId)} moved ${m.to < m.from ? "up" : "down"} from #${m.from} to #${m.to}.`);
  }
  if (biggestDriver) {
    sentences.push(
      `Biggest driver: ${memberName(biggestDriver.memberId)}'s ${biggestDriver.dim} score for ${nameOf(biggestDriver.listingId)} ${
        biggestDriver.delta > 0 ? "rose" : "fell"
      } from ${Math.round(driverBefore)} to ${Math.round(driverAfter)}.`,
    );
  }
  if (!topChanged && becameEligible.length === 0 && becameBlocked.length === 0 && rankMoves.length === 0) {
    sentences.push(previousTop ? `${nameOf(previousTop)} stays #1; no listing changed eligibility or moved 2+ places.` : "No listings to compare.");
  }

  return {
    changedInputs: [...ctx.changedInputs],
    becameEligible,
    becameBlocked,
    rankMoves,
    newTop,
    previousTop,
    biggestDriver,
    sentences,
  };
}

function stripDot(s: string): string {
  return s.replace(/\.$/, "");
}

/** Blockers in `from` that are not in `to` (matched by kind + member). */
function diffBlockers(from: Blocker[], to: Blocker[]): Blocker[] {
  const key = (b: Blocker) => `${b.kind}|${b.memberId ?? ""}`;
  const toKeys = new Set(to.map(key));
  return from.filter((b) => !toKeys.has(key(b)));
}

const MODE_NOUN: Record<string, string> = { walk: "walk", bike: "bike ride", drive: "drive", bus: "walk" };

/**
 * "it is much closer to North Campus for Maya (8- vs 40-minute walk)" — from the member whose
 * commute subscore improves most from `prev` to `next`. Falls back to the largest gap in any
 * other dimension. Returns null if no gap reaches COMPARE_MIN_POINTS.
 */
function compareTops(
  next: RankedResult | undefined,
  prev: RankedResult | undefined,
  memberById: Map<Id, MemberProfile>,
): string | null {
  if (!next || !prev) return null;
  let best: { memberId: Id; dim: Dim; gap: number } | null = null;
  let bestCommute: { memberId: Id; gap: number } | null = null;
  for (const nm of next.perMember) {
    const pm = prev.perMember.find((p) => p.memberId === nm.memberId);
    if (!pm) continue;
    for (const dim of DIMS) {
      const a = nm.subscores[dim].score;
      const b = pm.subscores[dim].score;
      if (a === null || b === null) continue;
      const gap = a - b;
      if (dim === "commute" && (bestCommute === null || gap > bestCommute.gap)) bestCommute = { memberId: nm.memberId, gap };
      if (best === null || gap > best.gap) best = { memberId: nm.memberId, dim, gap };
    }
  }
  if (bestCommute && bestCommute.gap >= COMPARE_MIN_POINTS) {
    const member = memberById.get(bestCommute.memberId);
    const nm = next.perMember.find((p) => p.memberId === bestCommute!.memberId)!;
    const pm = prev.perMember.find((p) => p.memberId === bestCommute!.memberId)!;
    const who = member?.displayName ?? bestCommute.memberId;
    const much = bestCommute.gap >= MUCH_CLOSER_POINTS ? "much " : "";
    // destination with the largest weighted gain
    let pick: { id: Id; a: number; b: number; mode: string; gain: number } | null = null;
    for (const t of nm.commutes) {
      const o = pm.commutes.find((x) => x.destinationId === t.destinationId);
      if (!o || t.minutes === null || o.minutes === null) continue;
      const d = member?.destinations.find((x) => x.destinationId === t.destinationId);
      const w = d ? destinationWeight(d.visitsPerWeek, d.importance) || d.importance : 1;
      const eff = (m: number) => (member?.travelMode === "bus" ? busEffectiveMinutes(m) : m);
      const gain = w * (commuteCurve(eff(t.minutes)) - commuteCurve(eff(o.minutes)));
      if (pick === null || gain > pick.gain) pick = { id: t.destinationId, a: t.minutes, b: o.minutes, mode: t.mode, gain };
    }
    if (pick && pick.gain > 0) {
      return `it is ${much}closer to ${humanizeId(pick.id)} for ${who} (${Math.round(pick.a)}- vs ${Math.round(pick.b)}-minute ${MODE_NOUN[pick.mode] ?? pick.mode})`;
    }
    return `it is ${much}closer for ${who}'s regular trips (commute ${Math.round(nm.subscores.commute.score!)} vs ${Math.round(pm.subscores.commute.score!)})`;
  }
  if (best && best.gap >= COMPARE_MIN_POINTS) {
    const who = memberById.get(best.memberId)?.displayName ?? best.memberId;
    const nm = next.perMember.find((p) => p.memberId === best!.memberId)!;
    const pm = prev.perMember.find((p) => p.memberId === best!.memberId)!;
    return `it fits ${who} better on ${best.dim} (${Math.round(nm.subscores[best.dim].score!)} vs ${Math.round(pm.subscores[best.dim].score!)})`;
  }
  return null;
}

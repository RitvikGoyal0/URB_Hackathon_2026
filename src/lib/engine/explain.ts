import type {
  CampusDestination,
  Dim,
  Explanation,
  Id,
  Listing,
  MemberProfile,
  MemberResult,
  RankedResult,
} from "../types";
import { DIMS } from "../types";
import { applyEvidenceRule } from "./rank";
import { DIM_LABEL, FEATURE_LABEL, capitalize, humanizeId, joinList, money } from "./format";
import {
  commuteCurve,
  destinationNameMap,
  destinationWeigher,
  lifestyleRules,
  scoreAmenities,
  spaceParts,
} from "./subscores";

/**
 * Deterministic explanation templates (spec §7.7). No LLM, no hardcoded narratives:
 * every phrase is filled from the ranked result plus the listing / member data it was
 * computed from.
 *
 * contribution(member, dim) = effectiveWeight × (subscore − 50)
 * - strengths: the 2 dimensions with the largest positive mean contribution across members,
 *   each phrased for the member who gains the most.
 * - compromise: the single most negative (member, dim) contribution, naming that member.
 */
export function explainListing(
  result: RankedResult,
  listing: Listing,
  members: MemberProfile[],
  destinations: CampusDestination[],
): Explanation {
  const ctx = makeCtx(result, applyEvidenceRule(listing), members, destinations);
  const contribs: Contribution[] = [];
  for (const pm of result.perMember) {
    const member = ctx.memberById.get(pm.memberId);
    if (!member) continue;
    for (const dim of DIMS) {
      const s = pm.subscores[dim].score;
      if (s === null) continue;
      contribs.push({ member, pm, dim, value: pm.effectiveWeights[dim] * (s - 50) });
    }
  }

  // strengths: by mean contribution per dim over members scored in that dim
  const byDim = DIMS.map((dim) => {
    const cs = contribs.filter((c) => c.dim === dim);
    const mean = cs.length ? cs.reduce((s, c) => s + c.value, 0) / cs.length : 0;
    const best = cs.reduce<Contribution | null>((b, c) => (b === null || c.value > b.value ? c : b), null);
    return { dim, mean, best };
  })
    .filter((x) => x.mean > 0 && x.best !== null && x.best.value > 0)
    .sort((a, b) => b.mean - a.mean || DIMS.indexOf(a.dim) - DIMS.indexOf(b.dim))
    .slice(0, 2);

  const strengths = byDim.map((x) => strengthPhrase(x.best!, ctx));
  const shorts = byDim.map((x) => shortPhrase(x.best!, ctx));

  const worst = contribs.reduce<Contribution | null>((w, c) => (c.value < 0 && (w === null || c.value < w.value) ? c : w), null);
  const compromise = worst ? compromisePhrase(worst, ctx) : null;

  let summary =
    shorts.length === 2
      ? `Strong fit for ${shorts[0]} and ${shorts[1]}.`
      : shorts.length === 1
        ? `Strong fit for ${shorts[0]}.`
        : "No standout strengths for this group.";
  if (compromise) summary += ` ${compromise}`;
  if (result.blockers.length > 0) {
    const more = result.blockers.length - 1;
    summary += ` Not eligible yet: ${result.blockers[0].message}${more > 0 ? ` (+${more} more)` : ""}`;
  }
  if (result.coverage.evaluated < result.coverage.total) {
    summary += ` Scored on ${result.coverage.evaluated} of ${result.coverage.total} categories.`;
  }

  const perMember: Record<Id, string[]> = {};
  for (const m of members) {
    const pm = result.perMember.find((p) => p.memberId === m.id);
    if (!pm) {
      perMember[m.id] = [];
      continue;
    }
    const lines: string[] = [];
    if (pm.score !== null) {
      lines.push(
        `Overall fit ${Math.round(pm.score)}/100${result.leastSatisfiedMemberId === m.id && result.perMember.length > 1 ? " (least satisfied in the group)" : ""}.`,
      );
    } else {
      lines.push("Not enough data to score this home.");
    }
    for (const b of result.blockers) if (b.memberId === m.id) lines.push(`Blocker: ${b.message}`);
    for (const w of result.warnings) if (w.memberId === m.id) lines.push(w.message);
    for (const dim of DIMS) {
      const sub = pm.subscores[dim];
      lines.push(sub.score === null ? `${DIM_LABEL[dim]} — not scored: ${sub.reason}` : `${DIM_LABEL[dim]} ${Math.round(sub.score)}: ${sub.reason}`);
    }
    perMember[m.id] = lines;
  }

  return { summary, strengths, compromise, perMember };
}

// ---------------------------------------------------------------- internals

interface Contribution {
  member: MemberProfile;
  pm: MemberResult;
  dim: Dim;
  value: number;
}

interface Ctx {
  result: RankedResult;
  listing: Listing;
  groupSize: number;
  memberById: Map<Id, MemberProfile>;
  destName: (id: Id) => string;
}

function makeCtx(result: RankedResult, listing: Listing, members: MemberProfile[], destinations: CampusDestination[]): Ctx {
  const names = destinationNameMap(destinations);
  return {
    result,
    listing,
    groupSize: Math.max(1, result.perMember.length || members.length),
    memberById: new Map(members.map((m) => [m.id, m])),
    destName: (id) => names.get(id) ?? humanizeId(id),
  };
}

const MODE_NOUN: Record<string, string> = { walk: "walk", bike: "bike ride", drive: "drive", bus: "bus ride" };

/** "a 31-minute" / "an 8-minute" / "an 18-minute" */
function aMinutes(n: number): string {
  const vowelSound = n === 8 || n === 11 || n === 18 || (n >= 80 && n < 90);
  return `${vowelSound ? "an" : "a"} ${n}-minute`;
}

type Trip = { destinationId: Id; name?: string; minutes: number; mode: string; estimated: boolean; w: number; points: number };

/** Routed trips with the SAME weights the commute score used; zero-weight trips are dropped. */
function trips(c: Contribution): Trip[] {
  const out: Trip[] = [];
  const weightOf = destinationWeigher(c.member);
  for (const t of c.pm.commutes) {
    if (t.minutes === null) continue;
    const d = c.member.destinations.find((x) => x.destinationId === t.destinationId) ?? c.member.places?.find((p) => p.id === t.destinationId);
    if (!d) continue;
    const w = weightOf(d);
    if (!(w > 0)) continue;
    out.push({ destinationId: t.destinationId, name: t.name, minutes: t.minutes, mode: t.mode, estimated: t.estimated, w, points: commuteCurve(t.minutes) });
  }
  return out;
}

function tripText(t: Trip, ctx: Ctx, who: string): string {
  return `${aMinutes(Math.round(t.minutes))} ${MODE_NOUN[t.mode] ?? t.mode}${t.estimated ? " (est.)" : ""} to ${t.name ?? ctx.destName(t.destinationId)} for ${who}`;
}

function rentPct(ctx: Ctx, c: Contribution): { rent: number; pct: number } | null {
  const rent = c.pm.perPersonRent;
  if (rent === null || !(c.member.budgetMax > 0)) return null;
  return { rent, pct: Math.round((rent / c.member.budgetMax) * 100) };
}

function strengthPhrase(c: Contribution, ctx: Ctx): string {
  const who = c.member.displayName;
  switch (c.dim) {
    case "commute": {
      const best = [...trips(c)].sort((a, b) => b.w * b.points - a.w * a.points)[0];
      return best ? `Short commute: ${tripText(best, ctx, who)}.` : `Good commutes for ${who}.`;
    }
    case "affordability": {
      const r = rentPct(ctx, c);
      return r ? `Affordable: ${money(r.rent)}/person is ${r.pct}% of ${who}'s ${money(c.member.budgetMax)} budget.` : `Affordable for ${who}.`;
    }
    case "amenities": {
      const a = scoreAmenities(ctx.listing, c.member);
      return `Has the ${joinList(a.met.map((k) => FEATURE_LABEL[k]))} ${who} wants.`;
    }
    case "lifestyle": {
      const rule = lifestyleRules(c.member, ctx.listing)
        .filter((r) => r.evaluated && r.delta > 0)
        .sort((a, b) => b.delta - a.delta)[0];
      return rule ? `${capitalize(rule.text)} — a fit for ${who}.` : `Lifestyle fit for ${who}.`;
    }
    case "space": {
      const parts = spaceParts(ctx.listing, c.member, ctx.groupSize).filter((p) => p.score !== null);
      const best = [...parts].sort((a, b) => (b.score as number) - (a.score as number))[0];
      return best ? `Room to live: ${best.text} for ${who}.` : `Good space for ${who}.`;
    }
  }
}

function shortPhrase(c: Contribution, ctx: Ctx): string {
  switch (c.dim) {
    case "commute": {
      const best = [...trips(c)].sort((a, b) => b.w * b.points - a.w * a.points)[0];
      return best ? `${ctx.destName(best.destinationId)} commutes` : "commutes";
    }
    case "affordability":
      return "the group's budgets";
    case "amenities": {
      const met = scoreAmenities(ctx.listing, c.member).met;
      return met.length ? `its ${FEATURE_LABEL[met[0]]}` : "amenities";
    }
    case "lifestyle": {
      const rule = lifestyleRules(c.member, ctx.listing)
        .filter((r) => r.evaluated && r.delta > 0)
        .sort((a, b) => b.delta - a.delta)[0];
      return rule ? rule.short : "lifestyle";
    }
    case "space":
      return "living space";
  }
}

function compromisePhrase(c: Contribution, ctx: Ctx): string {
  const who = c.member.displayName;
  const fallback = `Main drawback for ${who}: ${c.pm.subscores[c.dim].reason}`;
  switch (c.dim) {
    case "commute": {
      const worst = [...trips(c)].sort((a, b) => b.w * (100 - b.points) - a.w * (100 - a.points))[0];
      return worst ? `Main drawback: ${tripText(worst, ctx, who)}.` : fallback;
    }
    case "affordability": {
      const r = rentPct(ctx, c);
      if (!r) return fallback;
      return r.rent > c.member.budgetMax
        ? `Main drawback: ${money(r.rent)}/person is ${money(r.rent - c.member.budgetMax)} over ${who}'s budget.`
        : `Main drawback: ${money(r.rent)}/person uses ${r.pct}% of ${who}'s budget.`;
    }
    case "amenities": {
      const a = scoreAmenities(ctx.listing, c.member);
      const bits: string[] = [];
      if (a.missing.length) bits.push(`no ${joinList(a.missing.map((k) => FEATURE_LABEL[k]))}`);
      if (a.unverified.length) bits.push(`${joinList(a.unverified.map((k) => FEATURE_LABEL[k]))} unverified`);
      return bits.length ? `Main drawback for ${who}: ${bits.join("; ")}.` : fallback;
    }
    case "lifestyle": {
      const rule = lifestyleRules(c.member, ctx.listing)
        .filter((r) => r.evaluated && r.delta < 0)
        .sort((a, b) => a.delta - b.delta)[0];
      return rule ? `Main drawback for ${who}: ${rule.text}.` : fallback;
    }
    case "space": {
      const parts = spaceParts(ctx.listing, c.member, ctx.groupSize).filter((p) => p.score !== null);
      const worst = [...parts].sort((a, b) => (a.score as number) - (b.score as number))[0];
      return worst ? `Main drawback for ${who}: ${worst.text}.` : fallback;
    }
  }
}

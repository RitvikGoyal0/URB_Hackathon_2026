/**
 * Property / fuzz tests for the matching engine. Hundreds of seeded random worlds (listings of
 * every housing type, 0–6 bedrooms, every rent basis incl. unknown/null, fees of both scopes,
 * tri-state features, holes in the commute matrix, estimated cells; groups of 1–6 members with
 * every travel mode, empty / unknown / zero-visit destinations, extreme budgets, every
 * requirement combo and degenerate weights). Each property is checked on every world.
 * A failure message includes the seed, so `genWorld(seed)` reproduces it exactly.
 */
import { describe, expect, it } from "vitest";
import { consensus, diffRankings, explainListing, perPersonRent, rankListings } from "@/lib/engine";
import { DIMS, type Listing, type MemberProfile, type RankedResult, type Vote, type VoteValue } from "@/lib/types";
import {
  BAD_TEXT,
  FUZZ_DESTS,
  allStrings,
  chance,
  deepFreeze,
  genWorld,
  int,
  mulberry32,
  pick,
  shuffle,
  type World,
} from "./gen";

const SEEDS = Array.from({ length: 300 }, (_, i) => 1000 + i * 7919);
const EPS = 1e-9;
const TIER = { eligible: 0, eligible_with_unknowns: 1, blocked: 2 } as const;

const rank = (w: World, members: MemberProfile[] = w.members, listings: Listing[] = w.listings) =>
  rankListings(listings, members, w.matrix, FUZZ_DESTS);

const byId = (rs: RankedResult[]) => new Map(rs.map((r) => [r.listingId, r]));
const blockerKeys = (r: RankedResult) => r.blockers.map((b) => `${b.kind}|${b.memberId ?? ""}`).sort();
const isSubBag = (sub: string[], sup: string[]) => {
  const left = [...sup];
  return sub.every((k) => {
    const i = left.indexOf(k);
    if (i < 0) return false;
    left.splice(i, 1);
    return true;
  });
};
const inRange = (x: number | null) => x === null || (Number.isFinite(x) && x >= 0 && x <= 100);

function forAllWorlds(fn: (w: World, seed: number) => void) {
  for (const seed of SEEDS) {
    try {
      fn(genWorld(seed), seed);
    } catch (e) {
      (e as Error).message = `[seed ${seed}] ${(e as Error).message}`;
      throw e;
    }
  }
}

describe("generator sanity (the properties below are not vacuous)", () => {
  it("the fuzz corpus hits every tier, null scores, unknown rent, compromises and eligibility flips", () => {
    const seen = new Set<string>();
    forAllWorlds((w, seed) => {
      const rs = rank(w);
      for (const r of rs) {
        seen.add(r.eligibility);
        if (r.groupScore === null) seen.add("null-group");
        if (r.perMember.some((p) => p.perPersonRent === null)) seen.add("unknown-rent");
        if (r.perMember.some((p) => p.subscores.commute.score === null)) seen.add("null-commute");
        if (r.blockers.some((b) => b.kind === "required_feature")) seen.add("feature-blocker");
        if (r.coverage.evaluated < 5) seen.add("partial-coverage");
        const e = explainListing(r, w.listings.find((l) => l.id === r.listingId)!, w.members, FUZZ_DESTS);
        if (e.compromise) seen.add("compromise");
        if (e.strengths.length === 2) seen.add("two-strengths");
      }
      const raised = w.members.map((m) => ({ ...m, budgetMax: m.budgetMax + 400 }));
      const d = diffRankings(rs, rank(w, raised), { changedInputs: [], listings: w.listings, members: raised });
      if (d.becameEligible.length) seen.add("became-eligible");
      if (d.newTop !== d.previousTop) seen.add("top-changed");
      if (w.members.some((m) => m.travelMode === "bus")) seen.add("bus");
      void seed;
    });
    for (const k of ["eligible", "eligible_with_unknowns", "blocked", "null-group", "unknown-rent", "null-commute", "feature-blocker", "partial-coverage", "compromise", "two-strengths", "became-eligible", "top-changed", "bus"]) {
      expect(seen.has(k), k).toBe(true);
    }
  });
});

describe("properties: scores and aggregation", () => {
  it("every subscore, member score, mean, min and groupScore is null or finite in [0, 100]", () => {
    forAllWorlds((w) => {
      for (const r of rank(w)) {
        expect(inRange(r.groupScore) && inRange(r.mean) && inRange(r.min)).toBe(true);
        for (const pm of r.perMember) {
          expect(inRange(pm.score)).toBe(true);
          for (const d of DIMS) expect(inRange(pm.subscores[d].score), `${r.listingId}/${pm.memberId}/${d}`).toBe(true);
        }
      }
    });
  });

  it("groupScore = 0.75·mean + 0.25·min (within rounding) and min ≤ groupScore ≤ mean", () => {
    forAllWorlds((w) => {
      for (const r of rank(w)) {
        const scores = r.perMember.map((p) => p.score).filter((s): s is number => s !== null);
        if (scores.length === 0) {
          expect([r.groupScore, r.mean, r.min, r.leastSatisfiedMemberId]).toEqual([null, null, null, null]);
          continue;
        }
        const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
        const min = Math.min(...scores);
        expect(Math.abs(r.groupScore! - (0.75 * mean + 0.25 * min))).toBeLessThanOrEqual(0.05 + EPS);
        expect(Math.abs(r.mean! - mean)).toBeLessThanOrEqual(0.05 + EPS);
        expect(r.min).toBe(min);
        expect(r.min!).toBeLessThanOrEqual(r.groupScore! + EPS);
        expect(r.groupScore!).toBeLessThanOrEqual(r.mean! + EPS);
        expect(r.perMember.find((p) => p.memberId === r.leastSatisfiedMemberId)!.score).toBe(min);
      }
    });
  });

  it("effectiveWeights sum to 1 (all 0 when the member score is null), are exactly 0 for null subscores, and reproduce the score", () => {
    forAllWorlds((w) => {
      for (const r of rank(w)) {
        for (const pm of r.perMember) {
          const sum = DIMS.reduce((s, d) => s + pm.effectiveWeights[d], 0);
          for (const d of DIMS) {
            expect(pm.effectiveWeights[d]).toBeGreaterThanOrEqual(0);
            if (pm.subscores[d].score === null) expect(pm.effectiveWeights[d]).toBe(0);
          }
          if (pm.score === null) {
            expect(sum).toBe(0);
          } else {
            expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
            const recomputed = DIMS.reduce((s, d) => s + pm.effectiveWeights[d] * (pm.subscores[d].score ?? 0), 0);
            expect(Math.abs(recomputed - pm.score)).toBeLessThanOrEqual(0.05 + EPS);
          }
        }
      }
    });
  });

  it("coverage: total is 5; unknown rent always costs the affordability category", () => {
    forAllWorlds((w) => {
      const ls = byId(rank(w));
      for (const l of w.listings) {
        const r = ls.get(l.id)!;
        expect(r.coverage.total).toBe(5);
        expect(r.coverage.evaluated).toBeGreaterThanOrEqual(0);
        expect(r.coverage.evaluated).toBeLessThanOrEqual(5);
        if (perPersonRent(l, w.members.length) === null) expect(r.coverage.evaluated).toBeLessThan(5);
      }
    });
  });
});

describe("properties: rent", () => {
  it("unknown / null rent → null everywhere (never 0); known rent follows §7.2 exactly; per-bed/person amount is never divided", () => {
    forAllWorlds((w) => {
      const ls = byId(rank(w));
      for (const l of w.listings) {
        // V3 §5.3: per room, i.e. ÷ bedrooms (a studio is one room), never ÷ group size
        const g = Math.max(1, l.bedrooms);
        const rent = perPersonRent(l, g);
        const unit = l.rent.fees.filter((f) => f.scope === "per_unit").reduce((s, f) => s + f.monthly, 0);
        const person = l.rent.fees.filter((f) => f.scope === "per_person").reduce((s, f) => s + f.monthly, 0);
        if (l.rent.basis === "unknown" || l.rent.amount === null) {
          expect(rent).toBeNull();
        } else if (l.rent.basis === "per_unit") {
          expect(rent).toBe(Math.round((l.rent.amount + unit) / g + person));
        } else {
          expect(rent).toBe(Math.round(l.rent.amount + person + unit / g));
          expect(rent!).toBeGreaterThanOrEqual(l.rent.amount);
          // independent of group size when there are no unit fees
          if (unit === 0) for (const k of [1, 2, 3, 4, 5, 6]) expect(perPersonRent(l, k)).toBe(rent);
        }
        if (rent !== null) expect(rent).toBeGreaterThan(0);
        for (const pm of ls.get(l.id)!.perMember) expect(pm.perPersonRent).toBe(rent);
      }
    });
  });
});

describe("properties: hard checks and eligibility", () => {
  it("eligibility is consistent with blockers / warnings / coverage", () => {
    forAllWorlds((w) => {
      for (const r of rank(w)) {
        expect(r.eligibility === "blocked").toBe(r.blockers.length > 0);
        if (r.eligibility === "eligible") {
          expect(r.coverage.evaluated).toBe(r.coverage.total);
          expect(r.warnings.some((x) => x.kind === "affordability_unverified" || x.kind === "feature_unverified")).toBe(false);
        }
        for (const b of r.blockers) {
          if (b.memberId !== undefined) expect(w.members.some((m) => m.id === b.memberId)).toBe(true);
          if (b.kind === "budget") expect(b.amount!).toBeGreaterThan(0);
        }
      }
    });
  });

  it("budget blockers fire exactly when per-person rent > budget, with the right dollar amount", () => {
    forAllWorlds((w) => {
      const ls = byId(rank(w));
      for (const l of w.listings) {
        const rent = perPersonRent(l, Math.max(1, l.bedrooms));
        const r = ls.get(l.id)!;
        for (const m of w.members) {
          const b = r.blockers.find((x) => x.kind === "budget" && x.memberId === m.id);
          if (rent !== null && rent > m.budgetMax) {
            expect(b?.amount).toBe(rent - m.budgetMax);
          } else {
            expect(b).toBeUndefined();
          }
        }
      }
    });
  });

  it("unknown never satisfies a requirement: a null required feature is a warning for that member and never 'eligible'", () => {
    forAllWorlds((w) => {
      const g = w.members.length;
      const ls = byId(rank(w));
      for (const l of w.listings) {
        const r = ls.get(l.id)!;
        for (const m of w.members) {
          const checks: [boolean, boolean | null][] = [
            [m.requirements.parking, l.features.parking],
            [m.requirements.inUnitLaundry, l.features.inUnitLaundry],
            [m.requirements.privateBedroom && l.bedrooms >= g, l.privateBedrooms],
          ];
          for (const [required, value] of checks) {
            if (!required || value !== null) continue;
            expect(r.warnings.some((x) => x.kind === "feature_unverified" && x.memberId === m.id)).toBe(true);
            expect(r.eligibility).not.toBe("eligible");
          }
        }
      }
    });
  });
});

describe("properties: ordering", () => {
  it("ranks are exactly 1..n; tiers never interleave; groupScore non-increasing within a tier (null last); ties by id", () => {
    forAllWorlds((w) => {
      const rs = rank(w);
      expect(rs.map((r) => r.rank)).toEqual(rs.map((_, i) => i + 1));
      expect(new Set(rs.map((r) => r.listingId)).size).toBe(rs.length);
      for (let i = 1; i < rs.length; i++) {
        const a = rs[i - 1];
        const b = rs[i];
        expect(TIER[a.eligibility]).toBeLessThanOrEqual(TIER[b.eligibility]);
        if (a.eligibility !== b.eligibility) continue;
        const ga = a.groupScore ?? -Infinity;
        const gb = b.groupScore ?? -Infinity;
        expect(ga).toBeGreaterThanOrEqual(gb);
        if (ga === gb) expect(a.listingId < b.listingId).toBe(true);
      }
    });
  });

  it("determinism: same input → identical output; shuffled listings → identical scores and order", () => {
    forAllWorlds((w, seed) => {
      const a = rank(w);
      expect(rank(w)).toEqual(a);
      const shuffled = shuffle(mulberry32(seed + 1), w.listings);
      expect(rank(w, w.members, shuffled)).toEqual(a);
    });
  });

  it("purity: deep-frozen inputs are accepted and left unchanged by rank / explain / diff", () => {
    forAllWorlds((w) => {
      const snapshot = JSON.stringify(w);
      deepFreeze(w);
      const rs = rank(w);
      const before = deepFreeze(structuredClone(rs));
      for (const r of before) explainListing(r, w.listings.find((l) => l.id === r.listingId)!, w.members, FUZZ_DESTS);
      diffRankings(before, before, deepFreeze({ changedInputs: ["x"], listings: w.listings, members: w.members }));
      expect(JSON.stringify(w)).toBe(snapshot);
    });
  });
});

describe("properties: monotonicity", () => {
  it("raising one member's budget never adds a blocker, never lowers their affordability, and leaves others untouched", () => {
    forAllWorlds((w, seed) => {
      const r = mulberry32(seed + 2);
      const who = pick(r, w.members);
      const raised = w.members.map((m) => (m.id === who.id ? { ...m, budgetMax: m.budgetMax + int(r, 1, 600) } : m));
      const A = byId(rank(w));
      const B = byId(rank(w, raised));
      for (const [id, a] of A) {
        const b = B.get(id)!;
        expect(isSubBag(blockerKeys(b), blockerKeys(a))).toBe(true);
        if (a.eligibility !== "blocked") expect(b.eligibility).toBe(a.eligibility);
        for (const pa of a.perMember) {
          const pb = b.perMember.find((p) => p.memberId === pa.memberId)!;
          if (pa.memberId === who.id) {
            const sa = pa.subscores.affordability.score;
            const sb = pb.subscores.affordability.score;
            if (sa !== null) expect(sb!).toBeGreaterThanOrEqual(sa);
          } else {
            expect(pb).toEqual(pa);
          }
        }
      }
    });
  });

  it("lowering a listing's rent never lowers anyone's affordability and never adds a budget blocker", () => {
    forAllWorlds((w, seed) => {
      const r = mulberry32(seed + 3);
      const cheaper = w.listings.map((l) =>
        l.rent.amount === null ? l : { ...l, rent: { ...l.rent, amount: Math.max(1, l.rent.amount - int(r, 1, 800)) } },
      );
      const A = byId(rank(w));
      const B = byId(rank(w, w.members, cheaper));
      for (const [id, a] of A) {
        const b = B.get(id)!;
        expect(isSubBag(blockerKeys(b), blockerKeys(a))).toBe(true);
        for (const pa of a.perMember) {
          const pb = b.perMember.find((p) => p.memberId === pa.memberId)!;
          if (pa.subscores.affordability.score !== null) {
            expect(pb.subscores.affordability.score!).toBeGreaterThanOrEqual(pa.subscores.affordability.score);
          }
        }
      }
    });
  });

  it("flipping a required feature null → true never adds a blocker or a warning", () => {
    forAllWorlds((w) => {
      const upgraded = w.listings.map((l) => ({
        ...l,
        privateBedrooms: l.privateBedrooms ?? true,
        features: { ...l.features, parking: l.features.parking ?? true, inUnitLaundry: l.features.inUnitLaundry ?? true },
      }));
      const A = byId(rank(w));
      const B = byId(rank(w, w.members, upgraded));
      for (const [id, a] of A) {
        const b = B.get(id)!;
        expect(isSubBag(blockerKeys(b), blockerKeys(a))).toBe(true);
        expect(b.warnings.length).toBeLessThanOrEqual(a.warnings.length);
        expect(TIER[b.eligibility]).toBeLessThanOrEqual(TIER[a.eligibility]);
      }
    });
  });

  it("adding a bedroom never adds a capacity blocker", () => {
    forAllWorlds((w) => {
      const bigger = w.listings.map((l) => ({ ...l, bedrooms: l.bedrooms + 1 }));
      const A = byId(rank(w));
      const B = byId(rank(w, w.members, bigger));
      for (const [id, a] of A) {
        const cap = (r: RankedResult) => r.blockers.filter((x) => x.kind === "capacity").length;
        expect(cap(B.get(id)!)).toBeLessThanOrEqual(cap(a));
      }
    });
  });
});

describe("properties: explanations", () => {
  it("explainListing never throws, never prints NaN/undefined/null/Infinity/$-, and only names group members", () => {
    forAllWorlds((w) => {
      const names = new Set(w.members.map((m) => m.displayName));
      for (const r of rank(w)) {
        const l = w.listings.find((x) => x.id === r.listingId)!;
        const e = explainListing(r, l, w.members, FUZZ_DESTS);
        const strings = [...allStrings(e), ...allStrings(r)];
        for (const s of strings) {
          expect(s, s).not.toMatch(BAD_TEXT);
          for (const n of s.match(/Mem\d+/g) ?? []) expect(names.has(n), s).toBe(true);
        }
        expect(Object.keys(e.perMember).sort()).toEqual(w.members.map((m) => m.id).sort());
        expect(e.strengths.length).toBeLessThanOrEqual(2);
      }
    });
  });

  it("the compromise names exactly the member with the most negative weight × (subscore − 50)", () => {
    forAllWorlds((w) => {
      const memberName = new Map(w.members.map((m) => [m.id, m.displayName]));
      for (const r of rank(w)) {
        const l = w.listings.find((x) => x.id === r.listingId)!;
        const e = explainListing(r, l, w.members, FUZZ_DESTS);
        let worst: { id: string; v: number } | null = null;
        for (const pm of r.perMember)
          for (const d of DIMS) {
            const s = pm.subscores[d].score;
            if (s === null) continue;
            const v = pm.effectiveWeights[d] * (s - 50);
            if (v < 0 && (worst === null || v < worst.v)) worst = { id: pm.memberId, v };
          }
        if (worst === null) {
          expect(e.compromise).toBeNull();
          continue;
        }
        const named = (e.compromise!.match(/Mem\d+/g) ?? []).filter((x, i, a) => a.indexOf(x) === i);
        expect(named, e.compromise!).toEqual([memberName.get(worst.id)]);
      }
    });
  });
});

describe("properties: What changed?", () => {
  it("diffRankings(before, before): no flips, no moves, top unchanged, no driver", () => {
    forAllWorlds((w) => {
      const rs = rank(w);
      const d = diffRankings(rs, rs, { changedInputs: [], listings: w.listings, members: w.members });
      expect(d.becameEligible).toEqual([]);
      expect(d.becameBlocked).toEqual([]);
      expect(d.rankMoves).toEqual([]);
      expect(d.newTop).toBe(d.previousTop);
      expect(d.biggestDriver).toBeNull();
      expect(d.sentences).toHaveLength(1);
      expect(d.sentences[0]).toMatch(/stays #1/);
    });
  });

  it("after a random budget change, flips/moves/top match the rankings and sentences are clean", () => {
    forAllWorlds((w, seed) => {
      const r = mulberry32(seed + 4);
      const members = w.members.map((m) => (chance(r, 0.5) ? { ...m, budgetMax: Math.max(1, m.budgetMax + int(r, -500, 500)) } : m));
      const before = rank(w);
      const after = rank(w, members);
      const d = diffRankings(before, after, { changedInputs: ["Budgets changed"], listings: w.listings, members });
      const B = byId(before);
      const expectEligible = after.filter((a) => B.get(a.listingId)!.eligibility === "blocked" && a.eligibility !== "blocked").map((a) => a.listingId);
      const expectBlocked = after.filter((a) => B.get(a.listingId)!.eligibility !== "blocked" && a.eligibility === "blocked").map((a) => a.listingId);
      expect(d.becameEligible).toEqual(expectEligible);
      expect(d.becameBlocked).toEqual(expectBlocked);
      expect(d.previousTop).toBe(before[0]?.listingId ?? null);
      expect(d.newTop).toBe(after[0]?.listingId ?? null);
      for (const m of d.rankMoves) {
        expect(Math.abs(m.from - m.to)).toBeGreaterThanOrEqual(2);
        expect(B.get(m.listingId)!.rank).toBe(m.from);
      }
      const moved = after.filter((a) => Math.abs(B.get(a.listingId)!.rank - a.rank) >= 2).length;
      expect(d.rankMoves).toHaveLength(moved);
      if (d.biggestDriver) {
        expect(d.biggestDriver.delta).not.toBe(0);
        expect(members.some((m) => m.id === d.biggestDriver!.memberId)).toBe(true);
      }
      for (const s of d.sentences) expect(s, s).not.toMatch(BAD_TEXT);
    });
  });
});

describe("properties: consensus (§9) — exhaustive for 4 members", () => {
  const VALUES: (VoteValue | null)[] = ["interested", "maybe", "pass", null];
  /** Independent restatement of the §9 rules. */
  const expected = (vals: VoteValue[]) => {
    const i = vals.filter((v) => v === "interested").length;
    const p = vals.filter((v) => v === "pass").length;
    if (vals.length < 2) return "Awaiting Reviews";
    if (i === 4) return "Everyone Interested";
    if (i >= 3 && p === 0) return "Strong Interest";
    if (p >= 2 || (i >= 1 && p >= 2)) return "Significant Disagreement";
    if (i > 0 && p > 0) return "Mixed Opinions";
    return "Under Consideration";
  };

  it("all 4^4 combinations of interested / maybe / pass / no vote match the rules, in any vote order", () => {
    const r = mulberry32(42);
    let n = 0;
    for (let code = 0; code < 256; code++) {
      const combo = [0, 1, 2, 3].map((k) => VALUES[(code >> (2 * k)) & 3]);
      const votes: Vote[] = combo.flatMap((v, k) => (v ? [{ memberId: `m${k}`, listingId: "L", value: v, at: `2026-11-20T10:0${k}:00Z` }] : []));
      const want = expected(combo.filter((v): v is VoteValue => v !== null));
      expect(consensus(votes, "L"), JSON.stringify(combo)).toBe(want);
      expect(consensus(shuffle(r, votes), "L")).toBe(want);
      n++;
    }
    expect(n).toBe(256);
  });

  it("the latest vote per member wins regardless of array order; other listings are ignored", () => {
    const r = mulberry32(7);
    for (let t = 0; t < 300; t++) {
      const votes: Vote[] = [];
      const final = new Map<string, VoteValue>();
      for (let k = 0; k < 4; k++) {
        const history = int(r, 0, 4);
        for (let h = 0; h < history; h++) {
          const v = pick(r, ["interested", "maybe", "pass"] as const);
          votes.push({ memberId: `m${k}`, listingId: "L", value: v, at: `2026-11-20T1${k}:${String(h).padStart(2, "0")}:00Z` });
          final.set(`m${k}`, v);
        }
        votes.push({ memberId: `m${k}`, listingId: "OTHER", value: "pass", at: "2026-11-21T00:00:00Z" });
      }
      expect(consensus(shuffle(r, votes), "L")).toBe(expected([...final.values()]));
    }
  });
});

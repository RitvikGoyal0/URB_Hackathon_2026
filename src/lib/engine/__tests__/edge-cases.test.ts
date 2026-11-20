/**
 * Targeted edge cases for the matching engine — the boundaries and degenerate inputs that the
 * spec-level tests (rank / rent / explain / diff) don't pin down.
 */
import { describe, expect, it } from "vitest";
import { diffRankings, explainListing, perPersonRent, rankListings } from "@/lib/engine";
import { DIMS, type MemberProfile } from "@/lib/types";
import { DESTS, makeListing, makeMatrix, makeMember } from "./fixtures";
import { BAD_TEXT, allStrings } from "./gen";

const jo = makeMember("jo", "Jordan", { budgetMax: 1000 });
const one = (listing = makeListing("a"), members: MemberProfile[] = [jo], times: Record<string, number> = { central: 10 }) =>
  rankListings([listing], members, makeMatrix({ [listing.id]: times }), DESTS)[0];
const explain = (listing = makeListing("a"), members: MemberProfile[] = [jo], times: Record<string, number> = { central: 10 }) => {
  const r = one(listing, members, times);
  return { r, e: explainListing(r, listing, members, DESTS) };
};
const clean = (v: unknown) => {
  for (const s of allStrings(v)) expect(s, s).not.toMatch(BAD_TEXT);
};

describe("degenerate inputs", () => {
  it("empty listings → empty ranking; diff of two empty rankings says so", () => {
    expect(rankListings([], [jo], makeMatrix({}), DESTS)).toEqual([]);
    const d = diffRankings([], [], { changedInputs: [], listings: [], members: [jo] });
    expect(d).toMatchObject({ newTop: null, previousTop: null, biggestDriver: null, becameEligible: [], becameBlocked: [] });
    expect(d.sentences).toEqual(["No listings to compare."]);
  });

  it("empty members → every listing ranked with null scores, no member blockers, explanation still renders", () => {
    const rs = rankListings([makeListing("b"), makeListing("a")], [], makeMatrix({}), DESTS);
    expect(rs.map((r) => [r.listingId, r.rank])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    for (const r of rs) {
      expect([r.groupScore, r.mean, r.min, r.leastSatisfiedMemberId]).toEqual([null, null, null, null]);
      expect(r.perMember).toEqual([]);
      expect(r.blockers).toEqual([]);
      const e = explainListing(r, makeListing(r.listingId), [], DESTS);
      expect(e.compromise).toBeNull();
      expect(e.strengths).toEqual([]);
      clean(e);
    }
  });

  it("group of one in a studio: per-unit rent is the whole unit, groupScore equals the member score", () => {
    const { r, e } = explain(makeListing("a", { bedrooms: 0, rent: { amount: 1200, basis: "per_unit" } }), [jo]);
    expect(r.perMember[0].perPersonRent).toBe(1200);
    expect(r.groupScore).toBe(r.perMember[0].score);
    expect(r.mean).toBe(r.min);
    expect(r.perMember[0].subscores.affordability.evidence[0]).toMatch(/^\$1,200\/unit ÷ 1 room = \$1,200\/room/);
    // a group of one has no "least satisfied in the group"
    expect(e.perMember.jo[0]).not.toMatch(/least satisfied/);
  });

  it("weights all zero → spec defaults; NaN / negative / Infinity weights are treated as 0", () => {
    const zero = makeMember("z", "Zed", { weights: { affordability: 0, commute: 0, amenities: 0, lifestyle: 0, space: 0 } });
    const def = makeMember("z", "Zed");
    expect(one(makeListing("a"), [zero]).perMember[0]).toEqual(one(makeListing("a"), [def]).perMember[0]);
    const weird = makeMember("w", "Wen", { weights: { affordability: NaN, commute: -1, amenities: Infinity, lifestyle: 0, space: 2 } });
    const pm = one(makeListing("a"), [weird]).perMember[0];
    expect(pm.effectiveWeights).toEqual({ affordability: 0, commute: 0, amenities: 0, lifestyle: 0, space: 1 });
    expect(pm.score).toBe(pm.subscores.space.score);
  });

  it("unnormalized weights give the same result as their normalized form", () => {
    const a = makeMember("m", "M", { weights: { affordability: 3, commute: 2.5, amenities: 2, lifestyle: 1.5, space: 1 } });
    const b = makeMember("m", "M");
    expect(one(makeListing("a"), [a]).perMember[0].score).toBe(one(makeListing("a"), [b]).perMember[0].score);
  });

  it("ties: identical listings are ordered by id, independent of input order", () => {
    const ids = ["b", "a", "c", "a2", "A"];
    const ls = ids.map((id) => makeListing(id));
    const m = makeMatrix(Object.fromEntries(ids.map((id) => [id, { central: 12 }])));
    const rs = rankListings(ls, [jo], m, DESTS);
    expect(new Set(rs.map((r) => r.groupScore)).size).toBe(1);
    expect(rs.map((r) => r.listingId)).toEqual(["A", "a", "a2", "b", "c"]); // code-unit order, not locale
    expect(rankListings([...ls].reverse(), [jo], m, DESTS)).toEqual(rs);
  });

  it("a non-integer or non-finite groupSize option is sanitized consistently (rent, capacity and space agree)", () => {
    const l = makeListing("a", { bedrooms: 2, maxOccupancy: undefined, rent: { amount: 2000, basis: "per_unit" } });
    const m = makeMatrix({ a: { central: 10 } });
    const two = rankListings([l], [jo], m, DESTS, { groupSize: 2 })[0];
    const frac = rankListings([l], [jo], m, DESTS, { groupSize: 2.5 })[0];
    expect(frac).toEqual(two);
    for (const gs of [NaN, Infinity, -3, 0]) {
      const r = rankListings([l], [jo], m, DESTS, { groupSize: gs })[0];
      expect(r).toEqual(rankListings([l], [jo], m, DESTS)[0]);
      clean(r);
    }
  });
});

describe("rent edge cases", () => {
  it("budget exactly equal to per-person rent is NOT blocked (affordability 50); $1 over is blocked by exactly $1", () => {
    const at = one(makeListing("a", { rent: { amount: 1000, basis: "per_bedroom" } }));
    expect(at.blockers).toEqual([]);
    expect(at.perMember[0].subscores.affordability.score).toBe(50);
    const over = one(makeListing("a", { rent: { amount: 1001, basis: "per_bedroom" } }));
    expect(over.blockers).toEqual([{ kind: "budget", memberId: "jo", amount: 1, message: "Exceeds Jordan's budget by $1/mo." }]);
    expect(over.perMember[0].subscores.affordability.score).toBe(0);
  });

  it("per-unit split that rounds to the budget is not blocked; fees can push it over", () => {
    const a = makeMember("a", "Ana", { budgetMax: 1099 });
    const four = [a, ...["b", "c", "d"].map((id) => makeMember(id, id.toUpperCase(), { budgetMax: 1500 }))];
    const geddes = makeListing("g", { rent: { amount: 4396, basis: "per_unit" } }); // 1099.00
    expect(one(geddes, four).blockers).toEqual([]);
    const withFee = makeListing("g", { rent: { amount: 4396, basis: "per_unit", fees: [{ label: "Trash", monthly: 4, scope: "per_unit" }] } }); // 1100
    expect(one(withFee, four).blockers).toMatchObject([{ kind: "budget", memberId: "a", amount: 1 }]);
  });

  it("amountMax below amount is ignored (scored on amount, no bogus range line)", () => {
    const r = one(makeListing("a", { rent: { amount: 900, amountMax: 700, basis: "per_bedroom" } }));
    expect(r.perMember[0].perPersonRent).toBe(900);
    expect(r.perMember[0].subscores.affordability.evidence.join("\n")).not.toMatch(/range/);
  });

  it("fees on an unknown-rent listing never produce a price", () => {
    for (const [amount, basis] of [
      [null, "per_unit"],
      [null, "per_bedroom"],
      [1500, "unknown"],
      [null, "unknown"],
    ] as const) {
      const l = makeListing("a", {
        rent: { amount, basis, fees: [{ label: "Parking", monthly: 75, scope: "per_person" }, { label: "Trash", monthly: 20, scope: "per_unit" }] },
      });
      const r = one(l);
      expect(perPersonRent(l, 1)).toBeNull();
      expect(r.perMember[0].perPersonRent).toBeNull();
      expect(r.perMember[0].subscores.affordability.score).toBeNull();
      expect(r.blockers).toEqual([]);
      expect(explainListing(r, l, [jo], DESTS).summary).not.toMatch(/\$\d/);
    }
  });

  it("non-finite fee / amount data → 'contact for pricing', never a NaN price", () => {
    const bad = [
      makeListing("a", { rent: { amount: 900, basis: "per_bedroom", fees: [{ label: "Bad", monthly: NaN, scope: "per_person" }] } }),
      makeListing("a", { rent: { amount: Infinity, basis: "per_unit" } }),
      makeListing("a", { rent: { amount: NaN, basis: "per_bedroom" } }),
    ];
    for (const l of bad) {
      expect(perPersonRent(l, 2)).toBeNull();
      const { r, e } = explain(l);
      expect(r.perMember[0].subscores.affordability.score).toBeNull();
      expect(r.groupScore).not.toBeNaN();
      clean(r);
      clean(e);
    }
  });
});

describe("capacity and space edge cases", () => {
  it("studio (0 bedrooms): capacity blocker for 3; for 1 person it fits only without a private-bedroom requirement", () => {
    const studio = makeListing("s", { housingType: "studio", bedrooms: 0, bathrooms: 1, maxOccupancy: undefined });
    const three = [jo, makeMember("b", "Bo"), makeMember("c", "Cy")];
    const r3 = one(studio, three);
    expect(r3.blockers.some((b) => b.kind === "capacity" && /studio/.test(b.message))).toBe(true);
    const solo = one(studio, [jo]);
    expect(solo.blockers).toEqual([]);
    expect(solo.warnings.map((w) => w.kind)).not.toContain("shared_bedrooms");
    expect(solo.perMember[0].subscores.space.reason).toMatch(/^A studio \(no separate bedroom\) for 1;/);
    const pair = one(studio, [jo, makeMember("b", "Bo")]);
    expect(pair.blockers).toEqual([]);
    expect(pair.warnings.map((w) => w.kind)).toContain("shared_bedrooms");
    expect(solo.perMember[0].subscores.space.score).not.toBeNull();
    const needsRoom = one(studio, [makeMember("p", "Pat", { requirements: { privateBedroom: true } })]);
    expect(needsRoom.blockers).toMatchObject([{ kind: "capacity", memberId: "p" }]);
    clean(explainListing(r3, studio, three, DESTS));
  });

  it("bathrooms 0 → bath component 0, still finite; sqft 0 and undefined are both 'not listed'", () => {
    const zeroBath = one(makeListing("a", { bathrooms: 0 }));
    expect(zeroBath.perMember[0].subscores.space.reason).toMatch(/0\.0 baths\/person/);
    expect(Number.isFinite(zeroBath.perMember[0].subscores.space.score)).toBe(true);
    const s0 = one(makeListing("a", { sqft: 0 })).perMember[0].subscores.space;
    const sU = one(makeListing("a", { sqft: undefined })).perMember[0].subscores.space;
    expect(s0).toEqual(sU);
    expect(s0.reason).toMatch(/sq ft not listed/);
  });

  it("2 people sharing 1 bedroom is a warning, 3 in 1 bedroom is a blocker", () => {
    const l = makeListing("a", { bedrooms: 1, maxOccupancy: undefined });
    const two = one(l, [jo, makeMember("b", "Bo")]);
    expect(two.blockers).toEqual([]);
    expect(two.warnings.map((w) => w.kind)).toContain("shared_bedrooms");
    const three = one(l, [jo, makeMember("b", "Bo"), makeMember("c", "Cy")]);
    expect(three.blockers.map((b) => b.kind)).toEqual(["capacity"]);
  });
});

describe("commute edge cases", () => {
  it("destinations all missing from the matrix → commute null (missing data), coverage 4/5, explained", () => {
    const m = makeMember("m", "Mo", { destinations: [{ destinationId: "nowhere", visitsPerWeek: 5, importance: 3 }] });
    const { r, e } = explain(makeListing("a"), [m], { central: 10 });
    expect(r.perMember[0].subscores.commute.score).toBeNull();
    expect(r.perMember[0].commutes).toEqual([{ destinationId: "nowhere", mode: "walk", minutes: null, estimated: false, visitsPerWeek: 5, note: "No travel time available" }]);
    expect(r.coverage).toEqual({ evaluated: 4, total: 5 });
    expect(r.eligibility).toBe("eligible_with_unknowns");
    expect(e.summary).toMatch(/Scored on 4 of 5 categories\./);
  });

  it("no destinations at all → commute null but coverage is NOT reduced (no preference ≠ missing data)", () => {
    const r = one(makeListing("a"), [makeMember("m", "Mo", { destinations: [] })]);
    expect(r.perMember[0].subscores.commute.score).toBeNull();
    expect(r.coverage.evaluated).toBe(5);
  });

  it("drive: uses drive times only; missing drive cell → not scored even when walk exists", () => {
    const d = makeMember("d", "Dev", { travelMode: "drive", hasCar: true });
    const matrix = makeMatrix({ a: { central: { walk: 35, drive: 6 } }, b: { central: { walk: 5 } } });
    const [ra, rb] = ["a", "b"].map((id) => rankListings([makeListing(id)], [d], matrix, DESTS)[0]);
    expect(ra.perMember[0].subscores.commute.score).toBe(100);
    expect(ra.perMember[0].commutes[0].mode).toBe("drive");
    expect(rb.perMember[0].subscores.commute.score).toBeNull();
  });

  it("duplicate destinations count twice in the weighting, consistently", () => {
    const dup = makeMember("m", "Mo", {
      destinations: [
        { destinationId: "central", visitsPerWeek: 1, importance: 1 },
        { destinationId: "central", visitsPerWeek: 1, importance: 1 },
        { destinationId: "north_campus", visitsPerWeek: 1, importance: 1 },
      ],
    });
    const pm = one(makeListing("a"), [dup], { central: 10, north_campus: 40 }).perMember[0];
    expect(pm.subscores.commute.score).toBeCloseTo(66.7, 1);
    expect(pm.commutes).toHaveLength(3);
  });

  it("visitsPerWeek 0 everywhere → falls back to importance weighting", () => {
    const m = makeMember("m", "Mo", {
      destinations: [
        { destinationId: "central", visitsPerWeek: 0, importance: 3 },
        { destinationId: "north_campus", visitsPerWeek: 0, importance: 1 },
      ],
    });
    expect(one(makeListing("a"), [m], { central: 10, north_campus: 40 }).perMember[0].subscores.commute.score).toBe(75);
  });

  it("a destination visited 0×/week cannot carry the commute score when the visited ones lack data", () => {
    const m = makeMember("m", "Mo", {
      destinations: [
        { destinationId: "central", visitsPerWeek: 5, importance: 3 }, // no matrix cell
        { destinationId: "north_campus", visitsPerWeek: 0, importance: 3 },
      ],
    });
    const r = one(makeListing("a"), [m], { north_campus: 60 });
    expect(r.perMember[0].subscores.commute.score).toBeNull();
    expect(r.coverage.evaluated).toBe(4);
  });

  it("explanation never blames a destination the member visits 0×/week (it has zero weight in the score)", () => {
    const m = makeMember("m", "Mo", {
      destinations: [
        { destinationId: "central", visitsPerWeek: 1, importance: 1 },
        { destinationId: "north_campus", visitsPerWeek: 0, importance: 3 },
      ],
    });
    const { r, e } = explain(makeListing("a"), [m], { central: 35, north_campus: 60 });
    expect(r.perMember[0].subscores.commute.score).toBeCloseTo(16.7, 1); // central only
    expect(e.compromise).toBe("Main drawback: a 35-minute walk to Central Campus for Mo.");
  });

  it("What changed? never credits a 0×/week destination for the new #1", () => {
    const maya = makeMember("maya", "Maya", {
      budgetMax: 850,
      destinations: [
        { destinationId: "north_campus", visitsPerWeek: 1, importance: 1 },
        { destinationId: "central", visitsPerWeek: 0, importance: 3 },
      ],
    });
    const sam = makeMember("sam", "Sam", { budgetMax: 700, destinations: [] });
    const X = makeListing("x", { name: "X House", bedrooms: 2, rent: { amount: 1300, basis: "per_unit" }, features: { dishwasher: false } });
    const Y = makeListing("y", { name: "Y House", bedrooms: 2, rent: { amount: 1600, basis: "per_unit" } });
    const matrix = makeMatrix({ x: { north_campus: 35, central: 60 }, y: { north_campus: 25, central: 5 } });
    const before = rankListings([X, Y], [maya, sam], matrix, DESTS);
    const afterMembers = [maya, { ...sam, budgetMax: 850 }];
    const after = rankListings([X, Y], afterMembers, matrix, DESTS);
    expect([before[0].listingId, after[0].listingId]).toEqual(["x", "y"]);
    const d = diffRankings(before, after, { changedInputs: [], listings: [X, Y], members: afterMembers });
    const text = d.sentences.join(" ");
    expect(text).toMatch(/closer to North Campus for Maya \(25- vs 35-minute walk\)/);
    expect(text).not.toMatch(/Central/);
  });
});

describe("explanation edge cases", () => {
  it("a member who is fine everywhere yields no compromise and a clean summary", () => {
    const happy = makeMember("h", "Hal", { budgetMax: 5000, desiredAmenities: ["dishwasher"], lifestyle: { cooking: "low" } });
    const { e } = explain(makeListing("a"), [happy], { central: 5 });
    expect(e.compromise).toBeNull();
    expect(e.summary).toMatch(/^Strong fit for /);
    clean(e);
  });

  it("an explanation built with a member list that lacks a ranked member skips them instead of throwing", () => {
    const other = makeMember("o", "Oz");
    const r = one(makeListing("a"), [jo, other]);
    const e = explainListing(r, makeListing("a"), [jo], DESTS);
    expect(Object.keys(e.perMember)).toEqual(["jo"]);
    expect(allStrings(e).join(" ")).not.toMatch(/Oz/);
  });

  it("every subscore reason is non-empty for every dimension", () => {
    const r = one(makeListing("a", { rent: { amount: null, basis: "unknown" } }), [makeMember("m", "Mo", { destinations: [], desiredAmenities: [] })]);
    for (const d of DIMS) expect(r.perMember[0].subscores[d].reason.length).toBeGreaterThan(0);
  });
});

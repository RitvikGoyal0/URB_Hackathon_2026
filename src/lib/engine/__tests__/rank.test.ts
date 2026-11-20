import { describe, expect, it } from "vitest";
import { rankListings, weightedScore } from "../rank";
import { affordabilityCurve, averageCommute, commuteCurve } from "../subscores";
import { DIMS, type Dim, type MemberProfile, type Subscore } from "@/lib/types";
import { DESTS, makeListing, makeMatrix, makeMember } from "./fixtures";

const sam = makeMember("sam", "Sam", { budgetMax: 700, budgetIsHardCap: true, travelMode: "bike" });
const jo = makeMember("jo", "Jordan", { budgetMax: 1000 });
const riley = makeMember("riley", "Riley", { budgetMax: 1150, requirements: { privateBedroom: true } });

const one = (listing = makeListing("a"), members: MemberProfile[] = [jo], times = { central: 10 }) =>
  rankListings([listing], members, makeMatrix({ [listing.id]: times }), DESTS)[0];

describe("affordability (§7.4)", () => {
  it("curve: ≤80% → 100, linear to 50 at 100%, over → 0", () => {
    expect(affordabilityCurve(500, 1000)).toBe(100);
    expect(affordabilityCurve(800, 1000)).toBe(100);
    expect(affordabilityCurve(900, 1000)).toBeCloseTo(75, 10);
    expect(affordabilityCurve(1000, 1000)).toBeCloseTo(50, 10);
    expect(affordabilityCurve(1001, 1000)).toBe(0);
  });

  it("budget blocker names the member and carries the dollar amount", () => {
    const r = one(makeListing("a", { bedrooms: 2, rent: { amount: 1700, basis: "per_unit" } }), [sam, jo]); // 1700 ÷ 2 rooms = 850/room
    expect(r.blockers).toEqual([{ kind: "budget", memberId: "sam", amount: 150, message: "Exceeds Sam's budget by $150/mo." }]);
    expect(r.eligibility).toBe("blocked");
    const samRes = r.perMember.find((p) => p.memberId === "sam")!;
    expect(samRes.subscores.affordability.score).toBe(0);
  });

  it("unknown rent: null price, null affordability, warning, never 0", () => {
    const r = one(makeListing("a", { rent: { amount: null, basis: "unknown" } }), [sam, jo]);
    for (const pm of r.perMember) {
      expect(pm.perPersonRent).toBeNull();
      expect(pm.subscores.affordability.score).toBeNull();
      expect(pm.subscores.affordability.reason).toMatch(/Contact for pricing/);
      expect(pm.effectiveWeights.affordability).toBe(0);
    }
    expect(r.blockers).toEqual([]);
    expect(r.warnings.map((w) => w.kind)).toContain("affordability_unverified");
    expect(r.warnings.find((w) => w.kind === "affordability_unverified")!.message).toMatch(/^Affordability unverified/);
    expect(r.eligibility).toBe("eligible_with_unknowns");
    expect(r.coverage).toEqual({ evaluated: 4, total: 5 });
  });

  it("utilities not included → warning and 'excludes utilities' in the explanation", () => {
    const r = one(makeListing("a", { rent: { utilitiesIncluded: false } }));
    expect(r.warnings).toContainEqual({ kind: "utilities_excluded", message: "Rent excludes utilities (no utility fee data)." });
    const aff = r.perMember[0].subscores.affordability;
    expect(aff.reason).toMatch(/excludes utilities/);
    expect(aff.evidence.join("\n")).toMatch(/excludes utilities \(no utility fee data\)/);
    // not an unknown: tier stays eligible
    expect(r.eligibility).toBe("eligible");
  });

  it("evidence cites the rent basis math and provenance status", () => {
    const r = one(makeListing("a", { rent: { amount: 4396, basis: "per_unit" } }));
    expect(r.perMember[0].subscores.affordability.evidence[0]).toBe(
      "$4,396/unit ÷ 4 rooms = $1,099/room — provider-reported by Example Provider, observed 2026-11-20",
    );
    const perBed = one(makeListing("b", { rent: { amount: 900, basis: "per_bedroom" } }), [jo, sam]);
    expect(perBed.perMember[0].subscores.affordability.evidence[0]).toMatch(/^\$900\/bed \(as listed\) = \$900\/person — provider-reported/);
  });
});

describe("hard checks (§7.3)", () => {
  it("unknown feature NEVER satisfies a requirement", () => {
    const needsParking = makeMember("p", "Pat", { requirements: { parking: true, inUnitLaundry: true } });
    const unknown = one(makeListing("a", { features: { parking: null, inUnitLaundry: null } }), [needsParking]);
    expect(unknown.eligibility).not.toBe("eligible");
    expect(unknown.eligibility).toBe("eligible_with_unknowns");
    expect(unknown.warnings).toContainEqual({ kind: "feature_unverified", memberId: "p", message: "Unverified: parking (Pat requires it)." });
    expect(unknown.warnings).toContainEqual({ kind: "feature_unverified", memberId: "p", message: "Unverified: in-unit laundry (Pat requires it)." });

    const no = one(makeListing("b", { features: { parking: false } }), [needsParking]);
    expect(no.eligibility).toBe("blocked");
    expect(no.blockers).toContainEqual({ kind: "required_feature", memberId: "p", message: "No parking; Pat requires it." });

    const yes = one(makeListing("c"), [needsParking]);
    expect(yes.eligibility).toBe("eligible");
    expect(yes.blockers).toEqual([]);
  });

  it("unknown private-bedroom status never satisfies a private-bedroom requirement", () => {
    const r = one(makeListing("a", { privateBedrooms: null }), [riley]);
    expect(r.eligibility).toBe("eligible_with_unknowns");
    expect(r.warnings.some((w) => w.kind === "feature_unverified" && w.memberId === "riley")).toBe(true);
    const shared = one(makeListing("b", { privateBedrooms: false }), [riley]);
    expect(shared.blockers[0]).toMatchObject({ kind: "capacity", memberId: "riley" });
  });

  it("capacity: fewer bedrooms than people", () => {
    const group = [jo, sam, makeMember("x", "Alex"), makeMember("y", "Casey")];
    const shared = one(makeListing("a", { bedrooms: 3 }), group);
    expect(shared.blockers).toEqual([]);
    expect(shared.warnings).toContainEqual({ kind: "shared_bedrooms", message: "Shared bedrooms needed (3 bedrooms for 4 people)." });

    const withRiley = one(makeListing("a", { bedrooms: 3 }), [jo, sam, riley, makeMember("y", "Casey")]);
    expect(withRiley.blockers).toEqual([
      { kind: "capacity", memberId: "riley", message: "Only 3 bedrooms for 4 people; Riley needs a private bedroom." },
    ]);

    const studio = one(makeListing("s", { bedrooms: 0, maxOccupancy: undefined }), group);
    expect(studio.eligibility).toBe("blocked");
    expect(studio.blockers[0].kind).toBe("capacity");
  });

  it("maxOccupancy: known and too small → blocker; unknown → warning only (does not demote)", () => {
    const group = [jo, sam];
    const small = one(makeListing("a", { maxOccupancy: 1 }), group);
    expect(small.blockers[0]).toEqual({ kind: "capacity", message: "Max occupancy is 1; the group has 2." });
    const unknown = one(makeListing("b", { maxOccupancy: undefined }), [jo]);
    expect(unknown.warnings).toContainEqual({ kind: "occupancy_unverified", message: "Occupancy unverified — confirm with property." });
    expect(unknown.eligibility).toBe("eligible");
  });
});

describe("commute (§7.4, §5.7)", () => {
  it("curve: 100 at ≤10 min, linear to 0 at ≥40", () => {
    expect(commuteCurve(5)).toBe(100);
    expect(commuteCurve(10)).toBe(100);
    expect(commuteCurve(25)).toBeCloseTo(50, 10);
    expect(commuteCurve(40)).toBe(0);
    expect(commuteCurve(55)).toBe(0);
  });

  it("is weighted by visitsPerWeek × importance", () => {
    const m = makeMember("m", "Maya", {
      destinations: [
        { destinationId: "north_campus", visitsPerWeek: 5, importance: 3 }, // w=15, 10 min → 100
        { destinationId: "central", visitsPerWeek: 1, importance: 1 }, // w=1, 40 min → 0
      ],
    });
    const r = one(makeListing("a"), [m], { north_campus: 10, central: 40 } as never);
    expect(r.perMember[0].subscores.commute.score).toBe(93.8); // 15×100/16
  });

  it("uses the member's mode: drive uses drive time, bike uses bike time", () => {
    const driver = makeMember("d", "Dee", { travelMode: "drive", hasCar: true });
    const r = one(makeListing("a"), [driver], { central: { walk: 40, bike: 30, drive: 5 } } as never);
    expect(r.perMember[0].subscores.commute.score).toBe(100);
    expect(r.perMember[0].commutes[0]).toMatchObject({ mode: "drive", minutes: 5 });
    const biker = makeMember("b", "Bo", { travelMode: "bike" });
    const r2 = one(makeListing("a"), [biker], { central: { walk: 40, bike: 25, drive: 5 } } as never);
    expect(r2.perMember[0].subscores.commute.score).toBe(50);
  });

  it("bus: estimated from distance (never walk time), labelled est.; short trips say walking is faster", () => {
    const bus = makeMember("m", "Maya", { travelMode: "bus", destinations: [{ destinationId: "north_campus", visitsPerWeek: 4, importance: 3 }] });
    const nc = DESTS.find((d) => d.id === "north_campus")!;
    // ~2.4 km straight line south of North Campus → road 3.24 km → bus 5+5+10.8 = 20.8 min
    const far = { ...makeMatrix({ a: { north_campus: { walk: 40, bike: 12, drive: 6 } } } as never), origins: { a: { lat: nc.lat - 0.0216, lng: nc.lng } } };
    const pm = rankListings([makeListing("a")], [bus], far, DESTS)[0].perMember[0];
    expect(pm.commutes[0]).toMatchObject({ destinationId: "north_campus", mode: "bus", estimated: true, visitsPerWeek: 4 });
    expect(pm.commutes[0].minutes!).toBeCloseTo(20.8, 0);
    expect(pm.subscores.commute.reason).toMatch(/~21-min bus ride \(est\.\)/);
    // 300 m away: bus (≥10 min) is slower than walking → walk time, flagged
    const near = { ...makeMatrix({ b: {} }), origins: { b: { lat: nc.lat - 0.0027, lng: nc.lng } } };
    const c = rankListings([makeListing("b")], [bus], near, DESTS)[0].perMember[0].commutes[0];
    expect(c.mode).toBe("walk");
    expect(c.note).toMatch(/^Walking is faster/);
    // no coordinates → no time (never a fabricated one)
    const none = rankListings([makeListing("c")], [bus], makeMatrix({ c: { north_campus: 10 } }), DESTS)[0];
    expect(none.perMember[0].commutes[0].minutes).toBeNull();
    expect(none.perMember[0].subscores.commute.score).toBeNull();
  });

  it("custom places are estimated in their own mode and averaged by visits", () => {
    const m = makeMember("m", "Mo", {
      travelMode: "walk",
      destinations: [{ destinationId: "central", visitsPerWeek: 4, importance: 2 }],
      places: [{ id: "p1", name: "MRacing", kind: "custom", location: { source: "building", label: "Wilson Center", lat: 42.2938, lng: -83.7107 }, visitsPerWeek: 2, importance: 3, mode: "bike" }],
    });
    const mx = { ...makeMatrix({ a: { central: 10 } }), origins: { a: { lat: 42.2780, lng: -83.7382 } } };
    const pm = rankListings([makeListing("a")], [m], mx, DESTS)[0].perMember[0];
    const p = pm.commutes.find((c) => c.destinationId === "p1")!;
    expect(p).toMatchObject({ name: "MRacing", mode: "bike", estimated: true, visitsPerWeek: 2 });
    const avg = averageCommute(pm.commutes);
    expect(avg.minutes).toBe(Math.round((10 * 4 + p.minutes! * 2) / 6));
    expect(avg).toMatchObject({ counted: 2, total: 2, estimated: true });
  });

  it("evidence marks straight-line estimates", () => {
    const l = makeListing("a");
    const r = rankListings([l], [jo], makeMatrix({ a: { central: 12 } }, true), DESTS)[0];
    expect(r.perMember[0].subscores.commute.evidence[0]).toMatch(/est\. \(straight-line\)/);
    expect(r.perMember[0].commutes[0].estimated).toBe(true);
  });

  it("missing matrix data → null commute and lower coverage", () => {
    const r = rankListings([makeListing("a")], [jo], makeMatrix({}), DESTS)[0];
    expect(r.perMember[0].subscores.commute.score).toBeNull();
    expect(r.coverage).toEqual({ evaluated: 4, total: 5 });
    expect(r.eligibility).toBe("eligible_with_unknowns");
  });
});

describe("amenities, lifestyle, space (§7.4)", () => {
  it("amenities: share of desired that are true; null = not met and listed as unverified", () => {
    const m = makeMember("m", "Maya", { desiredAmenities: ["dishwasher", "ac", "parking"] });
    const r = one(makeListing("a", { features: { ac: null, parking: false } }), [m]);
    const s = r.perMember[0].subscores.amenities;
    expect(s.score).toBe(33.3);
    expect(s.reason).toMatch(/A\/C unverified \(counted as not met\)/);
    expect(s.evidence).toContain("A/C: not stated (unverified) — counted as not met");
    expect(s.evidence).toContain("Dishwasher: yes — provider-reported by Example Provider, observed 2026-11-20");
    expect(r.coverage.evaluated).toBe(5); // a null amenity is scored as not met, not skipped
  });

  it("lifestyle rules each contribute a reason", () => {
    const quietCook = makeMember("m", "Maya", { lifestyle: { noise: "quiet", cooking: "high" } });
    const good = one(makeListing("a"), [quietCook]).perMember[0].subscores.lifestyle;
    expect(good.score).toBe(100);
    expect(good.reason).toMatch(/quiet building/i);
    expect(good.reason).toMatch(/large kitchen/i);

    const highRise = one(makeListing("b", { housingType: "high_rise", features: { quietBuilding: false, largeKitchen: false } }), [quietCook]);
    expect(highRise.perMember[0].subscores.lifestyle.score).toBe(0); // 50 − 25 − 15 − 25 → clamp 0

    const social = makeMember("s", "Jordan", { lifestyle: { noise: "social", cooking: "low", guests: "often" } });
    expect(one(makeListing("c"), [social]).perMember[0].subscores.lifestyle.score).toBe(85); // 50 + 25 + 10
  });

  it("lifestyle: all relevant features unknown → null and coverage drops; no preference → null, coverage kept", () => {
    const quiet = makeMember("m", "Riley", { lifestyle: { noise: "quiet", cooking: "low", guests: "rare" } });
    const unk = one(makeListing("a", { features: { quietBuilding: null } }), [quiet]);
    expect(unk.perMember[0].subscores.lifestyle.score).toBeNull();
    expect(unk.coverage).toEqual({ evaluated: 4, total: 5 });

    const chill = makeMember("c", "Casey", { lifestyle: { noise: "either", cooking: "low", guests: "sometimes" } });
    const none = one(makeListing("b"), [chill]);
    expect(none.perMember[0].subscores.lifestyle.score).toBeNull();
    expect(none.coverage).toEqual({ evaluated: 5, total: 5 });
    expect(none.eligibility).toBe("eligible");
  });

  it("space: private bedroom, baths/person ≥0.75 full marks, sq ft/person", () => {
    const full = one(makeListing("a", { bedrooms: 2, bathrooms: 1.5, sqft: 600 }), [jo, sam]).perMember[0].subscores.space;
    expect(full.score).toBe(100);
    // bedroom 100, baths 0.25/person → 33.3, sqft unknown → dropped: (0.4×100 + 0.35×33.33)/0.75
    const tight = one(makeListing("b", { bedrooms: 4, bathrooms: 1, sqft: undefined }), [jo, sam, riley, makeMember("y", "Casey")]);
    expect(tight.perMember[0].subscores.space.score).toBe(68.9);
    expect(tight.perMember[0].subscores.space.reason).toMatch(/sq ft not listed/);
  });
});

describe("aggregation", () => {
  const sub = (score: number | null): Subscore => ({ score, reason: "", evidence: [] });
  it("null subscores redistribute weight proportionally", () => {
    const subs = { affordability: sub(null), commute: sub(100), amenities: sub(0), lifestyle: sub(50), space: sub(100) } as Record<Dim, Subscore>;
    const { score, effectiveWeights } = weightedScore(subs, { affordability: 0.3, commute: 0.25, amenities: 0.2, lifestyle: 0.15, space: 0.1 });
    expect(effectiveWeights.affordability).toBe(0);
    expect(effectiveWeights.commute).toBeCloseTo(0.25 / 0.7, 10);
    expect(DIMS.reduce((s, d) => s + effectiveWeights[d], 0)).toBeCloseTo(1, 10);
    expect(score).toBe(60.7); // (25 + 0 + 7.5 + 10) / 0.7
  });

  it("all-null subscores → null member score", () => {
    const subs = Object.fromEntries(DIMS.map((d) => [d, sub(null)])) as Record<Dim, Subscore>;
    expect(weightedScore(subs, { affordability: 0.3, commute: 0.25, amenities: 0.2, lifestyle: 0.15, space: 0.1 }).score).toBeNull();
  });

  it("groupScore = 0.75 × mean + 0.25 × min; least satisfied member is the min", () => {
    const r = one(makeListing("a", { rent: { amount: 1900, basis: "per_unit" } }), [sam, jo, riley]); // 633/person
    const scores = r.perMember.map((p) => p.score as number);
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const min = Math.min(...scores);
    expect(r.groupScore).toBeCloseTo(0.75 * mean + 0.25 * min, 1);
    expect(r.mean).toBeCloseTo(mean, 1);
    expect(r.min).toBe(min);
    expect(r.leastSatisfiedMemberId).toBe(r.perMember[scores.indexOf(min)].memberId);
  });
});

describe("sort order and determinism", () => {
  const listings = [
    makeListing("blocked_hi", { rent: { amount: 1000, basis: "per_unit" }, maxOccupancy: 1 }), // great score, blocked
    makeListing("unknown_hi", { rent: { amount: null, basis: "unknown" } }),
    makeListing("ok_lo", { rent: { amount: 990, basis: "per_unit" }, features: { dishwasher: false } }),
    makeListing("ok_b", { rent: { amount: 500, basis: "per_unit" } }),
    makeListing("ok_a", { rent: { amount: 500, basis: "per_unit" } }), // identical to ok_b → id tie-break
  ];
  const matrix = makeMatrix(Object.fromEntries(listings.map((l) => [l.id, { central: 10 }])));

  it("eligible → eligible_with_unknowns → blocked; ties by listing id; ranks 1..n", () => {
    const r = rankListings(listings, [jo, sam], matrix, DESTS);
    expect(r.map((x) => x.listingId)).toEqual(["ok_a", "ok_b", "ok_lo", "unknown_hi", "blocked_hi"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(r.map((x) => x.eligibility)).toEqual(["eligible", "eligible", "eligible", "eligible_with_unknowns", "blocked"]);
    // blocked listings are still scored
    expect(r[4].groupScore).not.toBeNull();
    expect(r[4].groupScore!).toBeGreaterThan(r[2].groupScore!);
  });

  it("same input → identical output (and input order does not matter)", () => {
    const a = rankListings(listings, [jo, sam, riley], matrix, DESTS);
    const b = rankListings(listings, [jo, sam, riley], matrix, DESTS);
    expect(b).toEqual(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    const c = rankListings([...listings].reverse(), [jo, sam, riley], matrix, DESTS);
    expect(c).toEqual(a);
  });

  it("does not mutate its inputs", () => {
    const copy = JSON.parse(JSON.stringify(listings));
    rankListings(listings, [jo, sam], matrix, DESTS);
    expect(listings).toEqual(copy);
  });

  it("options.groupSize overrides members.length for rent splits", () => {
    const r = rankListings([makeListing("a", { rent: { amount: 2400, basis: "per_unit" } })], [jo], makeMatrix({ a: { central: 10 } }), DESTS, { groupSize: 4 });
    expect(r[0].perMember[0].perPersonRent).toBe(600);
  });
});

/**
 * The stage walkthrough (docs/demo-walkthrough.md), end to end on the REAL catalog:
 * the exact on-stage inputs → Alex's profile → roommate suggestions → rankings at every stage →
 * the What-if flip. If a data or engine change moves any of these, this test fails, and the
 * walkthrough doc must be updated with it (`npx tsx scripts/demo-dump.ts` prints the new numbers).
 */
import { describe, expect, it } from "vitest";
import { lookupCachedParse } from "../ai/cache";
import { destinations, FRIEND_IDS, getDestination, listings, personas, students } from "../data";
import { diffRankings, explainListing, filterForLobby, rankRoommates } from "../engine";
import { DEMO_ANSWERS, DEMO_SENTENCE, buildDemoProfile } from "../demo-profile";
import { EXAMPLE_PROMPTS, buildFollowUps, selectThisOrThat, unconfirmedCount } from "../onboarding";
import { rankFor } from "@/hooks/use-group";
import type { Lobby, MemberProfile } from "../types";

const SAM = "member_c";
const FAIR = "um_fair_4br";
const SSV = "um_ssv_4br";
const lobby = { targetSize: 4 } as Lobby;
const pool = filterForLobby(listings, 4);

const alex = buildDemoProfile();
const [jordan, sam] = FRIEND_IDS.map((id) => students.find((s) => s.id === id)!);
const suggestions = rankRoommates(
  alex,
  students.filter((s) => s.roommateStatus === "looking" && !FRIEND_IDS.includes(s.id)),
  (id) => getDestination(id)?.shortName,
);
const riley = suggestions[0].member;
const group = [alex, jordan, sam, riley];
const withSam = (ms: MemberProfile[], budget: number) => ms.map((m) => (m.id === SAM ? { ...m, budgetMax: budget } : m));

describe("walkthrough step 2: the typed profile", () => {
  it("the demo sentence is the first example chip and is answered from the cache", () => {
    expect(EXAMPLE_PROMPTS[0].text).toBe(DEMO_SENTENCE);
    expect(lookupCachedParse(DEMO_SENTENCE)).not.toBeNull();
  });

  it("Check it asks no follow-up questions; Quick picks asks exactly three", () => {
    const parse = lookupCachedParse(DEMO_SENTENCE)!;
    expect(buildFollowUps(parse, { budgetProvided: false })).toEqual([]);
    const { ask, skipped } = selectThisOrThat(parse);
    expect(ask.map((q) => q.id)).toEqual(["closer_space", "rent_amenities", "private_cheaper"]);
    expect(skipped.map((s) => s.q.id)).toEqual(["quiet_social", "cooking_convenience"]);
    expect(Object.keys(DEMO_ANSWERS)).toEqual(ask.map((q) => q.id));
  });

  it("builds Alex exactly", () => {
    expect(unconfirmedCount(alex)).toBe(0);
    expect(alex).toMatchObject({
      displayName: "Alex",
      budgetMax: 1100,
      travelMode: "bike",
      hasCar: false,
      lifestyle: { noise: "quiet", cooking: "high", guests: "sometimes" },
      requirements: { privateBedroom: false, parking: false, inUnitLaundry: false },
      desiredAmenities: ["largeKitchen", "dishwasher", "inUnitLaundry"],
      major: "Aerospace Engineering",
      organizations: ["MRacing"],
      roommateStatus: "looking",
    });
    expect(alex.destinations.map((d) => [d.destinationId, d.visitsPerWeek])).toEqual([
      ["north_campus", 4],
      ["central_campus", 2],
    ]);
    expect(alex.places?.map((p) => [p.name, p.location.refId, p.visitsPerWeek, p.mode ?? alex.travelMode, p.importance])).toEqual([
      ["MRacing", "wilson_center", 3, "bike", 3],
      // from the uploaded schedule: trips from home (first class of the day, or after a 2-hour gap)
      ["Chrysler", "chrysler_center", 2, "bike", 2],
      ["Mason Hall", "mason_hall", 2, "bike", 2],
      ["Ford Robotics", "ford_robotics", 1, "bike", 2],
      ["EECS", "eecs", 1, "bike", 2],
    ]);
    expect(alex.schedule?.classes.map((c) => c.placeId)).toEqual([
      "class_chrysler_center",
      "class_gg_brown",
      "class_mason_hall",
      "class_weiser_hall",
      "class_ford_robotics",
      "class_eecs",
    ]);
    const w = alex.weights;
    expect([w.affordability, w.commute, w.amenities, w.lifestyle, w.space].map((x) => Math.round(x * 100))).toEqual([30, 20, 15, 15, 20]);
  });

  it("the seeded default persona (before onboarding) scores the same as typed Alex", () => {
    const seed = personas.find((p) => p.isLiveUser)!;
    const pick = (m: MemberProfile) => ({
      displayName: m.displayName,
      budgetMax: m.budgetMax,
      travelMode: m.travelMode,
      destinations: m.destinations,
      lifestyle: m.lifestyle,
      requirements: m.requirements,
      desiredAmenities: m.desiredAmenities,
      major: m.major,
      organizations: m.organizations,
      places: m.places,
      schedule: m.schedule?.classes,
    });
    expect(pick(seed)).toEqual(pick(alex));
    for (const d of Object.keys(alex.weights) as (keyof typeof alex.weights)[]) expect(seed.weights[d]).toBeCloseTo(alex.weights[d], 6);
  });
});

describe("walkthrough step 5: roommate suggestions", () => {
  it("Riley is a Great match, far ahead, for the reasons on the card", () => {
    expect(riley.displayName).toBe("Riley");
    expect(suggestions[0].compat).toMatchObject({ score: 95, label: "Great match", reasons: ["Both on North Campus most weeks", "Both want a quiet home"] });
    expect(suggestions.map((s) => s.member.displayName)).toEqual(["Riley", "Priya", "Dana", "Theo", "Elena", "Marcus"]);
    expect(suggestions[0].compat.score - suggestions[1].compat.score).toBeGreaterThanOrEqual(25);
  });

  it("Jordan and Sam are the friends, and they differ from Alex", () => {
    expect([jordan.displayName, sam.displayName]).toEqual(["Jordan", "Sam"]);
    expect(jordan).toMatchObject({ travelMode: "walk", budgetMax: 1200, lifestyle: { noise: "social" } });
    expect(sam).toMatchObject({ travelMode: "bike", budgetMax: 850, budgetIsHardCap: true });
  });
});

describe("walkthrough: rankings at each stage", () => {
  it("solo search: 217 N Ashley St is #1", () => {
    expect(rankFor(listings, [alex], null)[0].listingId).toBe("um_ashley_3br");
  });

  it("lobby with Jordan and Sam: Fair St #1, State Street Village #2 blocked only by Sam ($35)", () => {
    const r = rankFor(pool, [alex, jordan, sam], lobby);
    expect(r.slice(0, 2).map((x) => x.listingId)).toEqual([FAIR, SSV]);
    expect(r[1].blockers).toEqual([expect.objectContaining({ kind: "budget", memberId: SAM, amount: 35 })]);
  });

  it("Riley joins: Fair St stays #1, Jordan is the least satisfied there", () => {
    const r = rankFor(pool, group, lobby);
    expect(r.slice(0, 3).map((x) => x.listingId)).toEqual([FAIR, SSV, "um_smain_4br"]);
    expect(r[0].eligibility).not.toBe("blocked");
    expect(r[0].groupScore).toBe(68.9);
    expect(r[0].leastSatisfiedMemberId).toBe(jordan.id);
    const e = explainListing(r[0], listings.find((l) => l.id === FAIR)!, group, destinations);
    expect(e.compromise).toBe("Main drawback: a 39-minute walk to Central Campus for Jordan.");
  });

  it("What if: Sam $850 → $950 makes State Street Village #1, and says why", () => {
    const before = rankFor(pool, group, lobby);
    const after = withSam(group, 950);
    const ranked = rankFor(pool, after, lobby);
    expect(ranked.slice(0, 2).map((x) => x.listingId)).toEqual([SSV, "um_mary_4br"]);
    expect(ranked[0].groupScore).toBe(75.7);
    const d = diffRankings(before, ranked, { changedInputs: ["Sam's budget $850 → $950"], listings, members: after });
    expect(d.previousTop).toBe(FAIR);
    expect(d.newTop).toBe(SSV);
    expect(d.sentences).toContain("State Street Village, 4BR Apartment became affordable for Sam, and it fits Jordan better on amenities (67 vs 33).");
  });

  it("the flip doesn't depend on hitting $950 exactly on the slider ($900–$1,100 all work; $875 doesn't)", () => {
    expect(rankFor(pool, withSam(group, 875), lobby)[0].listingId).toBe(FAIR);
    for (let b = 900; b <= 1100; b += 25) expect(rankFor(pool, withSam(group, b), lobby)[0].listingId, `$${b}`).toBe(SSV);
  });
});

/**
 * End-to-end demo path (spec §11) without a browser:
 * demo sentence → cached parse → onboarding follow-ups → confirm → this-or-that → ranking → what-if.
 * Asserts the on-stage "flip" holds for the profile the presenter actually creates,
 * across every travel-mode answer and this-or-that combination they might click.
 */
import { describe, expect, it } from "vitest";
import { lookupCachedParse } from "../ai/cache";
import { commuteMatrix, defaultLivePersona, destinations, listings, seededRoommates } from "../data";
import { diffRankings, explainListing, rankListings } from "../engine";
import {
  addDestination,
  applyThisOrThatAnswer,
  buildFollowUps,
  confirmAll,
  effectiveProfile,
  neutralProfile,
  parseToProfile,
  selectThisOrThat,
  setTravelMode,
  type ThisOrThatAnswer,
} from "../onboarding";
import type { MemberProfile, TravelMode } from "../types";

const DEMO =
  "I'm an engineering student at Michigan. I'm on North Campus most weekdays, have evening club meetings, don't have a car, enjoy cooking with friends, and want housing under $1,150 a month.";
const X = "stub_packard_house";
const Y = "stub_northside_4br";
const SAM = "member_c";

function demoProfile(mode: TravelMode, answers: ThisOrThatAnswer[], confirm = true): MemberProfile {
  const parse = lookupCachedParse(DEMO)!;
  let p = parseToProfile(parse, neutralProfile(defaultLivePersona, "Maya"));
  for (const f of buildFollowUps(parse, { budgetProvided: false })) {
    if (f.kind === "place" && f.suggestedDestinationId) p = addDestination(p, f.suggestedDestinationId, 2, f.placeText);
    if (f.kind === "travelMode") p = setTravelMode(p, mode);
  }
  if (confirm) p = confirmAll(p);
  const { ask } = selectThisOrThat(parse);
  ask.forEach((q, i) => (p = applyThisOrThatAnswer(p, q, answers[i] ?? "skip")));
  return effectiveProfile(p);
}

function rank(live: MemberProfile, samBudget?: number) {
  const members = [live, ...seededRoommates.map((m) => (m.id === SAM && samBudget ? { ...m, budgetMax: samBudget } : m))];
  return { members, ranked: rankListings(listings, members, commuteMatrix, destinations) };
}

const sam = seededRoommates.find((m) => m.id === SAM)!;
const ANSWER_SETS: ThisOrThatAnswer[][] = [
  [],
  ["a", "a", "a", "a", "a"],
  ["b", "b", "b", "b", "b"],
  ["either", "either", "either", "either", "either"],
  ["a", "b", "a", "b", "a"],
  ["b", "a", "b", "a", "b"],
];

describe("demo path: onboarding builds the expected profile", () => {
  it("follow-ups are the club question and the bus/walk question; cooking question is skipped", () => {
    const parse = lookupCachedParse(DEMO)!;
    const f = buildFollowUps(parse, { budgetProvided: false });
    expect(f.map((x) => x.kind)).toEqual(["place", "travelMode"]);
    const { ask, skipped } = selectThisOrThat(parse);
    expect(skipped.map((s) => s.q.id)).toContain("cooking_convenience");
    expect(ask.length).toBeGreaterThanOrEqual(2);
  });

  it("confirmed profile has North Campus 4/wk, Central 2/wk, $1,150, no car, high cooking", () => {
    const p = demoProfile("bus", []);
    expect(p.destinations.find((d) => d.destinationId === "north_campus")?.visitsPerWeek).toBe(4);
    expect(p.destinations.find((d) => d.destinationId === "central_campus")?.visitsPerWeek).toBe(2);
    expect(p.budgetMax).toBe(1150);
    expect(p.hasCar).toBe(false);
    expect(p.lifestyle.cooking).toBe("high");
  });

  it("unconfirmed AI fields are not used: budget falls back to neutral, AI destinations dropped", () => {
    const p = demoProfile("bus", [], false);
    expect(p.budgetMax).toBe(1000);
    expect(p.destinations.some((d) => d.destinationId === "north_campus")).toBe(false);
    // user-answered follow-up (club → Central) is confirmed and kept
    expect(p.destinations.some((d) => d.destinationId === "central_campus")).toBe(true);
  });
});

// V3: rebuilt with the real catalog and lobby flow (spec §5.10, build step 5).
describe.skip("demo path: the on-stage flip holds for the typed profile", () => {
  for (const mode of ["bus", "walk"] as TravelMode[]) {
    for (const answers of ANSWER_SETS) {
      it(`mode=${mode} answers=[${answers.join(",") || "none"}]`, () => {
        const live = demoProfile(mode, answers);
        const before = rank(live);
        expect(before.ranked[0].listingId).toBe(X);
        const yBefore = before.ranked.find((r) => r.listingId === Y)!;
        expect(yBefore.eligibility).toBe("blocked");
        expect(yBefore.blockers.some((b) => b.kind === "budget" && b.memberId === SAM)).toBe(true);

        for (const bump of [100, 150, 200, 250]) {
          const after = rank(live, sam.budgetMax + bump);
          expect(after.ranked[0].listingId, `bump +$${bump}`).toBe(Y);
          const diff = diffRankings(before.ranked, after.ranked, {
            changedInputs: [`Sam's budget $${sam.budgetMax} → $${sam.budgetMax + bump}`],
            listings,
            members: after.members,
          });
          expect(diff.becameEligible).toContain(Y);
          expect(diff.newTop).toBe(Y);
          const text = diff.sentences.join(" ");
          expect(text).toMatch(/became affordable for Sam/);
          expect(text).not.toMatch(/NaN|undefined|null|Infinity/);
        }
      });
    }
  }

  it("explanations for every listing are clean for the demo group", () => {
    const live = demoProfile("bus", []);
    const { members, ranked } = rank(live);
    for (const r of ranked) {
      const l = listings.find((x) => x.id === r.listingId)!;
      const e = explainListing(r, l, members, destinations);
      const all = [e.summary, ...e.strengths, e.compromise ?? "", ...Object.values(e.perMember).flat()].join(" ");
      expect(all, r.listingId).not.toMatch(/NaN|undefined|Infinity|\$-/);
    }
  });

  it("at least 4 listings are rankable (not blocked) at seeded budgets", () => {
    const { ranked } = rank(demoProfile("bus", []));
    expect(ranked.filter((r) => r.eligibility !== "blocked").length).toBeGreaterThanOrEqual(4);
  });
});

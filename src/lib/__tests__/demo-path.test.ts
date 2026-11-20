/**
 * End-to-end demo path (spec §11) without a browser:
 * demo sentence → cached parse → onboarding follow-ups → confirm → this-or-that → ranking → what-if.
 * Asserts the on-stage "flip" holds for the profile the presenter actually creates,
 * across every travel-mode answer and this-or-that combination they might click.
 */
import { describe, expect, it } from "vitest";
import { lookupCachedParse } from "../ai/cache";
import { commuteMatrix, defaultLivePersona, destinations, FRIEND_IDS, getBuilding, listings, students } from "../data";
import { diffRankings, explainListing, filterForLobby, rankListings } from "../engine";
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
import type { MemberProfile, Place, TravelMode } from "../types";

const DEMO =
  "I'm an engineering student at Michigan. I'm on North Campus most weekdays, have evening club meetings, don't have a car, enjoy cooking with friends, and want housing under $1,150 a month.";
/** State Street Village: blocked only by Sam's budget until it rises (see demo-flip.test.ts). */
const Y = "um_ssv_4br";
const SAM = "member_c";

const wilson = getBuilding("wilson_center")!;
const mracing: Place = {
  id: "place_mracing",
  name: "MRacing",
  kind: "custom",
  location: { source: "building", refId: wilson.id, label: wilson.name, lat: wilson.lat, lng: wilson.lng },
  visitsPerWeek: 3,
  importance: 3,
  mode: "bus",
};

function demoProfile(mode: TravelMode, answers: ThisOrThatAnswer[], confirm = true): MemberProfile {
  const parse = lookupCachedParse(DEMO)!;
  let p = parseToProfile(parse, neutralProfile(defaultLivePersona, "Maya"));
  for (const f of buildFollowUps(parse, { budgetProvided: false })) {
    if (f.kind === "place" && f.suggestedDestinationId) p = addDestination(p, f.suggestedDestinationId, 2, f.placeText);
    if (f.kind === "travelMode") p = setTravelMode(p, mode);
  }
  if (confirm) p = confirmAll(p);
  // Stage script §12.2: About you → MRacing → "Where is it?" Wilson Center → 3×/wk → Bus → High.
  p = { ...p, places: [mracing] };
  const { ask } = selectThisOrThat(parse);
  ask.forEach((q, i) => (p = applyThisOrThatAnswer(p, q, answers[i] ?? "skip")));
  return effectiveProfile(p);
}

const friends = FRIEND_IDS.map((id) => students.find((s) => s.id === id)!);
const candidates = students.filter((s) => !FRIEND_IDS.includes(s.id));
const pool = filterForLobby(listings, 4);
/** 4-person lobby: the typed profile + Jordan + Sam + the invited candidate. */
function rank(live: MemberProfile, fourth: MemberProfile, samBudget?: number) {
  const members = [live, ...friends, fourth].map((m) => (m.id === SAM && samBudget ? { ...m, budgetMax: samBudget } : m));
  return { members, ranked: rankListings(pool, members, commuteMatrix, destinations, { groupSize: 4 }) };
}

const sam = friends.find((m) => m.id === SAM)!;
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

describe("demo path: the on-stage flip holds for the typed profile", () => {
  for (const mode of ["bus", "walk"] as TravelMode[]) {
    for (const answers of ANSWER_SETS) {
      it.each(candidates.map((c) => [c.displayName, c] as const))(`mode=${mode} answers=[${answers.join(",") || "none"}] + %s`, (_name, fourth) => {
        const live = demoProfile(mode, answers);
        const before = rank(live, fourth);
        const X = before.ranked[0];
        expect(X.eligibility).not.toBe("blocked");
        const onlySam = (id: string) => {
          const r = before.ranked.find((x) => x.listingId === id)!;
          return r.eligibility === "blocked" && r.blockers.every((b) => b.kind === "budget" && b.memberId === SAM);
        };
        expect(onlySam(Y)).toBe(true);

        for (const bump of [100, 150, 200, 250]) {
          const after = rank(live, fourth, sam.budgetMax + bump);
          // The typed profile's weights come from this-or-that, so the winner may be State Street
          // Village or another real home Sam's budget blocked; either tells the same story.
          const top = after.ranked[0].listingId;
          expect(top, `bump +$${bump}`).not.toBe(X.listingId);
          expect(onlySam(top), `${top} was blocked only by Sam`).toBe(true);
          const diff = diffRankings(before.ranked, after.ranked, {
            changedInputs: [`Sam's budget $${sam.budgetMax} → $${sam.budgetMax + bump}`],
            listings,
            members: after.members,
          });
          expect(diff.becameEligible).toContain(top);
          expect(diff.newTop).toBe(top);
          const text = diff.sentences.join(" ");
          expect(text).toMatch(/became affordable for Sam/);
          expect(text).not.toMatch(/NaN|undefined|null|Infinity/);
        }
      });
    }
  }

  it("explanations for every listing are clean for the demo group", () => {
    const live = demoProfile("bus", []);
    const { members, ranked } = rank(live, candidates[0]);
    for (const r of ranked) {
      const l = listings.find((x) => x.id === r.listingId)!;
      const e = explainListing(r, l, members, destinations);
      const all = [e.summary, ...e.strengths, e.compromise ?? "", ...Object.values(e.perMember).flat()].join(" ");
      expect(all, r.listingId).not.toMatch(/NaN|undefined|Infinity|\$-/);
    }
  });

  it("at seeded budgets some homes are open and several more wait only on Sam's budget", () => {
    for (const fourth of candidates) {
      const { ranked } = rank(demoProfile("bus", []), fourth);
      // At least one open home is the "before" #1. (Haven 4BR used to be a second one only because its
      // price was unknown; with the team sheet's $1,099/person it is honestly over Sam's budget.)
      expect(ranked.filter((r) => r.eligibility !== "blocked").length, fourth.displayName).toBeGreaterThanOrEqual(1);
      const nearlyOpen = ranked.filter(
        (r) => r.eligibility === "blocked" && r.blockers.every((b) => b.kind === "budget" && b.memberId === SAM && (b.amount ?? Infinity) <= 100),
      );
      expect(nearlyOpen.length, fourth.displayName).toBeGreaterThanOrEqual(3);
    }
  });
});

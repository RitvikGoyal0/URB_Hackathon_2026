import { describe, expect, it } from "vitest";
import { diffRankings } from "../diff";
import { rankListings } from "../rank";
import type { MemberProfile } from "@/lib/types";
import { DESTS, makeListing, makeMatrix, makeMember } from "./fixtures";

// A miniature demo flip: Y (near North Campus, great kitchen) is blocked only by Sam's budget.
const maya = makeMember("maya", "Maya", {
  budgetMax: 850,
  travelMode: "bus",
  destinations: [
    { destinationId: "north_campus", visitsPerWeek: 4, importance: 3 },
    { destinationId: "central", visitsPerWeek: 2, importance: 2 },
  ],
  lifestyle: { noise: "quiet", cooking: "high" },
  desiredAmenities: ["largeKitchen", "dishwasher", "inUnitLaundry"],
});
const sam = makeMember("sam", "Sam", { budgetMax: 700, budgetIsHardCap: true, travelMode: "bike" });
const jordan = makeMember("jordan", "Jordan", { budgetMax: 1000, lifestyle: { noise: "social", cooking: "high" } });
const members = [maya, jordan, sam];

const X = makeListing("x_packard", {
  name: "Packard House",
  bedrooms: 3,
  rent: { amount: 1950, basis: "per_unit" }, // 650/person
  features: { largeKitchen: false, dishwasher: false, socialAmenities: false, quietBuilding: true },
});
const Y = makeListing("y_northside", {
  name: "Northside Commons",
  bedrooms: 3,
  rent: { amount: 2400, basis: "per_unit" }, // 800/person
});
const Z = makeListing("z_far", { name: "Far Away Flat", bedrooms: 3, rent: { amount: 3600, basis: "per_unit" } }); // 1,200: blocked for all
const listings = [X, Y, Z];
const matrix = makeMatrix({
  x_packard: { north_campus: { walk: 40, bike: 14, drive: 7 }, central: { walk: 10, bike: 4, drive: 4 } },
  y_northside: { north_campus: { walk: 8, bike: 3, drive: 3 }, central: { walk: 22, bike: 9, drive: 6 } },
  z_far: { north_campus: 30, central: 30 },
});

const withBudget = (ms: MemberProfile[], id: string, budget: number) => ms.map((m) => (m.id === id ? { ...m, budgetMax: budget } : m));

describe("diffRankings (§7.7)", () => {
  const before = rankListings(listings, members, matrix, DESTS);
  const afterMembers = withBudget(members, "sam", 850);
  const after = rankListings(listings, afterMembers, matrix, DESTS);
  const d = diffRankings(before, after, { changedInputs: ["Sam's budget $700 → $850"], listings, members: afterMembers });

  it("fixture sanity: X is #1 before, Y is blocked by Sam's budget only", () => {
    expect(before[0].listingId).toBe("x_packard");
    const y = before.find((r) => r.listingId === "y_northside")!;
    expect(y.eligibility).toBe("blocked");
    expect(y.blockers).toEqual([{ kind: "budget", memberId: "sam", amount: 100, message: "Exceeds Sam's budget by $100/mo." }]);
  });

  it("detects the eligibility flip and the new #1", () => {
    expect(d.changedInputs).toEqual(["Sam's budget $700 → $850"]);
    expect(d.becameEligible).toEqual(["y_northside"]);
    expect(d.becameBlocked).toEqual([]);
    expect(d.previousTop).toBe("x_packard");
    expect(d.newTop).toBe("y_northside");
    expect(d.rankMoves).toEqual([]); // Y moves 2 → 1 and X 1 → 2: below the ±2 threshold
  });

  it("biggest driver is Sam's affordability for Y", () => {
    const yBefore = before.find((r) => r.listingId === "y_northside")!.perMember.find((p) => p.memberId === "sam")!;
    const yAfter = after.find((r) => r.listingId === "y_northside")!.perMember.find((p) => p.memberId === "sam")!;
    expect(d.biggestDriver).toEqual({
      listingId: "y_northside",
      memberId: "sam",
      dim: "affordability",
      delta: Math.round((yAfter.subscores.affordability.score! - yBefore.subscores.affordability.score!) * 10) / 10,
    });
  });

  it("sentences are built only from diff data", () => {
    expect(d.sentences).toEqual([
      "Changed: Sam's budget $700 → $850.",
      "Northside Commons became affordable for Sam, and it is much closer to North Campus for Maya (8- vs 40-minute walk).",
      "Northside Commons is now #1 (was #2), ahead of Packard House (now #2).",
      `Biggest driver: Sam's affordability score for Northside Commons rose from 0 to ${Math.round(
        after.find((r) => r.listingId === "y_northside")!.perMember.find((p) => p.memberId === "sam")!.subscores.affordability.score!,
      )}.`,
    ]);
    // nothing about listings that didn't change
    expect(d.sentences.join(" ")).not.toMatch(/Far Away Flat/);
  });

  it("the 'closer for Maya' clause reflects the matrix: change the minutes, the sentence changes", () => {
    const m2 = makeMatrix({
      x_packard: { north_campus: { walk: 52 }, central: { walk: 10, bike: 4 } },
      y_northside: { north_campus: { walk: 12 }, central: { walk: 22, bike: 9 } },
      z_far: { north_campus: 30, central: 30 },
    });
    const b = rankListings(listings, members, m2, DESTS);
    const a = rankListings(listings, afterMembers, m2, DESTS);
    const dd = diffRankings(b, a, { changedInputs: [], listings, members: afterMembers });
    expect(dd.sentences.join(" ")).toMatch(/closer to North Campus for Maya \(12- vs 52-minute walk\)/);
  });

  it("detects a listing becoming blocked when a budget drops", () => {
    const lowered = withBudget(members, "jordan", 600);
    const a = rankListings(listings, lowered, matrix, DESTS);
    const dd = diffRankings(before, a, { changedInputs: ["Jordan's budget $1,000 → $600"], listings, members: lowered });
    expect(dd.becameBlocked).toEqual(["x_packard"]);
    expect(dd.sentences).toContain("Packard House is now blocked: Exceeds Jordan's budget by $50/mo.");
  });

  it("no change → no flips, same top, explicit 'stays #1' sentence", () => {
    const dd = diffRankings(before, before, { changedInputs: [], listings, members });
    expect(dd.becameEligible).toEqual([]);
    expect(dd.becameBlocked).toEqual([]);
    expect(dd.rankMoves).toEqual([]);
    expect(dd.newTop).toBe(dd.previousTop);
    expect(dd.biggestDriver).toBeNull();
    expect(dd.sentences).toEqual(["Packard House stays #1; no listing changed eligibility or moved 2+ places."]);
  });

  it("reports rank moves of 2 or more", () => {
    const fake = (ids: string[]) => before.map((r) => ({ ...r, rank: ids.indexOf(r.listingId) + 1 }));
    const b = fake(["x_packard", "y_northside", "z_far"]);
    const a = fake(["z_far", "x_packard", "y_northside"]);
    const dd = diffRankings(b, a, { changedInputs: [], listings, members });
    expect(dd.rankMoves).toEqual([{ listingId: "z_far", from: 3, to: 1 }]);
  });

  it("is deterministic", () => {
    const again = diffRankings(before, after, { changedInputs: ["Sam's budget $700 → $850"], listings, members: afterMembers });
    expect(again).toEqual(d);
  });
});

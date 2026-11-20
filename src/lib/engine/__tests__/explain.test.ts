import { describe, expect, it } from "vitest";
import { explainListing } from "../explain";
import { rankListings } from "../rank";
import type { CampusDestination, Listing, MemberProfile } from "@/lib/types";
import { DESTS, makeListing, makeMatrix, makeMember } from "./fixtures";

const maya = makeMember("maya", "Maya", {
  budgetMax: 850,
  destinations: [{ destinationId: "north_campus", visitsPerWeek: 4, importance: 3 }],
  lifestyle: { noise: "quiet", cooking: "high" },
  desiredAmenities: ["largeKitchen", "dishwasher", "inUnitLaundry"],
});
const jordan = makeMember("jordan", "Jordan", { budgetMax: 1000 });

function run(listing: Listing, members: MemberProfile[], times: Record<string, number>, dests: CampusDestination[] = DESTS) {
  const [r] = rankListings([listing], members, makeMatrix({ [listing.id]: times }), dests);
  return { r, e: explainListing(r, listing, members, dests) };
}

describe("explainListing (§7.7)", () => {
  const home = makeListing("home", { name: "Maple House" });

  it("picks the top 2 strengths and the top compromise by weight × (subscore − 50)", () => {
    const { e } = run(home, [maya], { north_campus: 31, central: 5 });
    // contributions: affordability +15, amenities +10, lifestyle +7.5, space +5, commute 0.25 × (30 − 50) = −5
    expect(e.strengths).toEqual([
      "Affordable: $600/person is 71% of Maya's $850 budget.",
      "Has the large kitchen, dishwasher and in-unit laundry Maya wants.",
    ]);
    expect(e.compromise).toBe("Main drawback: a 31-minute walk to North Campus for Maya.");
    expect(e.summary).toBe("Strong fit for the group's budgets and its large kitchen. Main drawback: a 31-minute walk to North Campus for Maya.");
  });

  it("names the most affected member", () => {
    const { e } = run(home, [jordan, maya], { north_campus: 31, central: 5 });
    expect(e.compromise).toMatch(/for Maya\.$/);
  });

  it("estimated trips are marked est. in the explanation", () => {
    const [r] = rankListings([home], [maya], makeMatrix({ [home.id]: { north_campus: 31 } }, true), DESTS);
    const e = explainListing(r, home, [maya], DESTS);
    expect(e.compromise).toMatch(/a 31-minute walk \(est\.\) to North Campus for Maya/);
  });

  it("is built from data, not hardcoded text", () => {
    const renamed = DESTS.map((d) => (d.id === "north_campus" ? { ...d, shortName: "Pierpont" } : d));
    const { e } = run(home, [maya], { north_campus: 34 }, renamed);
    expect(e.compromise).toBe("Main drawback: a 34-minute walk to Pierpont for Maya.");
  });

  it("budget compromise and blocker are surfaced", () => {
    const pricey = makeListing("p", { rent: { amount: 950, basis: "per_bedroom" } });
    const { r, e } = run(pricey, [maya], { north_campus: 5 });
    expect(r.eligibility).toBe("blocked");
    expect(e.compromise).toBe("Main drawback: $950/person is $100 over Maya's budget.");
    expect(e.summary).toMatch(/Not eligible yet: Exceeds Maya's budget by \$100\/mo\./);
  });

  it("per-member lines come from subscore reasons, blockers and warnings", () => {
    const l = makeListing("q", { features: { inUnitLaundry: null } });
    const { r, e } = run(l, [maya, jordan], { north_campus: 31, central: 8 });
    const lines = e.perMember.maya;
    expect(lines[0]).toMatch(/^Overall fit \d+\/100/);
    const pm = r.perMember.find((p) => p.memberId === "maya")!;
    expect(lines).toContain(`Commute ${Math.round(pm.subscores.commute.score!)}: ${pm.subscores.commute.reason}`);
    expect(lines.some((x) => x.includes("in-unit laundry unverified (counted as not met)"))).toBe(true);
    expect(Object.keys(e.perMember).sort()).toEqual(["jordan", "maya"]);
  });

  it("reports coverage when a category is not scored", () => {
    const unknownRent = makeListing("u", { rent: { amount: null, basis: "unknown" } });
    const { e } = run(unknownRent, [maya], { north_campus: 5 });
    expect(e.summary).toMatch(/Scored on 4 of 5 categories\.$/);
    expect(e.perMember.maya.some((x) => x.startsWith("Affordability — not scored: Contact for pricing"))).toBe(true);
  });
});

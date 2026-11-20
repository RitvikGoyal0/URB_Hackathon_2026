import { describe, expect, it } from "vitest";
import { hashProfileText, normalizeProfileText } from "../normalize";
import { lookupCachedParse } from "../cache";
import { sanitizeParse } from "../sanitize";
import type { ProfileParse } from "../../types";

const DEMO =
  "I'm an engineering student at Michigan. I'm on North Campus most weekdays, have evening club meetings, don't have a car, enjoy cooking with friends, and want housing under $850 a month.";

describe("normalize + cache", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeProfileText("  Hello   World \n")).toBe("hello world");
    expect(hashProfileText("A  b")).toBe(hashProfileText("a b"));
  });
  it("demo sentence hits the cache, with spacing/case variations", () => {
    expect(lookupCachedParse(DEMO)).not.toBeNull();
    expect(lookupCachedParse(`  ${DEMO.toUpperCase()}  `)).not.toBeNull();
  });
  it("demo parse matches spec §8.3", () => {
    const p = lookupCachedParse(DEMO)!;
    expect(p.destinations.map((d) => [d.destinationId, d.visitsPerWeek])).toEqual([["north_campus", 4]]);
    expect(p.unmappedPlaces[0]).toMatchObject({ suggestedDestinationId: "central_campus", question: "Where do your club meetings happen?" });
    expect(p.hasCar?.value).toBe(false);
    expect(p.travelMode).toBeUndefined();
    expect(p.travelModeOptions).toEqual(["bus", "walk"]);
    expect(p.lifestyle.cooking?.value).toBe("high");
    expect(p.budgetMax?.value).toBe(850);
  });
  it("other text misses the cache", () => {
    expect(lookupCachedParse("I like dogs")).toBeNull();
  });
});

describe("sanitizeParse guardrails", () => {
  const ids = new Set(["north_campus", "central_campus"]);
  const base: ProfileParse = {
    destinations: [],
    lifestyle: {},
    requirements: {},
    desiredAmenities: [],
    unmappedPlaces: [],
    missing: [],
  };
  it("drops an invented budget that is not in the text", () => {
    const out = sanitizeParse({ ...base, budgetMax: { value: 900, sourceText: "cheap", confidence: 0.5 } }, "something cheap please", ids);
    expect(out.budgetMax).toBeUndefined();
    expect(out.missing).toContain("budget");
  });
  it("keeps a budget written in the text, including $1,200 formatting", () => {
    const out = sanitizeParse({ ...base, budgetMax: { value: 1200, sourceText: "$1,200", confidence: 0.9 } }, "max $1,200 a month", ids);
    expect(out.budgetMax?.value).toBe(1200);
  });
  it("moves unknown destination ids to unmappedPlaces", () => {
    const out = sanitizeParse(
      { ...base, destinations: [{ destinationId: "gym", sourceText: "the gym", confidence: 0.8 }] },
      "I go to the gym",
      ids,
    );
    expect(out.destinations).toHaveLength(0);
    expect(out.unmappedPlaces[0].text).toBe("the gym");
  });
  it("strips suggestions outside the registry and recomputes missing", () => {
    const out = sanitizeParse(
      { ...base, unmappedPlaces: [{ text: "work", suggestedDestinationId: "mars", question: "Where?" }], missing: ["budget"] },
      "I work",
      ids,
    );
    expect(out.unmappedPlaces[0].suggestedDestinationId).toBeUndefined();
    expect(out.missing.sort()).toEqual(["budget", "travelMode"]);
  });
});

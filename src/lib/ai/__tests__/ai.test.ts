import { describe, expect, it } from "vitest";
import { hashProfileText, normalizeProfileText } from "../normalize";
import { lookupCachedParse } from "../cache";
import { sanitizeParse } from "../sanitize";
import type { ProfileParse } from "../../types";

import { DEMO_SENTENCE as DEMO } from "../../demo-profile";

describe("normalize + cache", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeProfileText("  Hello   World \n")).toBe("hello world");
    expect(hashProfileText("A  b")).toBe(hashProfileText("a b"));
  });
  it("demo sentence hits the cache, with spacing/case variations", () => {
    expect(lookupCachedParse(DEMO)).not.toBeNull();
    expect(lookupCachedParse(`  ${DEMO.toUpperCase()}  `)).not.toBeNull();
  });
  it("demo parse: North 4×/wk + Central 2×/wk, $1,100, bike, quiet, cooks a lot; nothing left to ask", () => {
    const p = lookupCachedParse(DEMO)!;
    expect(p.destinations.map((d) => [d.destinationId, d.visitsPerWeek])).toEqual([
      ["north_campus", 4],
      ["central_campus", 2],
    ]);
    expect(p.unmappedPlaces).toEqual([]);
    expect(p.missing).toEqual([]);
    expect(p.hasCar?.value).toBe(false);
    expect(p.travelMode?.value).toBe("bike");
    expect(p.lifestyle.noise?.value).toBe("quiet");
    expect(p.lifestyle.cooking?.value).toBe("high");
    expect(p.budgetMax?.value).toBe(1100);
    expect(p.desiredAmenities.map((a) => a.value)).toEqual(["largeKitchen", "dishwasher", "inUnitLaundry"]);
    // every quote really is in the sentence
    const quotes = [
      ...p.destinations.map((d) => d.sourceText),
      p.budgetMax!.sourceText,
      p.travelMode!.sourceText,
      p.hasCar!.sourceText,
      p.lifestyle.noise!.sourceText,
      p.lifestyle.cooking!.sourceText,
      ...p.desiredAmenities.map((a) => a.sourceText),
    ];
    for (const q of quotes) expect(DEMO).toContain(q);
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

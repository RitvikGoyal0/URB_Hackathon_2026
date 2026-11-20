import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, exploreHref, exploreQuery, isDefaultFilters, listingHref, parseExploreQuery, type Filters } from "../explore-query";

const q = (s: string) => parseExploreQuery(new URLSearchParams(s));

describe("Explore query (Back to All Homes)", () => {
  it("defaults give an empty query and round-trip", () => {
    expect(exploreQuery("all", DEFAULT_FILTERS)).toBe("");
    expect(q("")).toEqual({ tab: "all", filters: DEFAULT_FILTERS });
    expect(isDefaultFilters(q("").filters)).toBe(true);
  });

  it("round-trips every filter and the Haven tab", () => {
    const f: Filters = { sources: ["umich_offcampus"], bedrooms: "4+", maxPrice: 1200, includeUnpriced: false, amenities: ["dishwasher", "ac"] };
    const s = exploreQuery("haven", f);
    expect(s).toBe("tab=haven&src=umich_offcampus&beds=4%2B&max=1200&unpriced=0&amen=ac%2Cdishwasher");
    expect(q(s)).toEqual({ tab: "haven", filters: { ...f, amenities: ["ac", "dishwasher"] } });
  });

  it("drops junk: unknown keys, bad numbers, unknown amenities and sources", () => {
    const r = q("tab=evil&beds=9&max=-5&amen=dishwasher,<script>,dishwasher&src=nope&foo=bar");
    expect(r).toEqual({ tab: "all", filters: { ...DEFAULT_FILTERS, amenities: ["dishwasher"] } });
    expect(q("max=99999").filters.maxPrice).toBeNull();
    expect(q("max=abc").filters.maxPrice).toBeNull();
  });

  it("accepts the old ?mode=haven", () => {
    expect(q("mode=haven").tab).toBe("haven");
  });

  it("back links rebuild a clean /explore URL", () => {
    expect(exploreHref(null)).toBe("/explore");
    expect(exploreHref("")).toBe("/explore");
    expect(exploreHref("?tab=haven&max=1100&x=1")).toBe("/explore?tab=haven&max=1100");
    expect(exploreHref("//evil.example.com")).toBe("/explore");
    expect(listingHref("um_ssv_4br", "")).toBe("/listing/um_ssv_4br");
    expect(listingHref("um_ssv_4br", "tab=haven&max=1100")).toBe("/listing/um_ssv_4br?back=tab%3Dhaven%26max%3D1100");
  });
});

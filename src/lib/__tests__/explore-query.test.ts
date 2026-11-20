import { describe, expect, it } from "vitest";
import { exploreHref, exploreQuery, listingHref, parseExploreQuery } from "../explore-query";

const q = (s: string) => parseExploreQuery(new URLSearchParams(s));

describe("Explore query (Back to All Homes)", () => {
  it("the default tab gives an empty query and round-trips", () => {
    expect(exploreQuery("all")).toBe("");
    expect(q("")).toEqual({ tab: "all" });
    expect(q(exploreQuery("haven"))).toEqual({ tab: "haven" });
  });

  it("ignores old filter params and junk", () => {
    expect(q("tab=haven&src=umich_offcampus&beds=4%2B&max=1200&unpriced=0&amen=ac")).toEqual({ tab: "haven" });
    expect(q("tab=evil&beds=9&foo=bar")).toEqual({ tab: "all" });
  });

  it("accepts the old ?mode=haven", () => {
    expect(q("mode=haven").tab).toBe("haven");
  });

  it("back links rebuild a clean /explore URL", () => {
    expect(exploreHref(null)).toBe("/explore");
    expect(exploreHref("")).toBe("/explore");
    expect(exploreHref("?tab=haven&max=1100&x=1")).toBe("/explore?tab=haven");
    expect(exploreHref("?max=1100")).toBe("/explore");
    expect(exploreHref("//evil.example.com")).toBe("/explore");
    expect(listingHref("um_ssv_4br", "")).toBe("/listing/um_ssv_4br");
    expect(listingHref("um_ssv_4br", "tab=haven")).toBe("/listing/um_ssv_4br?back=tab%3Dhaven");
  });
});

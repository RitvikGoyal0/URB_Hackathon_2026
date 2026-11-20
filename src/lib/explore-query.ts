/**
 * Explore's tab lives in the URL (V3 §3.1): "Back to All Homes" links to /explore?<the same query>,
 * so a refresh or deep link restores the view without browser history. There are no filters: the
 * group's profiles decide what fits. Old filter params (src, beds, max, unpriced, amen) and any
 * other unknown keys are dropped, so old links still load and a hostile URL can't break the page.
 */
export type ExploreTab = "all" | "haven";

export function parseExploreQuery(sp: URLSearchParams | { get(k: string): string | null }): { tab: ExploreTab } {
  const tabRaw = sp.get("tab") ?? sp.get("mode");
  return { tab: tabRaw === "haven" ? "haven" : "all" };
}

/** Canonical query string (no leading "?"); empty for the default tab. */
export function exploreQuery(tab: ExploreTab): string {
  return tab === "haven" ? "tab=haven" : "";
}

/** "/explore" plus a cleaned copy of an incoming query (e.g. the listing page's ?back=…). */
export function exploreHref(rawQuery: string | null | undefined): string {
  if (!rawQuery) return "/explore";
  const q = exploreQuery(parseExploreQuery(new URLSearchParams(rawQuery.replace(/^\?/, ""))).tab);
  return q ? `/explore?${q}` : "/explore";
}

/** Listing link that remembers how Explore looked. */
export function listingHref(id: string, query: string): string {
  return query ? `/listing/${id}?back=${encodeURIComponent(query)}` : `/listing/${id}`;
}

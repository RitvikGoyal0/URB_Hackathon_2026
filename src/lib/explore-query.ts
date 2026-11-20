/**
 * Explore's tab + filters live in the URL (V3 §3.1): "Back to All Homes" links to
 * /explore?<the same query>, so a refresh or deep link restores the view without browser history.
 * Unknown keys and bad values are dropped, so a hand-edited or hostile URL can't break the page.
 */
import { featureKey } from "./schemas";
import type { FeatureKey, SourceType } from "./types";

export type ExploreTab = "all" | "haven";

export interface Filters {
  sources: SourceType[];
  bedrooms: "any" | "1" | "2" | "3" | "4+";
  maxPrice: number | null;
  includeUnpriced: boolean;
  amenities: FeatureKey[];
}

export const ALL_SOURCES: SourceType[] = ["haven", "umich_offcampus"];

export const DEFAULT_FILTERS: Filters = {
  sources: [...ALL_SOURCES],
  bedrooms: "any",
  maxPrice: null,
  includeUnpriced: true,
  amenities: [],
};

export const PRICE_FLOOR = 300;
export const PRICE_CEIL = 4000;
const BEDS = ["1", "2", "3", "4+"] as const;

export function isDefaultFilters(f: Filters): boolean {
  return (
    ALL_SOURCES.every((s) => f.sources.includes(s)) &&
    f.bedrooms === "any" &&
    f.maxPrice === null &&
    f.includeUnpriced &&
    f.amenities.length === 0
  );
}

export function parseExploreQuery(sp: URLSearchParams | { get(k: string): string | null }): { tab: ExploreTab; filters: Filters } {
  const tabRaw = sp.get("tab") ?? sp.get("mode");
  const tab: ExploreTab = tabRaw === "haven" ? "haven" : "all";
  const beds = sp.get("beds");
  const max = Number(sp.get("max"));
  const list = (k: string) => (sp.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const src = list("src").filter((s): s is SourceType => (ALL_SOURCES as string[]).includes(s));
  const amen = [...new Set(list("amen"))].filter((a): a is FeatureKey => (featureKey.options as string[]).includes(a));
  return {
    tab,
    filters: {
      sources: src.length > 0 ? src : [...ALL_SOURCES],
      bedrooms: (BEDS as readonly string[]).includes(beds ?? "") ? (beds as Filters["bedrooms"]) : "any",
      maxPrice: Number.isFinite(max) && max >= PRICE_FLOOR && max <= PRICE_CEIL ? Math.round(max) : null,
      includeUnpriced: sp.get("unpriced") !== "0",
      amenities: amen,
    },
  };
}

/** Canonical query string (no leading "?"); empty when everything is default. */
export function exploreQuery(tab: ExploreTab, f: Filters): string {
  const sp = new URLSearchParams();
  if (tab === "haven") sp.set("tab", "haven");
  if (!ALL_SOURCES.every((s) => f.sources.includes(s)) && f.sources.length > 0) sp.set("src", [...f.sources].sort().join(","));
  if (f.bedrooms !== "any") sp.set("beds", f.bedrooms);
  if (f.maxPrice !== null) sp.set("max", String(Math.round(f.maxPrice)));
  if (!f.includeUnpriced) sp.set("unpriced", "0");
  if (f.amenities.length > 0) sp.set("amen", [...f.amenities].sort().join(","));
  return sp.toString();
}

/** "/explore" plus a cleaned copy of an incoming query (e.g. the listing page's ?back=…). */
export function exploreHref(rawQuery: string | null | undefined): string {
  if (!rawQuery) return "/explore";
  const { tab, filters } = parseExploreQuery(new URLSearchParams(rawQuery.replace(/^\?/, "")));
  const q = exploreQuery(tab, filters);
  return q ? `/explore?${q}` : "/explore";
}

/** Listing link that remembers how Explore looked. */
export function listingHref(id: string, query: string): string {
  return query ? `/listing/${id}?back=${encodeURIComponent(query)}` : `/listing/${id}`;
}

"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { List, Map as MapIcon, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { communities, destinations, getCommunity, getListing, universities } from "@/lib/data";
import { explainListing } from "@/lib/engine";
import { useGroup } from "@/hooks/use-group";
import type { Explanation, Listing, RankedResult } from "@/lib/types";
import { ListingCard } from "./listing-card";
import { ExploreMapClient } from "./map-client";
import { WhatIfPanel } from "./what-if-panel";
import { FilterBar } from "./filters";
import { HavenPortfolio } from "./haven-portfolio";
import { DEFAULT_FILTERS, exploreQuery, isDefaultFilters, listingHref, parseExploreQuery, type ExploreTab as Mode, type Filters } from "@/lib/explore-query";

const SCROLL_KEY = "htl:explore-scroll";

function passes(listing: Listing, result: RankedResult, f: Filters): boolean {
  if (!f.sources.includes(listing.sourceType)) return false;
  if (f.bedrooms !== "any") {
    if (f.bedrooms === "4+" ? listing.bedrooms < 4 : listing.bedrooms !== Number(f.bedrooms)) return false;
  }
  const pp = result.perMember[0]?.perPersonRent ?? null;
  if (pp === null) {
    if (!f.includeUnpriced) return false;
  } else if (f.maxPrice !== null && pp > f.maxPrice) return false;
  for (const a of f.amenities) if (listing.features[a] !== true) return false;
  return true;
}

export function ExploreView() {
  // The URL is the source of truth for tab + filters (V3 §3.1), so "Back to All Homes" and a
  // refresh land on the same view. history.replaceState keeps useSearchParams in sync.
  const params = useSearchParams();
  const { tab: mode, filters } = useMemo(() => parseExploreQuery(params), [params]);
  const query = exploreQuery(mode, filters);
  const writeQuery = useCallback((tab: Mode, f: Filters) => {
    const q = exploreQuery(tab, f);
    window.history.replaceState(null, "", q ? `/explore?${q}` : "/explore");
  }, []);
  const setFilters = (f: Filters) => writeQuery(mode, f);
  const setMode = (m: Mode) => writeQuery(m, filters);

  const g = useGroup();
  const { people, ranking, baselineById, data, contextLabel, lobby } = g;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState(false);
  const [compare, setCompare] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  const saved = useMemo(() => new Set(data.watchlist.map((w) => w.listingId)), [data.watchlist]);

  const explanations = useMemo(() => {
    const m = new Map<string, Explanation>();
    for (const r of ranking) {
      const l = getListing(r.listingId);
      if (l) m.set(r.listingId, explainListing(r, l, g.members, destinations));
    }
    return m;
  }, [ranking, g.members]);

  const rows = useMemo(
    () =>
      ranking
        .map((result) => ({ result, listing: getListing(result.listingId)! }))
        .filter((x) => x.listing)
        .map((x) => ({ ...x, community: getCommunity(x.listing.communityId) })),
    [ranking],
  );

  const havenCommunity = communities.find((c) => c.brand === "Haven" && c.campusId === "umich");
  const modeRows = mode === "haven" ? rows.filter((r) => r.listing.sourceType === "haven") : rows;
  const visible = modeRows.filter((r) => passes(r.listing, r.result, filters));

  // Coming back from a listing: put the list where it was (saved when a card was opened). The
  // listing's Back link uses scroll={false}, so this effect owns the scroll position on arrival.
  useEffect(() => {
    let saved: { q: string; y: number } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "null");
    } catch {
      saved = null;
    }
    const match = !!saved && typeof saved.y === "number" && saved.q === window.location.search.replace(/^\?/, "");
    const y = match ? saved!.y : 0;
    // A timer, not requestAnimationFrame: rAF is paused in background/embedded views.
    const t = setTimeout(() => {
      window.scrollTo({ top: y });
      try {
        sessionStorage.removeItem(SCROLL_KEY);
      } catch {
        /* ignore */
      }
    }, 30);
    return () => clearTimeout(t);
  }, []);
  const rememberScroll = () => {
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ q: query, y: window.scrollY }));
    } catch {
      /* private mode: no restore, still navigates */
    }
  };

  const selectFromMap = useCallback((id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const campus = universities.find((u) => u.id === "umich");
  const center: [number, number] = [campus?.lat ?? 42.278, campus?.lng ?? -83.738];
  const blockedCount = visible.filter((r) => r.result.eligibility === "blocked").length;

  const map = (
    <ExploreMapClient
      items={visible.map((r) => ({ listing: r.listing, community: r.community, result: r.result }))}
      destinations={destinations}
      selectedId={selectedId}
      onSelect={selectFromMap}
      center={center}
    />
  );

  const whatIfPanel = (
    <WhatIfPanel
      people={people}
      baseMembers={g.baseMembers}
      members={g.members}
      baseline={g.baseline}
      ranking={ranking}
      changedInputs={g.changedInputs}
      compare={compare}
      onCompareChange={setCompare}
      onClose={() => setWhatIf(false)}
      className="h-full"
    />
  );

  return (
    <main className="mx-auto w-full max-w-[90rem] px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[13px] font-medium text-teal">{contextLabel}</p>
          <h1 className="mt-1 text-[2rem] leading-tight font-semibold text-ink sm:text-[2.5rem]">
            {mode === "haven" ? "Haven communities" : lobby ? `Homes that work for all ${lobby.targetSize} of you` : "Homes near campus"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Housing mode" className="inline-flex rounded-full bg-secondary p-1">
            {(
              [
                ["all", "All Housing"],
                ["haven", "Haven"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors",
                  mode === m ? "bg-ink text-paper" : "text-charcoal/75 hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            className={cn("h-10 rounded-full bg-white px-4", !isDefaultFilters(filters) && "border-ink")}
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal aria-hidden /> Filters{!isDefaultFilters(filters) ? " (on)" : ""}
          </Button>
          <Button className={cn("h-10 rounded-full px-4", whatIf && "bg-teal hover:bg-teal/90")} onClick={() => setWhatIf((o) => !o)} aria-expanded={whatIf}>
            <Sparkles aria-hidden /> What if…
            {g.hasScenario && <span className="ml-1 rounded-full bg-amber px-1.5 text-[11px] text-white">on</span>}
          </Button>
        </div>
      </div>

      {filtersOpen && (
        <div className="mt-5">
          <FilterBar value={filters} onChange={setFilters} showSources={mode === "all"} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          Showing {visible.length} of {modeRows.length} {mode === "haven" ? "Haven floor plans" : "homes"}
          {blockedCount > 0 && ` · ${blockedCount} blocked (still ranked, dimmed)`}
          {g.hasScenario && " · what-if budgets applied"}
        </p>
        <div className="inline-flex rounded-full bg-secondary p-1 lg:hidden" role="tablist" aria-label="List or map">
          <button
            role="tab"
            aria-selected={mobileView === "list"}
            onClick={() => setMobileView("list")}
            className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-medium", mobileView === "list" ? "bg-ink text-paper" : "text-charcoal")}
          >
            <List className="size-3.5" aria-hidden /> List
          </button>
          <button
            role="tab"
            aria-selected={mobileView === "map"}
            onClick={() => setMobileView("map")}
            className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-medium", mobileView === "map" ? "bg-ink text-paper" : "text-charcoal")}
          >
            <MapIcon className="size-3.5" aria-hidden /> Map
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className={cn("min-w-0", mobileView === "map" && "hidden lg:block", whatIf && "pb-[52vh] lg:pb-0")}>
          {mode === "haven" && havenCommunity && (
            <div className="mb-5">
              <HavenPortfolio
                community={havenCommunity}
                items={rows.filter((r) => r.listing.communityId === havenCommunity.id)}
                people={people}
                total={rows.length}
                explanations={explanations}
              />
            </div>
          )}
          {visible.length === 0 ? (
            <div className="rounded-[26px] border border-dashed border-line bg-white p-8 text-center">
              <p className="font-semibold text-ink">No homes match these filters.</p>
              <Button variant="outline" className="mt-3 rounded-full" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear filters
              </Button>
            </div>
          ) : (
            <LayoutGroup>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2" onClickCapture={rememberScroll}>
                {visible.map(({ result, listing }) => (
                  <motion.li key={listing.id} className="min-w-0" layout="position" transition={{ type: "spring", stiffness: 380, damping: 36 }}>
                    <ListingCard
                      result={result}
                      listing={listing}
                      people={people}
                      href={listingHref(listing.id, query)}
                      selected={selectedId === listing.id}
                      saved={saved.has(listing.id)}
                      compareRank={compare && g.hasScenario ? baselineById.get(listing.id)?.rank : undefined}
                      onSelect={() => setSelectedId(listing.id)}
                    />
                  </motion.li>
                ))}
              </ul>
            </LayoutGroup>
          )}
        </div>

        {/* Desktop right rail: what-if panel or map */}
        <div className="hidden lg:block">
          <div className="sticky top-20 h-[calc(100vh-6rem)] min-h-[520px]">
            {whatIf ? whatIfPanel : <div className="h-full overflow-hidden rounded-[26px] border border-line">{map}</div>}
          </div>
        </div>

        {/* Mobile map */}
        {mobileView === "map" && (
          <div className="h-[70vh] overflow-hidden rounded-[26px] border border-line lg:hidden">{map}</div>
        )}
      </div>

      {/* Mobile what-if: bottom panel that leaves the list visible above it */}
      {whatIf && (
        <div className="fixed inset-x-0 bottom-0 z-30 max-h-[50vh] overflow-y-auto rounded-t-[26px] shadow-[0_-20px_50px_-20px_rgba(20,33,61,0.4)] lg:hidden">
          {whatIfPanel}
        </div>
      )}
    </main>
  );
}

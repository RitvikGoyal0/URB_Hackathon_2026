"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, MapPin, Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Community, Explanation, Listing, MemberProfile, RankedResult } from "@/lib/types";
import { SourceBadge } from "@/components/shared/bits";
import { ScoreRing } from "@/components/shared/score-ring";
import { ListingPhoto } from "@/components/shared/listing-photo";
import { groupFitLabel, shortDate } from "@/components/shared/format";
import { PriceLine, ringMembersFor } from "./listing-card";

/**
 * Haven tab portfolio card (spec §9). Visual prominence carries a "Featured community" label
 * that is separate from the score; ranks shown are the unboosted All Housing ranks.
 */
export function HavenPortfolio({
  community,
  items,
  people,
  total,
  explanations,
}: {
  community: Community;
  items: { listing: Listing; result: RankedResult }[];
  people: MemberProfile[];
  total: number;
  explanations: Map<string, Explanation>;
}) {
  const [expanded, setExpanded] = useState(false);
  const scopeLabel = { community: "Community", floorplan: "Some floor plans", unit: "Unit" } as const;
  return (
    <section className="overflow-hidden rounded-[28px] border border-teal/30 bg-white">
      <div>
        <ListingPhoto src={items[0]?.listing.images[0]} alt={community.name} className="h-44" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-paper">
              <Star className="size-3" aria-hidden /> Featured community
            </span>
            <SourceBadge sourceType="haven" observedAt={community.provenance.observedAt} />
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            “Featured” is a display label only. It does not change any score or rank.
          </p>
          <h2 className="mt-3 text-[1.7rem] leading-tight font-semibold text-ink">{community.name}</h2>
          <p className="mt-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            {community.address}
          </p>
          <p className={cn("mt-3 text-[14px] leading-relaxed text-charcoal", !expanded && "line-clamp-3")}>{community.description}</p>
          <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1 text-[13px] font-medium text-teal hover:underline" aria-expanded={expanded}>
            {expanded ? "Show less" : "Read the full sourced description"}
          </button>
          {community.officialUrl && (
            <a
              href={community.officialUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-10 rounded-full px-4")}
            >
              View official property <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>

      {community.amenities.length > 0 && (
        <div className="border-t border-line p-5 sm:p-6">
          <h3 className="text-[16px] font-semibold text-ink">Sourced amenities</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            As reported by {community.provenance.sourceName} on {shortDate(community.provenance.observedAt)}. Scope shows whether a claim covers the whole
            community or only some layouts.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {community.amenities.map((a, i) => (
              <li
                key={i}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px]",
                  a.scope === "community" ? "border-line bg-paper text-charcoal" : "border-dashed border-amber/60 bg-amber-soft/50 text-[#7a4a00]",
                )}
                title={`${a.provenance.sourceName}, ${a.provenance.status.replace("_", " ")} ${shortDate(a.provenance.observedAt)}`}
              >
                {a.value}
                {a.scope !== "community" && <span className="text-[11px] opacity-80">({scopeLabel[a.scope]})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-line bg-paper/60 p-5 sm:p-6">
        <h3 className="text-[16px] font-semibold text-ink">How it fits your group</h3>
        <div className="mt-3 grid gap-3">
          {items.map(({ listing, result }) => {
            const ex = explanations.get(listing.id);
            return (
              <Link
                key={listing.id}
                href={`/listing/${listing.id}`}
                className="flex flex-col gap-3 rounded-[22px] border border-line bg-white p-4 transition-colors hover:border-ink/30 sm:flex-row sm:items-center"
              >
                <ScoreRing score={result.groupScore} members={ringMembersFor(result, people)} size={64} stroke={6} dimmed={result.eligibility === "blocked"} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{listing.name}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    Rank #{result.rank} of {total} in All Housing · {groupFitLabel(result.groupScore)}
                  </p>
                  {ex?.summary && !ex.summary.toLowerCase().includes("stub") && <p className="mt-1 text-[13px] text-charcoal">{ex.summary}</p>}
                  {ex?.compromise && <p className="mt-1 text-[13px] text-[#8a5300]">{ex.compromise}</p>}
                </div>
                <PriceLine listing={listing} result={result} className="sm:text-right" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

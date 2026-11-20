"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Bath, BedDouble, Bookmark, BookmarkCheck, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { actions } from "@/lib/store";
import type { Community, Explanation, Listing, MemberProfile, RankedResult } from "@/lib/types";
import { Chips, CoverageBadge, ListingSourceBadge, MemberAvatar } from "@/components/shared/bits";
import { ScoreRing } from "@/components/shared/score-ring";
import { RepresentativeImage } from "@/components/shared/representative-image";
import { HOUSING_LABEL, fmtScore, memberColor, money } from "@/components/shared/format";

export function ringMembersFor(result: RankedResult, people: MemberProfile[]) {
  return result.perMember.map((pm, i) => {
    const idx = people.findIndex((p) => p.id === pm.memberId);
    const m = people[idx] ?? people[i];
    return { id: pm.memberId, name: m?.displayName ?? pm.memberId, hex: memberColor(m ?? {}, idx >= 0 ? idx : i).hex, score: pm.score };
  });
}

export function PriceLine({ listing, result, className }: { listing: Listing; result: RankedResult; className?: string }) {
  const pp = result.perMember[0]?.perPersonRent ?? null;
  const sec = listing.rent.secondary;
  return (
    <div className={className}>
      {pp === null ? (
        <span className="font-display text-[19px] font-semibold text-ink">Contact for pricing</span>
      ) : (
        <span className="font-display text-[22px] font-semibold text-ink tabular-nums">
          {money(pp)}
          <span className="text-[13px] font-normal text-muted-foreground"> /person/mo</span>
        </span>
      )}
      <span className="block text-[12px] text-muted-foreground">
        {listing.rent.amount !== null && listing.rent.basis === "per_unit" && `${money(listing.rent.amount)}/unit split ${result.perMember.length} ways`}
        {listing.rent.amount !== null && listing.rent.basis === "per_bedroom" && "Priced per bed"}
        {listing.rent.amount !== null && listing.rent.basis === "per_person" && "Priced per person"}
        {(listing.rent.amount === null || listing.rent.basis === "unknown") && "Rent not published"}
        {sec && ` · ${sec.label} ${money(sec.min)}–${money(sec.max)}`}
        {listing.rent.utilitiesIncluded === true && " · utilities incl."}
        {listing.rent.utilitiesIncluded === false && " · excludes utilities"}
      </span>
    </div>
  );
}

export function ListingCard({
  result,
  listing,
  community,
  people,
  explanation,
  selected,
  saved,
  compareRank,
  onSelect,
}: {
  result: RankedResult;
  listing: Listing;
  community?: Community;
  people: MemberProfile[];
  explanation?: Explanation;
  selected: boolean;
  saved: boolean;
  /** baseline rank when Compare is on */
  compareRank?: number;
  onSelect: () => void;
}) {
  const blocked = result.eligibility === "blocked";
  const least = people.find((p) => p.id === result.leastSatisfiedMemberId);
  const isDemo = listing.sourceType === "synthetic";
  const moved = compareRank !== undefined ? compareRank - result.rank : 0;

  return (
    <article
      id={`card-${listing.id}`}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      className={cn(
        "group relative overflow-hidden rounded-[26px] border bg-white transition-[border-color,box-shadow,opacity]",
        selected ? "border-ink shadow-[0_18px_44px_-30px_rgba(20,33,61,0.6)]" : "border-line",
        blocked && "opacity-[0.72]",
      )}
    >
      {isDemo && <div className="demo-stripes h-2 w-full" aria-hidden />}
      <div className="flex gap-4 p-4 sm:p-5">
        <div className="relative hidden w-28 shrink-0 sm:block">
          <RepresentativeImage housingType={listing.housingType} className="h-28 w-28 rounded-[18px]" showLabel={false} seed={result.rank} />
          <span className="absolute -top-2 -left-2 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-ink px-2 font-display text-[15px] font-semibold text-paper ring-4 ring-white">
            {result.rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 sm:hidden">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-ink px-2 font-display text-[13px] font-semibold text-paper">
                  {result.rank}
                </span>
                {compareRank !== undefined && <MoveBadge moved={moved} from={compareRank} />}
              </div>
              <h3 className="mt-1 text-[17px] leading-snug font-semibold text-ink sm:mt-0">
                <Link href={`/listing/${listing.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                  {listing.name}
                </Link>
              </h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
                <span>{HOUSING_LABEL[listing.housingType]}</span>
                <span className="inline-flex items-center gap-1">
                  <BedDouble className="size-3.5" aria-hidden />
                  {listing.bedrooms} bd
                </span>
                <span className="inline-flex items-center gap-1">
                  <Bath className="size-3.5" aria-hidden />
                  {listing.bathrooms} ba
                </span>
                {community && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{community.address}</span>
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <ScoreRing score={result.groupScore} members={ringMembersFor(result, people)} size={64} stroke={6} dimmed={blocked} />
              {compareRank !== undefined && (
                <span className="hidden sm:block">
                  <MoveBadge moved={moved} from={compareRank} />
                </span>
              )}
            </div>
          </div>

          <p className="mt-2 text-[13px] text-charcoal">
            Average fit <span className="font-semibold text-ink tabular-nums">{fmtScore(result.mean)}</span> · Least-satisfied member{" "}
            <span className="font-semibold text-ink tabular-nums">{fmtScore(result.min)}</span>
            {least && <span className="text-muted-foreground"> ({least.displayName})</span>}
          </p>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <PriceLine listing={listing} result={result} />
            <div className="flex -space-x-1.5" aria-hidden>
              {result.perMember.map((pm, i) => {
                const m = people.find((p) => p.id === pm.memberId) ?? people[i];
                return m ? <MemberAvatar key={pm.memberId} member={m} index={people.indexOf(m)} size="xs" /> : null;
              })}
            </div>
          </div>

          {explanation && explanation.summary && !explanation.summary.toLowerCase().includes("stub") && (
            <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{explanation.summary}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5 pr-11">
            <ListingSourceBadge listing={listing} />
            <CoverageBadge coverage={result.coverage} />
          </div>
          <div className="mt-2 pr-11">
            <Chips result={result} max={3} />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const nowSaved = actions.toggleWatch(listing.id);
          toast(nowSaved ? `Saved ${listing.name} to your watchlist` : `Removed ${listing.name} from your watchlist`);
        }}
        className={cn(
          "absolute right-4 bottom-4 z-10 inline-flex size-9 items-center justify-center rounded-full border transition-colors focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none",
          saved ? "border-teal bg-teal-soft text-teal" : "border-line bg-white text-charcoal hover:border-ink/30",
        )}
        aria-pressed={saved}
        aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
      >
        {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
      </button>
    </article>
  );
}

function MoveBadge({ moved, from }: { moved: number; from: number }) {
  if (moved === 0)
    return <span className="inline-flex h-6 items-center rounded-full bg-secondary px-2 text-[11.5px] font-medium text-muted-foreground">was #{from}</span>;
  const up = moved > 0;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-[11.5px] font-semibold",
        up ? "bg-teal-soft text-teal" : "bg-amber-soft text-[#8a5300]",
      )}
    >
      {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      was #{from}
    </span>
  );
}

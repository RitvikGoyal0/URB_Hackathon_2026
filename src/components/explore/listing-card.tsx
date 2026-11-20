"use client";

import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, Ban, Bath, BedDouble, Bookmark, BookmarkCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { averageCommute } from "@/lib/engine";
import type { Listing, MemberProfile, RankedResult } from "@/lib/types";
import { ScoreRing } from "@/components/shared/score-ring";
import { ListingPhoto } from "@/components/shared/listing-photo";
import { blockerLine, groupFitLabel, memberColor, money, rentBasisText } from "@/components/shared/format";
import { toggleSaved } from "@/components/shared/save-toast";

export function ringMembersFor(result: RankedResult, people: MemberProfile[]) {
  return result.perMember.map((pm, i) => {
    const idx = people.findIndex((p) => p.id === pm.memberId);
    const m = people[idx] ?? people[i];
    return { id: pm.memberId, name: m?.displayName ?? pm.memberId, hex: memberColor(m ?? {}, idx >= 0 ? idx : i).hex, score: pm.score };
  });
}

export function PriceLine({ listing, result, className, compact }: { listing: Listing; result: RankedResult; className?: string; compact?: boolean }) {
  const pp = result.perMember[0]?.perPersonRent ?? null;
  return (
    <div className={className}>
      {pp === null ? (
        <span className={cn("font-display font-semibold text-ink", compact ? "text-[17px]" : "text-[19px]")}>Pricing not verified</span>
      ) : (
        <span className={cn("font-display font-semibold text-ink tabular-nums", compact ? "text-[20px]" : "text-[22px]")}>
          {money(pp)}
          <span className="text-[13px] font-normal text-muted-foreground"> /person/mo</span>
        </span>
      )}
      {!compact && <span className="block text-[12px] text-muted-foreground">{rentBasisText(listing)}</span>}
    </div>
  );
}

/**
 * Photo-first Explore card (V3 §7.5): photo, name, rent, beds/baths, your average trip, the group
 * ring with a fit label, and one red line when something blocks the home. No paragraphs.
 */
export function ListingCard({
  result,
  listing,
  people,
  href,
  selected,
  saved,
  compareRank,
  onSelect,
}: {
  result: RankedResult;
  listing: Listing;
  people: MemberProfile[];
  href: string;
  selected: boolean;
  saved: boolean;
  /** baseline rank when Compare is on */
  compareRank?: number;
  onSelect: () => void;
}) {
  const blocked = result.eligibility === "blocked";
  const moved = compareRank !== undefined ? compareRank - result.rank : 0;
  const you = people.find((p) => p.isLiveUser) ?? people[0];
  const yours = result.perMember.find((pm) => pm.memberId === you?.id);
  const avg = yours ? averageCommute(yours.commutes) : null;
  const names = new Map(people.map((p) => [p.id, p.displayName]));
  const red = blockerLine(result.blockers, names);
  const solo = people.length <= 1;

  return (
    <article
      id={`card-${listing.id}`}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[24px] border bg-white transition-[border-color,box-shadow]",
        selected ? "border-ink shadow-[0_18px_44px_-30px_rgba(20,33,61,0.6)]" : "border-line hover:border-ink/30",
      )}
    >
      <div className="relative">
        <ListingPhoto src={listing.images[0]} alt={listing.name} className={cn("aspect-[16/9] w-full", blocked && "opacity-80")} sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 100vw" />
        <span className="absolute top-3 left-3 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-ink px-2 font-display text-[15px] font-semibold text-paper shadow">
          {result.rank}
        </span>
        {compareRank !== undefined && (
          <span className="absolute top-3 left-14">
            <MoveBadge moved={moved} from={compareRank} />
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSaved(listing.id, listing.name);
          }}
          className={cn(
            "absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-full border shadow-sm transition-colors focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none",
            saved ? "border-teal bg-teal-soft text-teal" : "border-white bg-white/95 text-charcoal hover:border-ink/30",
          )}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${listing.name} from saved homes` : `Save ${listing.name}`}
        >
          {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[16.5px] leading-snug font-semibold text-ink">
              <Link href={href} className="after:absolute after:inset-0 after:z-0 focus-visible:outline-none" aria-describedby={`fit-${listing.id}`}>
                {listing.name}
              </Link>
            </h3>
            <PriceLine listing={listing} result={result} compact className="mt-1" />
          </div>
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <ScoreRing score={result.groupScore} members={ringMembersFor(result, people)} size={56} stroke={5} dimmed={blocked} />
            <span id={`fit-${listing.id}`} className={cn("text-[11.5px] font-semibold whitespace-nowrap", blocked ? "text-muted-foreground" : "text-ink")}>
              {groupFitLabel(result.groupScore)}
            </span>
          </div>
        </div>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-charcoal">
          <span className="inline-flex items-center gap-1">
            <BedDouble className="size-3.5" aria-hidden />
            {listing.bedrooms} bd
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="size-3.5" aria-hidden />
            {listing.bathrooms} ba
          </span>
          {avg?.minutes !== null && avg?.minutes !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {avg.estimated ? "~" : ""}
              {avg.minutes} min avg {solo ? "trip" : "for you"}
            </span>
          )}
        </p>

        {red && (
          <p className="flex items-start gap-1.5 text-[12.5px] leading-snug font-medium text-blocker">
            <Ban className="mt-px size-3.5 shrink-0" aria-hidden />
            {red}
          </p>
        )}

        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[13px] font-semibold text-teal group-hover:underline" aria-hidden>
          View details <ArrowRight className="size-3.5" />
        </span>
      </div>
    </article>
  );
}

function MoveBadge({ moved, from }: { moved: number; from: number }) {
  if (moved === 0)
    return <span className="inline-flex h-6 items-center rounded-full bg-white/95 px-2 text-[11.5px] font-medium text-muted-foreground shadow">was #{from}</span>;
  const up = moved > 0;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-[11.5px] font-semibold shadow",
        up ? "bg-teal-soft text-teal" : "bg-amber-soft text-[#8a5300]",
      )}
    >
      {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      was #{from}
    </span>
  );
}

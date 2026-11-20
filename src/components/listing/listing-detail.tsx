"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Bath, BedDouble, Bookmark, BookmarkCheck, Calculator, Check, ChevronDown, ExternalLink, MapPin, Quote } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LIVE_MEMBER_ID, destinations, getCommunity, getListing, getListingPhotos } from "@/lib/data";
import { SUBJECTIVE_FEATURES, explainListing } from "@/lib/engine";
import { exploreHref } from "@/lib/explore-query";
import { actions } from "@/lib/store";
import { useAllVotes, useGroup } from "@/hooks/use-group";
import type { FeatureKey, Listing, RankedResult } from "@/lib/types";
import { dedupeWarnings } from "@/components/shared/bits";
import { ScoreRing } from "@/components/shared/score-ring";
import { ScenarioBanner } from "@/components/shared/scenario-banner";
import { FEATURE_KEYS, FEATURE_LABEL, blockerLine, groupFitLabel, longDate } from "@/components/shared/format";
import { PriceLine, ringMembersFor } from "@/components/explore/listing-card";
import { Gallery } from "./gallery";
import { MemberRow } from "./member-row";
import { ScoreFormula } from "./score-formula";
import { VotePanel } from "./vote-panel";

function isHttp(url: string) {
  return /^https?:\/\//.test(url);
}

/** Things to confirm with the property before signing (shown under Sources). */
export function verificationNotes(l: Listing, groupSize: number): string[] {
  const out: string[] = [];
  out.push(
    l.maxOccupancy === undefined
      ? `Occupancy unverified: confirm ${groupSize} ${groupSize === 1 ? "person" : "people"} can legally live here.`
      : `Listed max occupancy ${l.maxOccupancy}; confirm the lease allows your group.`,
  );
  if (l.availability.status === "unknown") out.push("Availability not stated. Votes and scores never imply a unit is available.");
  else if (l.availability.status !== "available") out.push("Listed as unavailable.");
  else if (l.availability.date) out.push(`Listed available ${longDate(l.availability.date)}; confirm before you plan around it.`);
  if (l.rent.amount === null || l.rent.basis === "unknown") out.push("Rent not published. Affordability isn't scored until you get a quote.");
  if (l.rent.utilitiesIncluded === null) out.push("Not stated whether utilities are included.");
  else if (l.rent.utilitiesIncluded === false) out.push("Utilities not included; the per-person price excludes them.");
  if (l.privateBedrooms === null) out.push("Private bedrooms not stated.");
  return out;
}

/** At most 2 trade-offs: the main compromise, then the most useful group-level warning. */
function tradeOffs(result: RankedResult, compromise: string | null): string[] {
  const out: string[] = [];
  if (compromise) out.push(compromise.replace(/^Main drawback:\s*/i, ""));
  for (const w of dedupeWarnings(result.warnings)) {
    if (out.length >= 2) break;
    if (!w.memberId) out.push(w.message);
  }
  return out.slice(0, 2);
}

export function ListingDetail({ id }: { id: string }) {
  const listing = getListing(id);
  const g = useGroup();
  const votes = useAllVotes();
  const params = useSearchParams();
  const backHref = exploreHref(params.get("back"));
  const result = g.rankById.get(id);
  const community = listing ? getCommunity(listing.communityId) : undefined;
  const explanation = result && listing ? explainListing(result, listing, g.members, destinations) : null;

  if (!listing || !result) {
    // A home outside this lobby's bedroom count isn't ranked here (V3 §5.2).
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-ink">{listing ? `${listing.name} isn't ranked for this lobby.` : "We couldn't find that home."}</h1>
        {listing && g.lobby && (
          <p className="mt-2 text-[14px] text-muted-foreground">
            {g.lobby.name} looks at {g.lobby.targetSize}-bedroom homes; this one has {listing.bedrooms}. Switch to Solo search to see every size.
          </p>
        )}
        <Link href={backHref} className={cn(buttonVariants(), "mt-6 rounded-full")}>
          Back to All Homes
        </Link>
      </main>
    );
  }

  const saved = g.data.watchlist.some((w) => w.listingId === id);
  const myVote = [...g.data.votes].reverse().find((v) => v.listingId === id && v.memberId === LIVE_MEMBER_ID)?.value;
  const officialUrl = community?.officialUrl ?? (isHttp(listing.provenance.sourceUrl) ? listing.provenance.sourceUrl : undefined);
  const names = new Map(g.people.map((p) => [p.id, p.displayName]));
  const red = blockerLine(result.blockers, names);
  const blocked = result.eligibility === "blocked";
  const oneLine = explanation?.summary.split(/(?<=\.)\s/)[0] ?? "";
  const pros = (explanation?.strengths ?? []).slice(0, 2);
  const cons = tradeOffs(result, explanation?.compromise ?? null);
  const groupSize = result.perMember.length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6">
      <Link href={backHref} scroll={false} className="inline-flex min-h-10 items-center gap-1.5 text-[13.5px] font-medium text-charcoal hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Back to All Homes
      </Link>

      <ScenarioBanner changedInputs={g.changedInputs} className="mt-2" />

      {/* 1. Top */}
      <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <Gallery photos={getListingPhotos(listing.id)} name={listing.name} />

        <div className="min-w-0">
          <p className="text-[13px] font-medium text-teal">
            #{result.rank} of {g.ranking.length} · {g.contextLabel}
          </p>
          <h1 className="mt-1 text-[1.9rem] leading-[1.12] font-semibold text-ink sm:text-[2.3rem]">{listing.name}</h1>
          {community && (
            <p className="mt-2 flex items-start gap-1.5 text-[14px] text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {community.address}
            </p>
          )}
          <PriceLine listing={listing} result={result} className="mt-4" />
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-charcoal">
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-4" aria-hidden /> {listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms} bed`}
            </span>
            <span className="inline-flex items-center gap-1">
              <Bath className="size-4" aria-hidden /> {listing.bathrooms} bath
            </span>
            {listing.sqft && <span>{listing.sqft.toLocaleString()} sq ft</span>}
          </p>

          <div className="mt-5 flex items-center gap-4 rounded-[22px] border border-line bg-white p-4">
            <ScoreRing score={result.groupScore} members={ringMembersFor(result, g.people)} size={84} stroke={8} dimmed={blocked} />
            <div className="min-w-0">
              <p className="text-[12.5px] text-muted-foreground">Your group match</p>
              <p className="text-[17px] font-semibold text-ink">{groupFitLabel(result.groupScore)}</p>
              {oneLine && <p className="mt-0.5 text-[13px] leading-snug text-charcoal">{oneLine}</p>}
            </div>
          </div>
          {red && (
            <p className="mt-3 flex items-start gap-1.5 rounded-2xl bg-blocker-soft px-3.5 py-2.5 text-[13px] font-medium text-blocker">
              <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden /> {red}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className={cn("h-11 rounded-full", saved && "border-teal bg-teal-soft text-teal")}
              onClick={() => {
                const now = actions.toggleWatch(id);
                toast(now ? `Saved ${listing.name}` : `Removed ${listing.name} from saved homes`);
              }}
              aria-pressed={saved}
            >
              {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
              {saved ? "Saved" : "Save"}
            </Button>
            {officialUrl ? (
              <a href={officialUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants(), "h-11 rounded-full")}>
                Official listing <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : (
              <span className="inline-flex h-11 items-center justify-center rounded-full border border-dashed border-line px-3 text-center text-[12px] text-muted-foreground">
                No official page
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-3xl gap-8">
        {/* 2. Each roommate */}
        <section aria-labelledby="mates-h">
          <h2 id="mates-h" className="text-[1.35rem] font-semibold text-ink">
            {groupSize > 1 ? "How it works for each roommate" : "How it works for you"}
          </h2>
          <div className="mt-3 grid gap-3">
            {result.perMember.map((pm, i) => {
              const idx = g.people.findIndex((p) => p.id === pm.memberId);
              const m = g.people[idx] ?? g.people[i];
              return (
                <MemberRow
                  key={pm.memberId}
                  member={m}
                  index={idx >= 0 ? idx : i}
                  pm={pm}
                  blockers={result.blockers.filter((b) => b.memberId === pm.memberId)}
                  warnings={dedupeWarnings(result.warnings.filter((w) => w.memberId === pm.memberId))}
                  isLeast={result.leastSatisfiedMemberId === pm.memberId && groupSize > 1}
                />
              );
            })}
          </div>
        </section>

        {/* 3. Key amenities */}
        <Amenities listing={listing} />

        {/* 4. Pros and trade-offs */}
        {(pros.length > 0 || cons.length > 0) && (
          <section className="grid gap-3 sm:grid-cols-2" aria-label="Pros and trade-offs">
            <div className="rounded-[22px] border border-line bg-white p-4">
              <h2 className="text-[15px] font-semibold text-ink">What works</h2>
              {pros.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted-foreground">No standout strengths for this group.</p>
              ) : (
                <ul className="mt-2 grid gap-1.5">
                  {pros.map((s, i) => (
                    <li key={i} className="flex gap-2 text-[13.5px] leading-snug text-charcoal">
                      <Check className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden /> {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-[22px] border border-line bg-white p-4">
              <h2 className="text-[15px] font-semibold text-ink">Things your group may need to compromise on</h2>
              {cons.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted-foreground">Nothing major.</p>
              ) : (
                <ul className="mt-2 grid gap-1.5">
                  {cons.map((s, i) => (
                    <li key={i} className="flex gap-2 text-[13.5px] leading-snug text-charcoal">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden /> {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* 5. Group vote */}
        <VotePanel listingId={id} listingName={listing.name} people={g.people} votes={votes} myVote={myVote} liveMemberId={LIVE_MEMBER_ID} />

        {/* 6. Sources & resources */}
        <section className="rounded-[22px] border border-line bg-white p-5" aria-labelledby="src-h">
          <h2 id="src-h" className="text-[18px] font-semibold text-ink">
            Sources &amp; resources
          </h2>
          <ul className="mt-3 grid gap-2 text-[13px]">
            {[
              ["Listing", listing.provenance],
              ["Rent", listing.rent.provenance],
              ["Availability", listing.availability.provenance],
            ].map(([what, p]) => {
              const prov = p as Listing["provenance"];
              return (
                <li key={what as string} className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-paper px-3.5 py-2.5">
                  <span>
                    <span className="font-medium text-ink">{what as string}:</span> {prov.sourceName}
                    <span className="text-muted-foreground"> · observed {longDate(prov.observedAt)}</span>
                  </span>
                  {isHttp(prov.sourceUrl) && (
                    <a href={prov.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-teal hover:underline">
                      Source <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <h3 className="mt-4 text-[13px] font-semibold text-ink">Confirm with the property</h3>
          <ul className="mt-1.5 grid gap-1 text-[13px] leading-relaxed text-charcoal">
            {verificationNotes(listing, groupSize).map((n) => (
              <li key={n} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-ink/40" aria-hidden />
                {n}
              </li>
            ))}
          </ul>
        </section>

        {/* 7. How we score (collapsed; the only place math appears) */}
        <details className="group/s rounded-[22px] border border-line bg-white p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[16px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <Calculator className="size-4.5 text-teal" aria-hidden /> How we score
            </span>
            <ChevronDown className="size-4 transition-transform group-open/s:rotate-180" aria-hidden />
          </summary>
          <ScoreFormula result={result} listing={listing} people={g.people} bare />
        </details>
      </div>
    </main>
  );
}

const SUBJECTIVE = new Set<FeatureKey>(SUBJECTIVE_FEATURES);

function Amenities({ listing }: { listing: Listing }) {
  const yes = FEATURE_KEYS.filter((k) => listing.features[k] === true);
  const no = FEATURE_KEYS.filter((k) => listing.features[k] === false);
  const unknown = FEATURE_KEYS.filter((k) => listing.features[k] === null);
  const quoted = yes.filter((k) => SUBJECTIVE.has(k) && listing.featureEvidence?.[k]);
  return (
    <section className="rounded-[22px] border border-line bg-white p-5" aria-labelledby="amen-h">
      <h2 id="amen-h" className="text-[18px] font-semibold text-ink">
        Key amenities
      </h2>
      {yes.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {yes.map((k) => (
            <li key={k} className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2.5 py-1 text-[12.5px] font-medium text-teal">
              <Check className="size-3.5" aria-hidden /> {FEATURE_LABEL[k]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground">The listing doesn&apos;t confirm any of the amenities we track.</p>
      )}
      {quoted.map((k) => {
        const ev = listing.featureEvidence![k]!;
        return (
          <blockquote key={k} className="mt-3 flex gap-2 rounded-2xl bg-paper px-3.5 py-2.5 text-[13px] leading-snug text-charcoal">
            <Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="font-medium text-ink">{FEATURE_LABEL[k]}:</span> &ldquo;{ev.quote}&rdquo;{" "}
              {isHttp(ev.sourceUrl) && (
                <a href={ev.sourceUrl} target="_blank" rel="noreferrer" className="text-[12px] font-medium text-teal hover:underline">
                  source
                </a>
              )}
            </span>
          </blockquote>
        );
      })}
      {no.length > 0 && (
        <p className="mt-3 text-[13px] text-charcoal">
          <span className="font-medium text-ink">Not available:</span> {no.map((k) => FEATURE_LABEL[k]).join(", ")}
        </p>
      )}
      {unknown.length > 0 && (
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          <span className="font-medium">Not listed:</span> {unknown.map((k) => FEATURE_LABEL[k]).join(", ")}
        </p>
      )}
    </section>
  );
}

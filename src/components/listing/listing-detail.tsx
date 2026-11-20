"use client";
import { ScenarioBanner } from "@/components/shared/scenario-banner";

import Link from "next/link";
import { ArrowLeft, Bookmark, BookmarkCheck, Check, CircleHelp, ExternalLink, FlaskConical, MapPin, ThumbsDown, ThumbsUp, Minus } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LIVE_MEMBER_ID, destinations, getCommunity, getListing, listings as allListings } from "@/lib/data";
import { consensus, explainListing } from "@/lib/engine";
import { actions } from "@/lib/store";
import { useAllVotes, useGroup } from "@/hooks/use-group";
import type { FeatureKey, Listing, VoteValue } from "@/lib/types";
import { Chips, CoverageBadge, ListingSourceBadge, MemberAvatar } from "@/components/shared/bits";
import { ScoreRing } from "@/components/shared/score-ring";
import { RepresentativeImage } from "@/components/shared/representative-image";
import { FEATURE_KEYS, FEATURE_LABEL, HOUSING_LABEL, VOTE_LABEL, fmtScore, longDate, money, shortDate } from "@/components/shared/format";
import { PriceLine, ringMembersFor } from "@/components/explore/listing-card";
import { ConsensusBadge } from "@/components/watchlist/consensus-badge";
import { MemberRow } from "./member-row";
import { ScoreFormula } from "./score-formula";

function isHttp(url: string) {
  return /^https?:\/\//.test(url);
}

function triState(v: boolean | null) {
  return v === true ? "Yes" : v === false ? "No" : "Unknown";
}

function unverifiedItems(l: Listing): { label: string; detail: string }[] {
  const out: { label: string; detail: string }[] = [];
  out.push(
    l.maxOccupancy === undefined
      ? { label: "Occupancy", detail: "Not stated. Confirm with the property that 4 people can legally live here." }
      : { label: "Occupancy", detail: `Listed max occupancy ${l.maxOccupancy}. Still confirm the lease allows it.` },
  );
  if (l.availability.status !== "available")
    out.push({ label: "Availability", detail: l.availability.status === "unknown" ? "Not stated. Votes and scores never imply a unit is available." : "Listed as unavailable." });
  else if (l.availability.date) out.push({ label: "Availability", detail: `Listed available ${longDate(l.availability.date)}; confirm before you plan around it.` });
  if (l.rent.utilitiesIncluded === null) out.push({ label: "Utilities", detail: "Not stated whether utilities are included." });
  else if (l.rent.utilitiesIncluded === false) out.push({ label: "Utilities", detail: "Not included. Budget extra; the per-person price excludes them." });
  if (l.rent.amount === null || l.rent.basis === "unknown") out.push({ label: "Rent", detail: "Not published. Affordability isn't scored until you get a quote." });
  if (l.privateBedrooms === null) out.push({ label: "Private bedrooms", detail: "Not stated." });
  const unknownFeatures = FEATURE_KEYS.filter((k) => l.features[k] === null);
  if (unknownFeatures.length)
    out.push({ label: "Amenities not mentioned", detail: unknownFeatures.map((k) => FEATURE_LABEL[k]).join(", ") + ". Counted as not met." });
  return out;
}

const VOTE_ICON: Record<VoteValue, typeof ThumbsUp> = { interested: ThumbsUp, maybe: Minus, pass: ThumbsDown };

export function ListingDetail({ id }: { id: string }) {
  const listing = getListing(id);
  const g = useGroup();
  const votes = useAllVotes();
  const result = g.rankById.get(id);
  const community = listing ? getCommunity(listing.communityId) : undefined;
  const explanation = result && listing ? explainListing(result, listing, g.members, destinations) : null;

  if (!listing || !result) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-ink">We couldn&apos;t find that home.</h1>
        <Link href="/explore" className={cn(buttonVariants(), "mt-6 rounded-full")}>
          Back to Explore
        </Link>
      </main>
    );
  }

  const saved = g.state.watchlist.some((w) => w.listingId === id);
  const myVote = [...g.state.votes].reverse().find((v) => v.listingId === id && v.memberId === LIVE_MEMBER_ID)?.value;
  const latestVotes = new Map<string, VoteValue>();
  for (const v of [...votes].sort((a, b) => a.at.localeCompare(b.at))) if (v.listingId === id) latestVotes.set(v.memberId, v.value);
  const label = consensus(votes, id, g.people.length);
  const demo = listing.sourceType === "synthetic";
  const officialUrl = community?.officialUrl ?? (isHttp(listing.provenance.sourceUrl) ? listing.provenance.sourceUrl : undefined);
  const groupBlockers = result.blockers.filter((b) => !b.memberId);
  const groupWarnings = result.warnings.filter((w) => !w.memberId);

  function vote(v: VoteValue) {
    if (myVote === v) {
      actions.clearVote(id);
      toast(`Vote cleared for ${listing!.name}`);
    } else {
      actions.castVote(id, v);
      toast.success(`Voted ${VOTE_LABEL[v]} on ${listing!.name}`);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-16 sm:px-6">
      <Link href="/explore" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-charcoal hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All homes
      </Link>

      <ScenarioBanner changedInputs={g.changedInputs} className="mt-4" />

      {demo && (
        <div className="demo-stripes mt-4 flex items-center gap-2 rounded-2xl border border-[#e6b866] px-4 py-3 text-[13.5px] font-semibold text-[#7a4700]">
          <FlaskConical className="size-4" aria-hidden />
          DEMO LISTING — fictional. Created to fill a gap in real listings; the address and details do not describe a real building.
        </div>
      )}

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center rounded-full bg-ink px-3 font-display text-[13px] font-semibold text-paper">
              #{result.rank} of {allListings.length}
            </span>
            <ListingSourceBadge listing={listing} size="md" />
            <CoverageBadge coverage={result.coverage} />
          </div>
          <h1 className="mt-3 text-[2rem] leading-[1.1] font-semibold text-ink sm:text-[2.6rem]">{listing.name}</h1>
          {community && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[14px] text-muted-foreground">
              <MapPin className="size-4" aria-hidden /> {community.address}
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr] sm:grid-rows-2">
            <RepresentativeImage housingType={listing.housingType} className="col-span-2 h-56 rounded-[24px] sm:col-span-1 sm:row-span-2 sm:h-80" seed={result.rank} />
            <RepresentativeImage housingType={listing.housingType} scene="kitchen" className="h-32 rounded-[20px] sm:h-auto" seed={result.rank + 1} />
            <RepresentativeImage housingType={listing.housingType} scene="bedroom" className="h-32 rounded-[20px] sm:h-auto" seed={result.rank + 2} />
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">Illustrations only. We don&apos;t copy listing photos; see the official page for real images.</p>

          {/* Fit summary */}
          <section className="mt-8 rounded-[26px] bg-ink p-5 text-paper sm:p-6">
            <h2 className="text-[19px] font-semibold">How this home fits your group</h2>
            {explanation?.summary && <p className="mt-2 text-[15px] leading-relaxed text-paper/90">{explanation.summary}</p>}
            {explanation && explanation.strengths.length > 0 && (
              <ul className="mt-3 grid gap-1.5">
                {explanation.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[14px] text-paper/90">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald" aria-hidden /> {s}
                  </li>
                ))}
              </ul>
            )}
            {explanation?.compromise && (
              <p className="mt-3 rounded-2xl bg-amber/25 px-3.5 py-2.5 text-[14px] text-[#ffe2b0]">{explanation.compromise}</p>
            )}
            {(groupBlockers.length > 0 || result.blockers.length > 0) && (
              <div className="mt-3 rounded-2xl bg-white p-3">
                <Chips result={result} max={8} />
              </div>
            )}
          </section>

          <h2 className="mt-10 text-[1.5rem] font-semibold text-ink">Each roommate&apos;s view</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {result.perMember.map((pm, i) => {
              const idx = g.people.findIndex((p) => p.id === pm.memberId);
              const m = g.people[idx] ?? g.people[i];
              return (
                <MemberRow
                  key={pm.memberId}
                  member={m}
                  index={idx >= 0 ? idx : i}
                  pm={pm}
                  lines={explanation?.perMember[pm.memberId] ?? []}
                  blockers={result.blockers.filter((b) => b.memberId === pm.memberId)}
                  warnings={result.warnings.filter((w) => w.memberId === pm.memberId)}
                  isLeast={result.leastSatisfiedMemberId === pm.memberId && result.perMember.length > 1}
                />
              );
            })}
          </div>

          <div className="mt-8">
            <ScoreFormula result={result} listing={listing} people={g.people} />
          </div>

          {/* Facts */}
          <section className="mt-8 rounded-[26px] border border-line bg-white p-5 sm:p-6">
            <h2 className="text-[19px] font-semibold text-ink">The facts</h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-3">
              {[
                ["Type", HOUSING_LABEL[listing.housingType]],
                ["Bedrooms", String(listing.bedrooms)],
                ["Bathrooms", String(listing.bathrooms)],
                ["Size", listing.sqft ? `${listing.sqft.toLocaleString()} sq ft` : "Unknown"],
                ["Private bedrooms", triState(listing.privateBedrooms)],
                ["Max occupancy", listing.maxOccupancy !== undefined ? String(listing.maxOccupancy) : "Unknown"],
                ["Utilities included", triState(listing.rent.utilitiesIncluded)],
                ["Availability", listing.availability.status === "available" ? (listing.availability.date ? `From ${shortDate(listing.availability.date)}` : "Available") : listing.availability.status === "unknown" ? "Unknown" : "Unavailable"],
                ["Rent as listed", listing.rent.amount === null ? "Not published" : `${money(listing.rent.amount)}${listing.rent.amountMax ? `–${money(listing.rent.amountMax)}` : ""} ${listing.rent.basis.replace("_", " ")}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className={cn("font-medium", v === "Unknown" || v === "Not published" ? "text-muted-foreground" : "text-ink")}>{v}</dd>
                </div>
              ))}
            </dl>
            {listing.rent.fees.length > 0 && (
              <div className="mt-4">
                <h3 className="text-[13px] font-medium text-muted-foreground">Required fees</h3>
                <ul className="mt-1 grid gap-1 text-[13px] text-charcoal">
                  {listing.rent.fees.map((f, i) => (
                    <li key={i}>
                      {f.label}: {money(f.monthly)}/mo {f.scope === "per_unit" ? "per unit (split)" : "per person"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <h3 className="mt-5 text-[13px] font-medium text-muted-foreground">Features</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {FEATURE_KEYS.map((k: FeatureKey) => {
                const v = listing.features[k];
                return (
                  <li
                    key={k}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[12.5px]",
                      v === true && "bg-teal-soft text-teal",
                      v === false && "bg-secondary text-muted-foreground line-through decoration-1",
                      v === null && "border border-dashed border-[#b8bcc4] text-muted-foreground",
                    )}
                  >
                    {FEATURE_LABEL[k]}
                    {v === null && " ?"}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Provenance */}
          <section className="mt-6 rounded-[26px] border border-line bg-white p-5 sm:p-6">
            <h2 className="text-[19px] font-semibold text-ink">Where this information comes from</h2>
            <ul className="mt-3 grid gap-2 text-[13.5px]">
              {[
                ["Listing", listing.provenance],
                ["Rent", listing.rent.provenance],
                ["Availability", listing.availability.provenance],
                ...(community ? ([["Community", community.provenance]] as const) : []),
              ].map(([what, p]) => {
                const prov = p as Listing["provenance"];
                return (
                  <li key={what as string} className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-paper px-3.5 py-2.5">
                    <span>
                      <span className="font-medium text-ink">{what as string}:</span> {prov.sourceName}
                      <span className="text-muted-foreground">
                        {" "}
                        · {prov.status.replaceAll("_", " ")} · observed {longDate(prov.observedAt)}
                      </span>
                      {prov.note && <span className="block text-[12.5px] text-muted-foreground">{prov.note}</span>}
                    </span>
                    {isHttp(prov.sourceUrl) ? (
                      <a href={prov.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-teal hover:underline">
                        Source <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <span className="text-[12.5px] text-muted-foreground">No external source (fictional)</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Sticky decision rail */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-[28px] border border-line bg-white p-5">
            <div className="flex items-center gap-4">
              <ScoreRing score={result.groupScore} members={ringMembersFor(result, g.people)} size={104} stroke={9} dimmed={result.eligibility === "blocked"} />
              <div>
                <p className="text-[12.5px] text-muted-foreground">Group score</p>
                <p className="text-[13.5px] leading-snug text-charcoal">
                  Average fit <span className="font-semibold text-ink">{fmtScore(result.mean)}</span>
                  <br />
                  Least-satisfied member <span className="font-semibold text-ink">{fmtScore(result.min)}</span>
                </p>
                {result.eligibility === "blocked" && <p className="mt-1 text-[12px] font-medium text-blocker">Blocked for this group</p>}
              </div>
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <PriceLine listing={listing} result={result} />
            </div>

            <div className="mt-5">
              <p className="text-[13px] font-medium text-ink">Your vote</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["interested", "maybe", "pass"] as VoteValue[]).map((v) => {
                  const Icon = VOTE_ICON[v];
                  const on = myVote === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={on}
                      onClick={() => vote(v)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-[12.5px] font-medium transition-colors focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none",
                        on
                          ? v === "interested"
                            ? "border-teal bg-teal text-white"
                            : v === "pass"
                              ? "border-blocker bg-blocker text-white"
                              : "border-ink bg-ink text-paper"
                          : "border-line bg-white text-charcoal hover:border-ink/30",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {VOTE_LABEL[v]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-paper p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] text-muted-foreground">Group consensus</span>
                <ConsensusBadge label={label} />
              </div>
              <ul className="mt-2.5 grid grid-cols-4 gap-1">
                {g.people.map((m, i) => {
                  const v = latestVotes.get(m.id);
                  return (
                    <li key={m.id} className="flex flex-col items-center gap-1 text-center">
                      <MemberAvatar member={m} index={i} size="sm" />
                      <span className="text-[11px] leading-tight text-charcoal">{m.displayName}</span>
                      <span className={cn("text-[10.5px]", v ? "font-medium text-ink" : "text-muted-foreground")}>{v ? VOTE_LABEL[v] : "No vote"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className={cn("h-10 rounded-full", saved && "border-teal bg-teal-soft text-teal")}
                onClick={() => {
                  const now = actions.toggleWatch(id);
                  toast(now ? "Saved to your watchlist" : "Removed from your watchlist");
                }}
                aria-pressed={saved}
              >
                {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
                {saved ? "Saved" : "Save"}
              </Button>
              {officialUrl ? (
                <a href={officialUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants(), "h-10 rounded-full")}>
                  Official page <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : (
                <span className="inline-flex h-10 items-center justify-center rounded-full border border-dashed border-line px-3 text-center text-[11.5px] leading-tight text-muted-foreground">
                  Fictional: no official page
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-dashed border-amber/50 bg-amber-soft/40 p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <CircleHelp className="size-4 text-amber" aria-hidden /> Unverified information
            </h2>
            <ul className="mt-3 grid gap-2 text-[13px] leading-relaxed text-charcoal">
              {unverifiedItems(listing).map((u) => (
                <li key={u.label}>
                  <span className="font-medium text-ink">{u.label}:</span> {u.detail}
                </li>
              ))}
            </ul>
            {groupWarnings.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {groupWarnings.map((w, i) => (
                  <span key={i} className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] text-[#8a5300]">
                    {w.message}
                  </span>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

"use client";
import { ScenarioBanner } from "@/components/shared/scenario-banner";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, HelpCircle, Minus, Plus, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LIVE_MEMBER_ID, getListing } from "@/lib/data";
import { consensus } from "@/lib/engine";
import { actions, useHydrated } from "@/lib/store";
import { useAllVotes, useGroup } from "@/hooks/use-group";
import type { Vote, VoteValue, WatchItem } from "@/lib/types";
import { ListingSourceBadge, MemberAvatar, PageIntro } from "@/components/shared/bits";
import { ScoreRing } from "@/components/shared/score-ring";
import { VOTE_LABEL, fmtScore, relativeTime } from "@/components/shared/format";
import { PriceLine, ringMembersFor } from "@/components/explore/listing-card";
import { ConsensusBadge } from "./consensus-badge";

const VOTE_ICON: Record<VoteValue, typeof ThumbsUp> = { interested: ThumbsUp, maybe: Minus, pass: ThumbsDown };
const VOTE_TONE: Record<VoteValue, string> = {
  interested: "bg-teal-soft text-teal",
  maybe: "bg-secondary text-charcoal",
  pass: "bg-blocker-soft text-blocker",
};

function WatchCard({ item, votes }: { item: WatchItem; votes: Vote[] }) {
  const g = useGroup();
  const hydrated = useHydrated();
  const [q, setQ] = useState("");
  const listing = getListing(item.listingId);
  const result = g.rankById.get(item.listingId);
  if (!listing || !result) return null;
  const mine = votes.filter((v) => v.listingId === listing.id);
  const latest = new Map<string, Vote>();
  for (const v of mine) {
    const prev = latest.get(v.memberId);
    if (!prev || prev.at <= v.at) latest.set(v.memberId, v);
  }
  const label = consensus(votes, listing.id, g.people.length);
  const lastAt = [item.at, ...mine.map((v) => v.at)].sort().at(-1)!;
  const lastVote = [...latest.values()].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  const myVote = latest.get(LIVE_MEMBER_ID)?.value;
  const nameOf = (id: string) => g.people.find((p) => p.id === id)?.displayName ?? id;

  return (
    <article className="rounded-[28px] border border-line bg-white">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <ScoreRing score={result.groupScore} members={ringMembersFor(result, g.people)} size={72} dimmed={result.eligibility === "blocked"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[19px] leading-snug font-semibold text-ink">
                <Link href={`/listing/${listing.id}`} className="hover:underline">
                  {listing.name}
                </Link>
              </h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Rank #{result.rank} · Average fit {fmtScore(result.mean)} · Least-satisfied member {fmtScore(result.min)}
              </p>
            </div>
            <ConsensusBadge label={label} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ListingSourceBadge listing={listing} />
            {result.eligibility === "blocked" && (
              <span className="rounded-full bg-blocker-soft px-2.5 py-0.5 text-[11.5px] font-medium text-blocker">{result.blockers[0]?.message ?? "Blocked"}</span>
            )}
          </div>
          <PriceLine listing={listing} result={result} className="mt-3" />
        </div>
      </div>

      <div className="grid gap-4 border-t border-line p-5 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h3 className="text-[13px] font-medium text-muted-foreground">Votes</h3>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {g.people.map((m, i) => {
              const v = latest.get(m.id)?.value;
              const Icon = v ? VOTE_ICON[v] : null;
              return (
                <li key={m.id} className="flex items-center gap-2 rounded-2xl bg-paper px-2.5 py-2">
                  <MemberAvatar member={m} index={i} size="sm" />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[12.5px] text-charcoal">{m.displayName}</span>
                    {v && Icon ? (
                      <span className={cn("mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 text-[11.5px] font-medium", VOTE_TONE[v])}>
                        <Icon className="size-3" aria-hidden /> {VOTE_LABEL[v]}
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-muted-foreground">Not yet</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-ink">Your vote:</span>
            {(["interested", "maybe", "pass"] as VoteValue[]).map((v) => {
              const Icon = VOTE_ICON[v];
              const on = myVote === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    if (on) actions.clearVote(listing.id);
                    else {
                      actions.castVote(listing.id, v);
                      toast.success(`Voted ${VOTE_LABEL[v]} on ${listing.name}`);
                    }
                  }}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none",
                    on ? "border-ink bg-ink text-paper" : "border-line bg-white text-charcoal hover:border-ink/30",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {VOTE_LABEL[v]}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Last activity {hydrated ? relativeTime(lastAt) : ""}
            {lastVote ? ` · ${nameOf(lastVote.memberId)} voted ${VOTE_LABEL[lastVote.value].toLowerCase()}` : ""}. Votes show interest only; they
            don&apos;t mean the home is available.
          </p>
        </div>

        <div>
          <h3 className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <HelpCircle className="size-3.5" aria-hidden /> Open questions for the landlord
          </h3>
          <ul className="mt-2 grid gap-1.5">
            {item.openQuestions.length === 0 && <li className="text-[13px] text-muted-foreground">None. Add one below.</li>}
            {item.openQuestions.map((oq, i) => (
              <li key={i} className="flex items-start justify-between gap-2 rounded-xl bg-paper px-3 py-2 text-[13px] text-charcoal">
                <span>{oq}</span>
                <button
                  type="button"
                  onClick={() => actions.removeOpenQuestion(listing.id, i)}
                  className="mt-0.5 shrink-0 rounded-full text-muted-foreground hover:text-ink"
                  aria-label={`Mark answered: ${oq}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              actions.addOpenQuestion(listing.id, q);
              setQ("");
            }}
          >
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a question" aria-label="Add a question" className="h-9 rounded-full bg-white" />
            <Button type="submit" size="icon" variant="outline" className="size-9 shrink-0 rounded-full" disabled={!q.trim()} aria-label="Add question">
              <Plus />
            </Button>
          </form>
        </div>
      </div>
      <div className="flex justify-end border-t border-line px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-muted-foreground"
          onClick={() => {
            actions.toggleWatch(listing.id);
            toast(`Removed ${listing.name} from your watchlist`);
          }}
        >
          <Trash2 aria-hidden /> Remove from watchlist
        </Button>
      </div>
    </article>
  );
}

export function WatchlistView() {
  const { data, rankById, changedInputs } = useGroup();
  const votes = useAllVotes();
  const items = [...data.watchlist].sort((a, b) => (rankById.get(a.listingId)?.rank ?? 999) - (rankById.get(b.listingId)?.rank ?? 999));
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <PageIntro title="Watchlist">
        Homes your group saved. Everyone votes, and the consensus updates as votes come in.
      </PageIntro>
      <ScenarioBanner changedInputs={changedInputs} className="mb-4" />
      {items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-line bg-white p-10 text-center">
          <Bookmark className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-semibold text-ink">Nothing saved yet.</p>
          <p className="mt-1 text-[14px] text-muted-foreground">Save homes from Explore to compare and vote on them here.</p>
          <Link href="/explore" className={cn(buttonVariants(), "mt-5 rounded-full px-5")}>
            Explore homes
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((w) => (
            <WatchCard key={w.listingId} item={w} votes={votes} />
          ))}
        </div>
      )}
    </main>
  );
}

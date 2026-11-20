"use client";

import { Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { consensus } from "@/lib/engine";
import { actions } from "@/lib/store";
import { latestVotesFor, voteTally } from "@/lib/votes";
import type { MemberProfile, Vote, VoteValue } from "@/lib/types";
import { MemberAvatar } from "@/components/shared/bits";
import { VOTE_LABEL } from "@/components/shared/format";
import { ConsensusBadge } from "@/components/watchlist/consensus-badge";

const VOTE_ICON: Record<VoteValue, typeof ThumbsUp> = { interested: ThumbsUp, maybe: Minus, pass: ThumbsDown };
const VOTE_ON: Record<VoteValue, string> = {
  interested: "border-teal bg-teal text-white",
  maybe: "border-ink bg-ink text-paper",
  pass: "border-blocker bg-blocker text-white",
};
const ORDER: VoteValue[] = ["interested", "maybe", "pass"];

/**
 * Group vote (V3 §7.7): three equal buttons that stack full-width in a narrow box (container query,
 * never truncated), then "N of M interested", the avatar row and the tally. Votes belong to the
 * active lobby only and are shown apart from the match score.
 */
export function VotePanel({
  listingId,
  listingName,
  people,
  votes,
  myVote,
  liveMemberId,
}: {
  listingId: string;
  listingName: string;
  people: MemberProfile[];
  votes: Vote[];
  myVote: VoteValue | undefined;
  liveMemberId: string;
}) {
  const latest = latestVotesFor(votes, listingId);
  if (myVote) latest.set(liveMemberId, myVote);
  const tally = voteTally(latest, people);
  const label = consensus(votes, listingId, people.length);

  function vote(v: VoteValue) {
    if (myVote === v) {
      actions.clearVote(listingId);
      toast(`Vote cleared for ${listingName}`);
    } else {
      actions.castVote(listingId, v);
      toast.success(`Voted ${VOTE_LABEL[v]} on ${listingName}`);
    }
  }

  return (
    <section className="@container rounded-[24px] border border-line bg-white p-5" aria-labelledby="vote-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="vote-h" className="text-[18px] font-semibold text-ink">
          Group vote
        </h2>
        <ConsensusBadge label={label} />
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">Your vote</p>
      <div className="mt-2 grid grid-cols-1 gap-2 @min-[21rem]:grid-cols-3" role="group" aria-label="Your vote">
        {ORDER.map((v) => {
          const Icon = VOTE_ICON[v];
          const on = myVote === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => vote(v)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none",
                on ? VOTE_ON[v] : "border-line bg-white text-charcoal hover:border-ink/30",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-max">{VOTE_LABEL[v]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl bg-paper p-3.5">
        <p className="text-[15px] text-ink">
          <span className="font-semibold">
            {tally.interested} of {people.length} interested
          </span>
        </p>
        <ul className="mt-2.5 flex flex-wrap gap-3">
          {people.map((m, i) => {
            const v = latest.get(m.id);
            return (
              <li key={m.id} className="flex w-16 flex-col items-center gap-1 text-center">
                <MemberAvatar member={m} index={i} size="sm" />
                <span className="w-full truncate text-[11px] leading-tight text-charcoal" title={m.displayName}>
                  {m.displayName}
                </span>
                <span className={cn("text-[10.5px]", v ? "font-medium text-ink" : "text-muted-foreground")}>{v ? VOTE_LABEL[v] : "Waiting"}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2.5 text-[12.5px] text-muted-foreground">{tally.text}</p>
        {tally.waiting > 0 && people.length > 1 && <p className="mt-0.5 text-[12px] text-muted-foreground">Waiting for roommates&apos; votes</p>}
      </div>
    </section>
  );
}

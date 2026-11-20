"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Bookmark, Plus, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDestination, getListing, getStudent } from "@/lib/data";
import { readiness } from "@/lib/onboarding";
import { DIMS } from "@/lib/types";
import { useGroup } from "@/hooks/use-group";
import { MemberAvatar } from "@/components/shared/bits";
import { ScoreRing } from "@/components/shared/score-ring";
import { DIM_LABEL, fmtScore, money } from "@/components/shared/format";
import { useCreateLobby } from "@/components/lobby/create-lobby";
import { joinedCount, useFindHomesTogether } from "@/components/lobby/lobby-page-view";
import { SuggestedRoommates } from "@/components/roommates/suggested-roommates";

function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[26px] border border-line bg-white p-5 sm:p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const linkCls = "inline-flex items-center gap-1 text-[13.5px] font-medium text-teal hover:underline";

export function DashboardView() {
  const g = useGroup();
  const { live, lobby, ranking, data, state } = g;
  const { openCreateLobby } = useCreateLobby();
  const findHomes = useFindHomesTogether();
  const onboarded = state.liveProfile !== null;

  const ready = Math.round(readiness(live) * 100);
  const mainPlace = [...live.destinations].sort((a, b) => b.visitsPerWeek * b.importance - a.visitsPerWeek * a.importance)[0];
  const topDims = [...DIMS].sort((a, b) => live.weights[b] - live.weights[a]).slice(0, 2);
  const top3 = ranking.filter((r) => r.eligibility !== "blocked").slice(0, 3);
  const homes = top3.length > 0 ? top3 : ranking.slice(0, 3);
  const recentSaved = [...data.watchlist].sort((a, b) => b.at.localeCompare(a.at))[0];
  const recentListing = recentSaved ? getListing(recentSaved.listingId) : undefined;
  const interested = recentSaved ? data.votes.filter((v) => v.listingId === recentSaved.listingId && v.value === "interested").length : 0;
  const groupSize = lobby?.targetSize ?? 1;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[13px] font-medium text-teal">University of Michigan</p>
      <h1 className="mt-1 text-[2.2rem] leading-tight font-semibold text-ink sm:text-[2.8rem]">Welcome back, {live.displayName}</h1>
      <p className="mt-2 text-[15.5px] text-charcoal">Find a home that fits your life.</p>
      {!onboarded && (
        <p className="mt-3 text-[14px] text-muted-foreground">
          You&apos;re seeing an example profile.{" "}
          <Link href="/onboarding" className="font-medium text-teal hover:underline">
            Make it yours
          </Link>
        </p>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Panel
          title="Your housing group"
          action={
            lobby ? (
              <Link href={`/lobbies/${lobby.id}`} className={linkCls}>
                View lobby <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ) : null
          }
        >
          {lobby ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-2xl font-semibold text-ink">{lobby.name}</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <MemberAvatar member={live} index={0} size="sm" />
                    {lobby.members.map((m, i) => {
                      const p = getStudent(m.memberId);
                      return p ? <MemberAvatar key={m.memberId} member={p} index={i + 1} size="sm" className={m.status === "invited" ? "opacity-45" : undefined} /> : null;
                    })}
                  </div>
                  <span className="text-[14px] text-charcoal">
                    {joinedCount(lobby)} of {lobby.targetSize} joined
                  </span>
                </div>
              </div>
              <Button className="h-11 rounded-full px-5" onClick={() => findHomes(lobby)}>
                Find Homes Together <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-xl font-semibold text-ink">Create your housing group</p>
                <p className="mt-1 text-[14px] text-muted-foreground">Invite friends, then rank homes for everyone at once.</p>
              </div>
              <Button className="h-11 rounded-full px-5" onClick={() => openCreateLobby()}>
                <Plus className="size-4" aria-hidden /> Create a Lobby
              </Button>
            </div>
          )}
        </Panel>

        <Panel
          title="Your profile"
          action={
            <Link href={onboarded ? "/profile" : "/onboarding"} className={linkCls}>
              Edit profile
            </Link>
          }
        >
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-teal" style={{ width: `${Math.max(6, ready)}%` }} />
            </div>
            <span className="text-[13px] font-medium text-ink tabular-nums">{ready}% complete</span>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-[13.5px]">
            <div>
              <dt className="text-muted-foreground">Budget</dt>
              <dd className="mt-0.5 font-semibold text-ink">{money(live.budgetMax)}/mo</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Main campus</dt>
              <dd className="mt-0.5 font-semibold text-ink">{mainPlace ? (getDestination(mainPlace.destinationId)?.shortName ?? "—") : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cares most about</dt>
              <dd className="mt-0.5 font-semibold text-ink">{topDims.map((d) => DIM_LABEL[d]).join(", ")}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title={lobby ? `Recommended for ${lobby.name}` : "Recommended for you"}
        action={
          <Link href="/explore" className={linkCls}>
            Explore all homes <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      >
        {homes.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">No {groupSize}-bedroom homes in the catalog yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {homes.map((r) => {
              const l = getListing(r.listingId)!;
              const rent = r.perMember[0]?.perPersonRent ?? null;
              return (
                <Link key={r.listingId} href={`/listing/${r.listingId}`} className="flex items-center gap-4 rounded-2xl border border-line p-4 transition-colors hover:border-ink/25">
                  <ScoreRing score={r.groupScore} size={56} stroke={6} dimmed={r.eligibility === "blocked"} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-ink">{l.name}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {rent === null ? "Pricing not verified" : `${money(rent)}/person`} · {l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bd`}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Suggested roommates"
          action={
            <Link href="/roommates" className={linkCls}>
              Discover roommates <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          <SuggestedRoommates limit={3} compact />
        </Panel>
        <Panel
          title="Saved homes"
          action={
            <Link href="/watchlist" className={linkCls}>
              Open saved
            </Link>
          }
        >
          {recentListing ? (
            <div>
              <p className="text-[13px] text-muted-foreground">
                {data.watchlist.length} saved · most recent
              </p>
              <Link href={`/listing/${recentListing.id}`} className="mt-2 flex items-center gap-3 rounded-2xl bg-paper px-4 py-3 hover:bg-secondary">
                <Bookmark className="size-4 text-teal" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-medium text-ink">{recentListing.name}</span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {interested} of {groupSize} interested
                  </span>
                </span>
              </Link>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
              <Sparkles className="size-4" aria-hidden /> Save homes from Explore to compare and vote.
            </p>
          )}
          <p className="mt-3 text-[12px] text-muted-foreground">Best match right now: {homes[0] ? `${getListing(homes[0].listingId)?.name} (${fmtScore(homes[0].groupScore)})` : "—"}</p>
        </Panel>
      </div>
      <div className="mt-8">
        <Link href="/resources" className={cn(buttonVariants({ variant: "ghost" }), "rounded-full text-charcoal")}>
          Renting resources for U-M students
        </Link>
      </div>
    </main>
  );
}

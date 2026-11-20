"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Heart, Lock, Pencil, Scale, Shuffle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getDestination, getListing } from "@/lib/data";
import { readiness, unconfirmedCount } from "@/lib/onboarding";
import { actions } from "@/lib/store";
import { useGroup } from "@/hooks/use-group";
import type { MemberProfile } from "@/lib/types";
import { MemberAvatar } from "@/components/shared/bits";
import { MODE_LABEL, budgetBucket, fmtScore, memberColor, money } from "@/components/shared/format";
import { deriveInsights } from "./insights";

function GroupName({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  if (editing) {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          actions.setGroupName(draft);
          setEditing(false);
        }}
      >
        <label htmlFor="group-name" className="sr-only">
          Group name
        </label>
        <Input
          id="group-name"
          autoFocus
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          className="h-14 max-w-md rounded-2xl bg-white font-display text-[1.8rem] font-semibold"
        />
        <button type="submit" className={cn(buttonVariants(), "h-11 rounded-full px-5")}>
          <Check className="size-4" aria-hidden /> Save name
        </button>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-[2.4rem] leading-[1.05] font-semibold text-ink sm:text-[3.2rem]">{name}</h1>
      <button
        type="button"
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[13px] font-medium text-charcoal hover:border-ink/30"
      >
        <Pencil className="size-3.5" aria-hidden /> Rename
      </button>
    </div>
  );
}

function MemberCard({ m, index, onboarded, isBinding }: { m: MemberProfile; index: number; onboarded: boolean; isBinding: boolean }) {
  const ready = readiness(m);
  const pending = unconfirmedCount(m);
  const c = memberColor(m, index);
  const isLive = m.isLiveUser;
  return (
    <article className="relative flex flex-col rounded-[26px] border border-line bg-white p-5">
      <div className="flex items-start gap-3">
        <MemberAvatar member={m} index={index} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-ink">{m.displayName}</h2>
            {isLive && <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", c.soft, c.text)}>You</span>}
          </div>
          <p className="truncate text-[13px] text-muted-foreground">{m.program ?? "Student"}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-muted-foreground">Profile readiness</span>
          <span className="font-medium text-ink">
            {isLive && !onboarded ? "Demo profile" : ready >= 1 ? "Ready" : `${pending} to confirm`}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className={cn("h-full rounded-full", ready >= 1 ? "bg-teal" : "bg-amber")} style={{ width: `${Math.max(8, ready * 100)}%` }} />
        </div>
      </div>

      <dl className="mt-4 grid gap-2.5 text-[13.5px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Budget</dt>
          <dd className="text-right font-medium text-ink">
            {isLive ? money(m.budgetMax) : budgetBucket(m.budgetMax)}
            {m.budgetIsHardCap && <span className="ml-1 text-[12px] font-normal text-blocker">hard cap</span>}
            {isBinding && <span className="block text-[11.5px] font-normal text-amber">sets the group limit</span>}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Gets around</dt>
          <dd className="font-medium text-ink">{MODE_LABEL[m.travelMode]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Key places</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {m.destinations.length === 0 && <span className="text-[12.5px] text-muted-foreground">None yet</span>}
            {m.destinations.map((d) => (
              <span key={d.destinationId} className="rounded-full bg-secondary px-2.5 py-0.5 text-[12px] text-charcoal">
                {getDestination(d.destinationId)?.shortName ?? d.destinationId}
                {isLive && <span className="text-muted-foreground"> · {d.visitsPerWeek}×/wk</span>}
              </span>
            ))}
          </dd>
        </div>
      </dl>
      {isLive && (
        <Link href={onboarded ? "/profile" : "/onboarding"} className="mt-4 text-[13px] font-medium text-teal underline-offset-4 hover:underline">
          {onboarded ? "Edit my profile" : "Make this profile yours"}
        </Link>
      )}
      {!isLive && <p className="mt-4 text-[11.5px] text-muted-foreground">Roommates see budget ranges and places, not exact schedules.</p>}
    </article>
  );
}

function InsightList({ title, icon: Icon, items, tone }: { title: string; icon: typeof Heart; items: string[]; tone: "teal" | "amber" | "ink" }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-[26px] border border-line bg-white p-5">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink">
        <span
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full",
            tone === "teal" && "bg-teal-soft text-teal",
            tone === "amber" && "bg-amber-soft text-amber",
            tone === "ink" && "bg-ink text-paper",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        {title}
      </h2>
      <ul className="mt-3 grid gap-2">
        {items.map((s) => (
          <li key={s} className="rounded-2xl bg-paper px-3.5 py-2.5 text-[14px] leading-snug text-charcoal">
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LobbyView() {
  const { state, people, baseMembers, ranking } = useGroup();
  const insights = deriveInsights(baseMembers);
  const top = ranking.find((r) => r.eligibility !== "blocked") ?? ranking[0];
  const topListing = top ? getListing(top.listingId) : undefined;
  const onboarded = state.liveProfile !== null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[13px] font-medium text-teal">Your group · University of Michigan</p>
          <div className="mt-2">
            <GroupName key={state.groupName} name={state.groupName} />
          </div>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Four people, four different weeks. Here&apos;s where you line up and where someone will have to compromise.
          </p>
        </div>
        <Link href="/explore" className={cn(buttonVariants(), "h-12 self-start rounded-full px-6 text-[15px] lg:self-auto")}>
          Find Homes Together <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {people.map((m, i) => (
          <MemberCard key={m.id} m={m} index={i} onboarded={onboarded} isBinding={insights.bindingMemberId === m.id} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <InsightList title="Shared priorities" icon={Heart} items={insights.shared} tone="teal" />
        <InsightList title="Differences" icon={Shuffle} items={insights.differences} tone="amber" />
        <InsightList title="Non-negotiables" icon={Lock} items={insights.nonNegotiables} tone="ink" />
      </div>

      {top && topListing && (
        <Link
          href={`/listing/${topListing.id}`}
          className="mt-6 flex flex-col gap-3 rounded-[26px] bg-ink p-6 text-paper transition-colors hover:bg-[#1b2b4d] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <Scale className="size-5 text-emerald" aria-hidden />
            <div>
              <p className="text-[13px] text-paper/70">Best fit for the whole group right now</p>
              <p className="font-display text-xl font-semibold">{topListing.name}</p>
            </div>
          </div>
          <p className="text-[14px] text-paper/80">
            Average fit {fmtScore(top.mean)} · Least-satisfied member {fmtScore(top.min)}
          </p>
        </Link>
      )}
    </main>
  );
}

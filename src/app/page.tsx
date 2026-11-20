import Link from "next/link";
import { ArrowRight, MessageSquareText, ListChecks, Users, SlidersHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CampusCard } from "@/components/campus/campus-card";
import { ScoreRing } from "@/components/shared/score-ring";
import { MemberAvatar, ListingSourceBadge } from "@/components/shared/bits";
import { ListingPhoto } from "@/components/shared/listing-photo";
import { fmtScore, groupFitLabel, memberColor, money } from "@/components/shared/format";
import { cn } from "@/lib/utils";
import { TAGLINE } from "@/components/shared/brand";
import { commuteMatrix, defaultLivePersona, destinations, friends, getListing, getStudent, listings, universities } from "@/lib/data";
import { filterForLobby, rankListings } from "@/lib/engine";

const STEPS = [
  {
    icon: MessageSquareText,
    title: "Describe your week",
    body: "Write it the way you'd tell a friend: where you go, how you get there, what you can spend.",
  },
  {
    icon: ListChecks,
    title: "Confirm what we read",
    body: "Every detail we pull out shows the words it came from. Only what you confirm is used for scoring.",
  },
  {
    icon: Users,
    title: "Line up with your group",
    body: "See shared priorities, the deal-breakers, and whose budget sets the limit.",
  },
  {
    icon: SlidersHorizontal,
    title: "Compare, test, vote",
    body: "Every home scored for each of you. Move a budget and watch the ranking change, then vote together.",
  },
];

export default function Home() {
  // Example 4-person lobby: Maya, her friends Jordan and Sam, and Riley (her closest roommate match).
  const riley = getStudent("member_d");
  const members = [defaultLivePersona, ...friends, ...(riley ? [riley] : [])];
  const ranked = rankListings(filterForLobby(listings, members.length), members, commuteMatrix, destinations, { groupSize: members.length });
  const top = ranked[0];
  const topListing = top ? getListing(top.listingId) : undefined;
  const ringMembers = top
    ? top.perMember.map((pm, i) => {
        const m = members.find((x) => x.id === pm.memberId) ?? members[i];
        return { id: pm.memberId, name: m.displayName, hex: memberColor(m, i).hex, score: pm.score };
      })
    : [];

  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="paper-grain pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-20 lg:pb-24">
          <div>
            <h1 className="max-w-[16ch] text-[3.1rem] leading-[0.98] font-semibold tracking-[-0.035em] text-ink sm:text-[4.4rem]">
              {/* One phrase per line: "Good places." / "Better company." */}
              {TAGLINE.split(/(?<=\.) /).map((phrase) => (
                <span key={phrase} className="block">
                  {phrase}
                </span>
              ))}
            </h1>
            <p className="mt-6 max-w-[50ch] text-[17px] leading-relaxed text-charcoal/85">
              Listing sites match you on rent and bedrooms. Roommates fall out over everything else: noise, late-night guests,
              who cooks and who never does. Rentezvous matches you on how you actually live, then scores every Ann Arbor home
              against each person&apos;s week, so your group sees who&apos;s compromising and decides together.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/campus" className={cn(buttonVariants(), "h-12 rounded-full px-6 text-[15px]")}>
                Find My Fit
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/explore?mode=haven"
                className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-full border-ink/15 bg-white px-6 text-[15px]")}
              >
                Explore Haven Communities
              </Link>
            </div>
          </div>

          {top && topListing && (
            <Link
              href={`/listing/${topListing.id}`}
              className="group relative block rounded-[30px] border border-line bg-white p-3 shadow-[0_30px_80px_-50px_rgba(20,33,61,0.55)] transition-transform hover:-translate-y-0.5"
            >
              <ListingPhoto src={topListing.images[0]} alt={topListing.name} className="h-44 rounded-[22px] sm:h-52" />
              <div className="px-3 pt-4 pb-2">
                <p className="text-[12.5px] font-medium text-teal">Top match for an example group of {members.length}</p>
                <div className="mt-1.5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-xl leading-snug font-semibold text-ink">{topListing.name}</h2>
                    <div className="mt-2">
                      <ListingSourceBadge listing={topListing} />
                    </div>
                  </div>
                  <ScoreRing score={top.groupScore} members={ringMembers} size={78} />
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  {top.perMember.map((pm, i) => {
                    const m = members.find((x) => x.id === pm.memberId) ?? members[i];
                    return (
                      <li key={pm.memberId} className="flex items-center gap-2 rounded-2xl bg-secondary/70 px-2.5 py-2">
                        <MemberAvatar member={m} index={i} size="sm" />
                        <span className="min-w-0 leading-tight">
                          <span className="block truncate text-[12.5px] text-charcoal">{m.displayName}</span>
                          <span className="font-display text-[15px] font-semibold text-ink tabular-nums">{fmtScore(pm.score)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl bg-teal-soft px-4 py-3">
                  <span className="text-[14px] font-semibold text-ink">
                    {groupFitLabel(top.groupScore)} for all {members.length} of you
                  </span>
                  {top.perMember[0]?.perPersonRent != null && (
                    <span className="text-[13px] text-charcoal/80">
                      <span className="font-display text-[20px] font-semibold text-ink tabular-nums">{money(top.perMember[0].perPersonRent)}</span> per person
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-[1.9rem] font-semibold text-ink">How it works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-[24px] bg-paper p-6">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-paper">
                    {i + 1}
                  </span>
                  <s.icon className="size-5 text-teal" aria-hidden />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-[1.9rem] font-semibold text-ink">Pick your campus</h2>
            <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">
              Four markets from one registry. Michigan is live today; the others are on the way.
            </p>
          </div>
          <Link href="/campus" className="text-[14px] font-medium text-teal underline-offset-4 hover:underline">
            See all campuses
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {universities.map((u) => (
            <CampusCard key={u.id} university={u} compact />
          ))}
        </div>
      </section>
    </main>
  );
}

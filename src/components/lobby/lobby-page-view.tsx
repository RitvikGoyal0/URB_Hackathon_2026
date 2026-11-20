"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Clock, Heart, Lock, LogOut, Search, Shuffle, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { friends, getStudent, LIVE_MEMBER_ID } from "@/lib/data";
import { effectiveProfile } from "@/lib/onboarding";
import { actions, lobbyHeadcount, selectLiveProfile, useAppState } from "@/lib/store";
import type { Lobby, MemberProfile } from "@/lib/types";
import { MemberAvatar } from "@/components/shared/bits";
import { GroupName, InsightList, MemberCard } from "./lobby-view";
import { deriveInsights } from "./insights";
import { InviteLink } from "./invite-link";

export function joinedCount(lobby: Lobby) {
  return 1 + lobby.members.filter((m) => m.status === "joined" && m.memberId !== LIVE_MEMBER_ID).length;
}

/** "Find Homes Together": make this lobby active, then go to Explore. Never fails silently. */
export function useFindHomesTogether() {
  const router = useRouter();
  return (lobby: Lobby) => {
    actions.setActiveLobby(lobby.id);
    if (joinedCount(lobby) === 1) toast.message("Ranking for you alone until friends join.");
    router.push("/explore");
  };
}

export function LobbyPageView({ id }: { id: string }) {
  const state = useAppState();
  const lobby = state.lobbies.find((l) => l.id === id);
  const live = selectLiveProfile(state);
  const findHomes = useFindHomesTogether();
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();

  if (!lobby) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 pt-20 text-center">
        <h1 className="font-display text-2xl text-ink">This lobby isn&apos;t here</h1>
        <p className="mt-2 text-[14.5px] text-charcoal">Lobbies live in this browser. It may have been left or reset.</p>
        <Link href="/dashboard" className={cn(buttonVariants(), "mt-6 rounded-full px-5")}>
          Go to dashboard
        </Link>
      </main>
    );
  }

  const roommates = lobby.members
    .map((m) => ({ m, p: getStudent(m.memberId) }))
    .filter((x): x is { m: Lobby["members"][number]; p: MemberProfile } => !!x.p);
  const joined = roommates.filter((x) => x.m.status === "joined").map((x) => x.p);
  const full = lobbyHeadcount(lobby) >= lobby.targetSize;
  const insights = deriveInsights([effectiveProfile(live), ...joined]);
  const isActive = state.activeLobbyId === lobby.id;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[13px] font-medium text-teal">
            University of Michigan{lobby.moveIn ? ` · Move-in ${lobby.moveIn}` : ""}
            {isActive ? " · Active group" : ""}
          </p>
          <div className="mt-2">
            <GroupName key={lobby.name} name={lobby.name} lobbyId={lobby.id} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex -space-x-2">
              <MemberAvatar member={live} index={0} size="sm" />
              {roommates.map((x, i) => (
                <MemberAvatar key={x.p.id} member={x.p} index={i + 1} size="sm" className={x.m.status === "invited" ? "opacity-45" : undefined} />
              ))}
            </div>
            <p className="text-[14px] text-charcoal">
              <span className="font-semibold text-ink">
                {joinedCount(lobby)} of {lobby.targetSize}
              </span>{" "}
              joined · looking at {lobby.targetSize}-bedroom homes
            </p>
          </div>
        </div>
        <Button className="h-12 self-start rounded-full px-6 text-[15px] lg:self-auto" onClick={() => findHomes(lobby)}>
          Find Homes Together <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MemberCard m={live} index={0} onboarded={state.liveProfile !== null} isBinding={insights.bindingMemberId === live.id} />
        {roommates.map((x, i) =>
          x.m.status === "joined" ? (
            <div key={x.p.id} className="relative">
              <MemberCard m={x.p} index={i + 1} onboarded isBinding={insights.bindingMemberId === x.p.id} />
              <RemoveButton lobby={lobby} member={x.p} />
            </div>
          ) : (
            <PendingCard key={x.p.id} lobby={lobby} member={x.p} index={i + 1} />
          ),
        )}
        {Array.from({ length: Math.max(0, lobby.targetSize - lobbyHeadcount(lobby)) }).map((_, i) => (
          <div key={`open-${i}`} className="flex min-h-40 flex-col items-center justify-center rounded-[26px] border border-dashed border-line p-5 text-center">
            <UserPlus className="size-5 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-[13.5px] text-muted-foreground">Open spot</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="min-w-0 rounded-[26px] border border-line bg-white p-5">
          <h2 className="text-[17px] font-semibold text-ink">Invite friends</h2>
          {full && <p className="mt-1 text-[13px] font-medium text-amber">Lobby is full</p>}
          <InviteLink lobby={lobby} />
          <ul className="mt-3 grid gap-2">
            {friends.map((f, i) => {
              const member = lobby.members.find((m) => m.memberId === f.id);
              return (
                <li key={f.id} className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3.5 py-2.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <MemberAvatar member={f} index={i + 1} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium text-ink">{f.displayName}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">{f.program ?? "Student"}</span>
                    </span>
                  </span>
                  {member ? (
                    <span className={cn("text-[13px] font-medium", member.status === "joined" ? "text-teal" : "text-amber")}>
                      {member.status === "joined" ? "Joined" : "Invited · pending"}
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" className="rounded-full" disabled={full} onClick={() => actions.invite(lobby.id, f.id)}>
                      Invite
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <Link href="/roommates" className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-teal hover:underline">
            <Search className="size-4" aria-hidden /> Discover roommates
          </Link>
        </section>
        {joined.length > 0 ? (
          <InsightList title="Shared priorities" icon={Heart} items={insights.shared} tone="teal" />
        ) : (
          <section className="rounded-[26px] border border-line bg-white p-5">
            <h2 className="text-[17px] font-semibold text-ink">Shared priorities</h2>
            <p className="mt-2 text-[14px] text-muted-foreground">Appears once a roommate joins.</p>
          </section>
        )}
      </div>
      {joined.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <InsightList title="Differences" icon={Shuffle} items={insights.differences} tone="amber" />
          <InsightList title="Non-negotiables" icon={Lock} items={insights.nonNegotiables} tone="ink" />
        </div>
      )}

      <div className="mt-10 border-t border-line pt-6">
        <Button variant="ghost" className="rounded-full text-blocker hover:text-blocker" onClick={() => setLeaving(true)}>
          <LogOut className="size-4" aria-hidden /> Leave lobby
        </Button>
      </div>
      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent className="rounded-[24px] p-6">
          <DialogHeader>
            <DialogTitle>Leave {lobby.name}?</DialogTitle>
            <DialogDescription>You&apos;re its only real member, so the lobby, its saved homes and votes are deleted from this browser.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaving(false)}>
              Stay
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                actions.leaveLobby(lobby.id);
                setLeaving(false);
                toast.success(`Left ${lobby.name}`);
                router.push("/dashboard");
              }}
            >
              Leave and delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function PendingCard({ lobby, member, index }: { lobby: Lobby; member: MemberProfile; index: number }) {
  return (
    <article className="relative flex min-h-40 flex-col items-center justify-center rounded-[26px] border border-line bg-white p-5 text-center">
      <MemberAvatar member={member} index={index} size="lg" className="opacity-60" />
      <p className="mt-3 text-[16px] font-semibold text-ink">{member.displayName}</p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-amber">
        <Clock className="size-3.5 animate-pulse" aria-hidden /> Invited · pending
      </p>
      <RemoveButton lobby={lobby} member={member} />
    </article>
  );
}

function RemoveButton({ lobby, member }: { lobby: Lobby; member: MemberProfile }) {
  return (
    <button
      type="button"
      className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-ink"
      aria-label={`Remove ${member.displayName} from ${lobby.name}`}
      onClick={() => actions.removeMember(lobby.id, member.id)}
    >
      <X className="size-4" />
    </button>
  );
}

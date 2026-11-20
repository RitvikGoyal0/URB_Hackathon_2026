"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Check, Clock, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FRIEND_IDS, getDestination, students } from "@/lib/data";
import { rankRoommates } from "@/lib/engine";
import { effectiveProfile } from "@/lib/onboarding";
import { actions, lobbyHeadcount, selectActiveLobby, selectLiveProfile, useAppState } from "@/lib/store";
import { MemberAvatar } from "@/components/shared/bits";
import { useCreateLobby } from "@/components/lobby/create-lobby";
import { ContactPopover } from "./contact-popover";

const placeName = (id: string) => getDestination(id)?.shortName;

/** Students you might get along with (V3 §7.5): actively looking for a roommate, and not friends. */
export function useSuggestions() {
  const state = useAppState();
  const live = selectLiveProfile(state);
  const lobby = selectActiveLobby(state);
  const inLobby = useMemo(() => new Set(lobby?.members.map((m) => m.memberId) ?? []), [lobby]);
  const ranked = useMemo(
    () => rankRoommates(effectiveProfile(live), students.filter((s) => s.roommateStatus === "looking" && !FRIEND_IDS.includes(s.id)), placeName),
    [live],
  );
  return { ranked, lobby, inLobby };
}

export function SuggestedRoommates({ limit = 6, compact = false }: { limit?: number; compact?: boolean }) {
  const { ranked, lobby, inLobby } = useSuggestions();
  const { openCreateLobby } = useCreateLobby();
  const list = ranked.filter((r) => !compact || !inLobby.has(r.member.id)).slice(0, limit);
  const full = lobby ? lobbyHeadcount(lobby) >= lobby.targetSize : false;

  const invite = (id: string, name: string) => {
    if (!lobby) {
      openCreateLobby((lobbyId) => {
        actions.invite(lobbyId, id);
        toast.success(`Lobby created. ${name} invited.`);
      });
      return;
    }
    actions.invite(lobby.id, id);
    toast.success(`${name} invited to ${lobby.name}`);
  };

  if (list.length === 0) return <p className="text-[14px] text-muted-foreground">Everyone we&apos;d suggest is already in your lobby.</p>;

  return (
    <ul className={cn("grid gap-3", compact ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3")}>
      {list.map(({ member, compat }, i) => {
        const status = lobby?.members.find((m) => m.memberId === member.id)?.status;
        const first = i === 0 && ranked[0]?.member.id === member.id;
        return (
          <li key={member.id} className={cn("flex flex-col rounded-[22px] border bg-white p-4", first ? "border-teal/50" : "border-line")}>
            {first && !compact && (
              <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-teal-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-teal">
                <Sparkles className="size-3" aria-hidden /> Similar to your profile
              </span>
            )}
            <div className="flex items-center gap-3">
              <MemberAvatar member={member} index={i + 4} size={compact ? "sm" : "md"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">{member.displayName}</p>
                <p className="truncate text-[12.5px] text-muted-foreground">{member.major ?? member.program ?? "Student"}</p>
              </div>
              <p className="shrink-0 text-right text-[12.5px] leading-tight">
                <span className="block font-semibold text-ink">{compat.label}</span>
                <span className="text-muted-foreground tabular-nums">{compat.score}</span>
              </p>
            </div>
            {!compact && (
              <ul className="mt-3 grid gap-1.5">
                {compat.reasons.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-[13.5px] text-charcoal">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-teal" aria-hidden /> {r}
                  </li>
                ))}
              </ul>
            )}
            {compact && compat.reasons[0] && <p className="mt-2 truncate text-[12.5px] text-charcoal">{compat.reasons[0]}</p>}
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
              {status === "joined" ? (
                <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-teal">
                  <Check className="size-3.5" aria-hidden /> Joined {lobby?.name}
                </p>
              ) : status === "invited" ? (
                <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-amber">
                  <Clock className="size-3.5 animate-pulse" aria-hidden /> Invited · pending
                </p>
              ) : (
                <Button size="sm" variant={first ? "default" : "outline"} className="rounded-full" disabled={full} onClick={() => invite(member.id, member.displayName)}>
                  <UserPlus className="size-3.5" aria-hidden /> {full ? "Lobby is full" : "Invite to lobby"}
                </Button>
              )}
              <ContactPopover member={member} compact={compact} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function RoommatesView() {
  const { lobby } = useSuggestions();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[13px] font-medium text-teal">{lobby ? `Inviting to ${lobby.name}` : "No lobby yet: inviting creates one"}</p>
      <h1 className="mt-1 text-[2rem] leading-tight font-semibold text-ink sm:text-[2.5rem]">Students you might get along with</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-charcoal">
        Matched on budget, where you spend your week, habits at home, priorities, must-haves, major and clubs. You only see ranges, never exact
        schedules. Students here are looking for roommates and chose to share how to reach them.
      </p>
      <div className="mt-8">
        <SuggestedRoommates limit={6} />
      </div>
      {lobby && (
        <Link href={`/lobbies/${lobby.id}`} className="mt-8 inline-block text-[14px] font-medium text-teal hover:underline">
          Back to {lobby.name}
        </Link>
      )}
    </main>
  );
}

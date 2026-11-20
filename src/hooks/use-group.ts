"use client";

import { useMemo } from "react";
import { commuteMatrix, destinations, getStudent, listings } from "@/lib/data";
import { filterForLobby, rankListings } from "@/lib/engine";
import { effectiveProfile } from "@/lib/onboarding";
import { joinedMemberIds, selectActiveData, selectActiveLobby, selectLiveProfile, useAppState } from "@/lib/store";
import type { Id, Listing, Lobby, LobbyData, MemberProfile, RankedResult } from "@/lib/types";

export interface GroupView {
  /** Live user as stored (with fieldMeta, unconfirmed values visible) */
  live: MemberProfile;
  /** Active lobby, or null for solo search */
  lobby: Lobby | null;
  /** Saved homes / votes / what-if for the active lobby (or solo) */
  data: LobbyData;
  /** Display members: live (as stored) + joined roommates */
  people: MemberProfile[];
  /** Engine inputs without the what-if scenario (unconfirmed AI fields neutralised) */
  baseMembers: MemberProfile[];
  /** Engine inputs with scenario budgets applied */
  members: MemberProfile[];
  /** Listings in view: exact bedroom match in a lobby, every size solo (V3 §5.2) */
  pool: Listing[];
  baseline: RankedResult[];
  ranking: RankedResult[];
  rankById: Map<Id, RankedResult>;
  baselineById: Map<Id, RankedResult>;
  hasScenario: boolean;
  changedInputs: string[];
  /** e.g. "Engineering House · 4 people" or "Solo search" */
  contextLabel: string;
}

export function applyScenario(members: MemberProfile[], budgets: Record<Id, number> | undefined): MemberProfile[] {
  if (!budgets) return members;
  return members.map((m) => (budgets[m.id] !== undefined && budgets[m.id] !== m.budgetMax ? { ...m, budgetMax: budgets[m.id] } : m));
}

/** Rank `pool` for the group. Lobby: capacity/space use the lobby size. Solo: each home assumed full. */
export function rankFor(pool: Listing[], members: MemberProfile[], lobby: Lobby | null): RankedResult[] {
  return rankListings(pool, members, commuteMatrix, destinations, { groupSize: lobby ? lobby.targetSize : "bedrooms" });
}

export function useGroup(): GroupView & { state: ReturnType<typeof useAppState> } {
  const state = useAppState();
  const live = selectLiveProfile(state);
  const lobby = selectActiveLobby(state);
  const data = selectActiveData(state);

  const joinedKey = joinedMemberIds(lobby).join(",");
  const roommates = useMemo(
    () => (joinedKey ? joinedKey.split(",") : []).map((id) => getStudent(id)).filter((m): m is MemberProfile => !!m),
    [joinedKey],
  );
  const people = useMemo(() => [live, ...roommates], [live, roommates]);
  const baseMembers = useMemo(() => [effectiveProfile(live), ...roommates], [live, roommates]);
  const members = useMemo(() => applyScenario(baseMembers, data.scenario?.budgets), [baseMembers, data.scenario]);

  const targetSize = lobby?.targetSize ?? null;
  const pool = useMemo(() => filterForLobby(listings, targetSize), [targetSize]);
  const baseline = useMemo(() => rankFor(pool, baseMembers, lobby), [pool, baseMembers, lobby]);
  const hasScenario = members.some((m, i) => m.budgetMax !== baseMembers[i].budgetMax);
  const ranking = useMemo(() => (hasScenario ? rankFor(pool, members, lobby) : baseline), [hasScenario, pool, members, lobby, baseline]);

  const rankById = useMemo(() => new Map(ranking.map((r) => [r.listingId, r])), [ranking]);
  const baselineById = useMemo(() => new Map(baseline.map((r) => [r.listingId, r])), [baseline]);
  const changedInputs = useMemo(
    () =>
      members
        .map((m, i) => ({ m, before: baseMembers[i].budgetMax }))
        .filter(({ m, before }) => m.budgetMax !== before)
        .map(({ m, before }) => `${m.displayName}'s budget $${before.toLocaleString()} → $${m.budgetMax.toLocaleString()}`),
    [members, baseMembers],
  );
  const contextLabel = lobby ? `Ranked for ${lobby.name} · ${lobby.targetSize} people` : "Solo search · any size, priced per room";

  return {
    state,
    live,
    lobby,
    data,
    people,
    baseMembers,
    members,
    pool,
    baseline,
    ranking,
    rankById,
    baselineById,
    hasScenario,
    changedInputs,
    contextLabel,
  };
}

/** The live user's votes in the active lobby (roommates' votes are not simulated). */
export function useAllVotes() {
  const state = useAppState();
  return useMemo(() => selectActiveData(state).votes, [state]);
}

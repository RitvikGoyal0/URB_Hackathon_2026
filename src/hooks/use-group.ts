"use client";

import { useMemo } from "react";
import { commuteMatrix, destinations, listings, seededRoommates } from "@/lib/data";
import { rankListings } from "@/lib/engine";
import { effectiveProfile } from "@/lib/onboarding";
import { selectAllVotes, selectLiveProfile, useAppState } from "@/lib/store";
import type { Id, MemberProfile, RankedResult } from "@/lib/types";

export interface GroupView {
  /** Live user as stored (with fieldMeta, unconfirmed values visible) */
  live: MemberProfile;
  /** Display members: live (as stored) + seeded roommates */
  people: MemberProfile[];
  /** Engine inputs without the what-if scenario (unconfirmed AI fields neutralised) */
  baseMembers: MemberProfile[];
  /** Engine inputs with scenario budgets applied */
  members: MemberProfile[];
  baseline: RankedResult[];
  ranking: RankedResult[];
  rankById: Map<Id, RankedResult>;
  baselineById: Map<Id, RankedResult>;
  hasScenario: boolean;
  changedInputs: string[];
}

export function applyScenario(members: MemberProfile[], budgets: Record<Id, number> | undefined): MemberProfile[] {
  if (!budgets) return members;
  return members.map((m) => (budgets[m.id] !== undefined && budgets[m.id] !== m.budgetMax ? { ...m, budgetMax: budgets[m.id] } : m));
}

export function useGroup(): GroupView & { state: ReturnType<typeof useAppState> } {
  const state = useAppState();
  const live = selectLiveProfile(state);
  const people = useMemo(() => [live, ...seededRoommates], [live]);
  const baseMembers = useMemo(() => [effectiveProfile(live), ...seededRoommates], [live]);
  const members = useMemo(() => applyScenario(baseMembers, state.scenario?.budgets), [baseMembers, state.scenario]);

  const baseline = useMemo(() => rankListings(listings, baseMembers, commuteMatrix, destinations), [baseMembers]);
  const hasScenario = members.some((m, i) => m.budgetMax !== baseMembers[i].budgetMax);
  const ranking = useMemo(
    () => (hasScenario ? rankListings(listings, members, commuteMatrix, destinations) : baseline),
    [hasScenario, members, baseline],
  );

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

  return { state, live, people, baseMembers, members, baseline, ranking, rankById, baselineById, hasScenario, changedInputs };
}

export function useAllVotes() {
  const state = useAppState();
  return useMemo(() => selectAllVotes(state), [state]);
}

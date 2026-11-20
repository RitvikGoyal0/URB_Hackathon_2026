/**
 * Client store over localStorage (spec §0 Persistence, §10 Privacy).
 *
 * - Shape is `AppState` from types.ts; hydration is validated with the `appState` Zod
 *   schema. Anything invalid (old version, hand-edited, corrupt JSON) resets to defaults.
 * - Every storage access is wrapped in try/catch (private windows, blocked storage).
 * - `useSyncExternalStore` keeps SSR/prerender on DEFAULT_STATE and switches to the
 *   stored state on the client without hydration mismatches.
 * - Seeded roommate votes are NOT stored: `allVotes()` merges `seedVotes` with the live
 *   user's votes at read time, so "Delete my profile" never deletes roommates' data.
 */
import { useSyncExternalStore } from "react";
import { appState as appStateSchema } from "@/lib/schemas";
import { LIVE_MEMBER_ID, DEFAULT_GROUP_NAME, defaultLivePersona, getListing, seedVotes } from "@/lib/data";
import type { AppState, Id, Listing, MemberProfile, Vote, VoteValue, WatchItem } from "@/lib/types";

const STORAGE_KEY = "htl:app-state:v1";

/** Open questions a group should ask before signing, derived only from unknown fields. */
export function defaultOpenQuestions(listing: Listing | undefined): string[] {
  if (!listing) return [];
  const q: string[] = [];
  if (listing.maxOccupancy === undefined) q.push("Confirm legal occupancy for 4 with the property.");
  if (listing.availability.status !== "available") q.push("Is it available for the lease start we need?");
  if (listing.rent.amount === null || listing.rent.basis === "unknown") q.push("What is the rent, and is it per unit or per bed?");
  if (listing.rent.utilitiesIncluded === null) q.push("Which utilities are included?");
  else if (listing.rent.utilitiesIncluded === false) q.push("What do utilities usually cost per month?");
  if (listing.features.inUnitLaundry === null) q.push("Does this layout have in-unit laundry?");
  return q;
}

function seedWatchlist(): WatchItem[] {
  const seen = new Map<Id, WatchItem>();
  for (const v of seedVotes) {
    if (seen.has(v.listingId) || !getListing(v.listingId)) continue;
    seen.set(v.listingId, {
      listingId: v.listingId,
      savedBy: v.memberId,
      at: v.at,
      openQuestions: defaultOpenQuestions(getListing(v.listingId)),
    });
  }
  return [...seen.values()];
}

export const DEFAULT_STATE: AppState = Object.freeze({
  version: 1,
  liveProfile: null,
  groupName: DEFAULT_GROUP_NAME,
  votes: [],
  watchlist: seedWatchlist(),
  scenario: null,
}) as AppState;

let cache: AppState | null = null;
const listeners = new Set<() => void>();

function readStorage(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = appStateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      window.localStorage.removeItem(STORAGE_KEY);
      return DEFAULT_STATE;
    }
    return parsed.data;
  } catch {
    return DEFAULT_STATE;
  }
}

function getSnapshot(): AppState {
  if (cache === null) cache = readStorage();
  return cache;
}

function getServerSnapshot(): AppState {
  return DEFAULT_STATE;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = readStorage();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function setState(update: (s: AppState) => AppState) {
  const next = update(getSnapshot());
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked — keep the in-memory state for this session */
  }
  listeners.forEach((l) => l());
}

// ---------- hooks ----------

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True once the client snapshot is in use (false during SSR/prerender + hydration). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
const noopSubscribe = () => () => {};

/** The live member (Student A). Falls back to the seeded default persona until onboarding. */
export function selectLiveProfile(s: AppState): MemberProfile {
  return s.liveProfile ?? defaultLivePersona;
}

/** Seed votes merged with the live user's votes. */
export function selectAllVotes(s: AppState): Vote[] {
  return [...seedVotes, ...s.votes];
}

// ---------- actions ----------

export const actions = {
  setLiveProfile(profile: MemberProfile) {
    setState((s) => ({ ...s, liveProfile: { ...profile, id: LIVE_MEMBER_ID, isLiveUser: true } }));
  },
  setGroupName(name: string) {
    setState((s) => ({ ...s, groupName: name.trim() || DEFAULT_GROUP_NAME }));
  },
  castVote(listingId: Id, value: VoteValue) {
    setState((s) => ({
      ...s,
      votes: [
        ...s.votes.filter((v) => !(v.listingId === listingId && v.memberId === LIVE_MEMBER_ID)),
        { memberId: LIVE_MEMBER_ID, listingId, value, at: new Date().toISOString() },
      ],
    }));
  },
  clearVote(listingId: Id) {
    setState((s) => ({
      ...s,
      votes: s.votes.filter((v) => !(v.listingId === listingId && v.memberId === LIVE_MEMBER_ID)),
    }));
  },
  toggleWatch(listingId: Id): boolean {
    let saved = false;
    setState((s) => {
      const exists = s.watchlist.some((w) => w.listingId === listingId);
      saved = !exists;
      return {
        ...s,
        watchlist: exists
          ? s.watchlist.filter((w) => w.listingId !== listingId)
          : [
              ...s.watchlist,
              {
                listingId,
                savedBy: LIVE_MEMBER_ID,
                at: new Date().toISOString(),
                openQuestions: defaultOpenQuestions(getListing(listingId)),
              },
            ],
      };
    });
    return saved;
  },
  addOpenQuestion(listingId: Id, question: string) {
    const q = question.trim();
    if (!q) return;
    setState((s) => ({
      ...s,
      watchlist: s.watchlist.map((w) => (w.listingId === listingId ? { ...w, openQuestions: [...w.openQuestions, q] } : w)),
    }));
  },
  removeOpenQuestion(listingId: Id, index: number) {
    setState((s) => ({
      ...s,
      watchlist: s.watchlist.map((w) =>
        w.listingId === listingId ? { ...w, openQuestions: w.openQuestions.filter((_, i) => i !== index) } : w,
      ),
    }));
  },
  setScenarioBudget(memberId: Id, budget: number) {
    setState((s) => ({
      ...s,
      scenario: { budgets: { ...(s.scenario?.budgets ?? {}), [memberId]: budget }, savedAt: new Date().toISOString() },
    }));
  },
  setScenarioBudgets(budgets: Record<Id, number>) {
    setState((s) => ({ ...s, scenario: { budgets: { ...budgets }, savedAt: new Date().toISOString() } }));
  },
  resetScenario() {
    setState((s) => ({ ...s, scenario: null }));
  },
  /** §10 "Delete my profile": removes everything this browser stored. */
  deleteProfile() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    cache = DEFAULT_STATE;
    listeners.forEach((l) => l());
  },
};

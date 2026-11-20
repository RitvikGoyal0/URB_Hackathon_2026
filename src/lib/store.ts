/**
 * Client store over localStorage (V3 §4.1, store v2).
 *
 * - Shape is `AppState` (version 2) from types.ts, validated with Zod on load. A v1 payload is
 *   migrated by keeping only `liveProfile`; anything else invalid resets to defaults.
 * - Lobbies own their saved homes, votes and what-if. Solo search has its own bucket (`solo`).
 * - Invites go "invited" → "joined" after `demo.inviteDelayMs`; `resolveInvites()` finishes any
 *   overdue invite (e.g. after a reload mid-timer), so nobody is stuck pending.
 * - Every storage access is wrapped in try/catch (private windows, blocked storage).
 * - `useSyncExternalStore` keeps SSR/prerender on DEFAULT_STATE and switches on the client.
 */
import { useSyncExternalStore } from "react";
import { appState as appStateSchema, appStateV1 } from "@/lib/schemas";
import { LIVE_MEMBER_ID, defaultLivePersona, getListing } from "@/lib/data";
import type { AppState, Id, Listing, Lobby, LobbyData, MemberProfile, Vote, VoteValue, WatchItem } from "@/lib/types";

const STORAGE_KEY = "htl:app-state:v1";
export const DEFAULT_INVITE_DELAY_MS = 3000;
export const MIN_LOBBY_SIZE = 2;
export const MAX_LOBBY_SIZE = 6;

/** Open questions a group should ask before signing, derived only from unknown fields. */
export function defaultOpenQuestions(listing: Listing | undefined): string[] {
  if (!listing) return [];
  const q: string[] = [];
  if (listing.maxOccupancy === undefined) q.push("Confirm legal occupancy for our group with the property.");
  if (listing.availability.status !== "available") q.push("Is it available for the lease start we need?");
  if (listing.rent.amount === null || listing.rent.basis === "unknown") q.push("What is the rent, and is it per unit or per bed?");
  if (listing.rent.utilitiesIncluded === null) q.push("Which utilities are included?");
  else if (listing.rent.utilitiesIncluded === false) q.push("What do utilities usually cost per month?");
  if (listing.features.inUnitLaundry === null) q.push("Does this layout have in-unit laundry?");
  return q;
}

const emptyData = (): LobbyData => ({ watchlist: [], votes: [], scenario: null });

/** What `unsave` removed, so Undo can put it back exactly. */
export interface Unsaved {
  item: WatchItem;
  vote: Vote | null;
}

const newWatchItem = (listingId: Id, at: string): WatchItem => ({
  listingId,
  savedBy: LIVE_MEMBER_ID,
  at,
  openQuestions: defaultOpenQuestions(getListing(listingId)),
});

/** Saving a home that's already saved is a no-op. */
function ensureSaved(d: LobbyData, listingId: Id, at: string): LobbyData {
  return d.watchlist.some((w) => w.listingId === listingId) ? d : { ...d, watchlist: [...d.watchlist, newWatchItem(listingId, at)] };
}

export const DEFAULT_STATE: AppState = Object.freeze({
  version: 2,
  liveProfile: null,
  lobbies: [],
  activeLobbyId: null,
  solo: emptyData(),
  demo: { inviteDelayMs: DEFAULT_INVITE_DELAY_MS },
}) as AppState;

/** Parse a stored payload: v2 as-is, v1 → v2 keeping only the profile, else defaults. */
export function hydrate(raw: unknown): AppState {
  const v2 = appStateSchema.safeParse(raw);
  if (v2.success) {
    const s = v2.data;
    // an active id that points nowhere falls back to solo
    return s.activeLobbyId && !s.lobbies.some((l) => l.id === s.activeLobbyId) ? { ...s, activeLobbyId: null } : s;
  }
  const v1 = appStateV1.safeParse(raw);
  if (v1.success) return { ...DEFAULT_STATE, solo: emptyData(), liveProfile: v1.data.liveProfile };
  return DEFAULT_STATE;
}

let cache: AppState | null = null;
const listeners = new Set<() => void>();

function readStorage(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return hydrate(JSON.parse(raw));
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
  const prev = getSnapshot();
  const next = update(prev);
  if (next === prev) return;
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: keep the in-memory state for this session */
  }
  listeners.forEach((l) => l());
}

// ---------- selectors ----------

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

/** The live member. Falls back to the default persona until onboarding. */
export function selectLiveProfile(s: AppState): MemberProfile {
  return s.liveProfile ?? defaultLivePersona;
}

export function selectActiveLobby(s: AppState): Lobby | null {
  return s.lobbies.find((l) => l.id === s.activeLobbyId) ?? null;
}

/** Saved homes, votes and what-if for the current context (active lobby or solo). */
export function selectActiveData(s: AppState): LobbyData {
  return selectActiveLobby(s) ?? s.solo;
}

/** Roommate ids that have joined (the live user is implicit and not included). */
export function joinedMemberIds(lobby: Lobby | null): Id[] {
  return lobby ? lobby.members.filter((m) => m.status === "joined" && m.memberId !== LIVE_MEMBER_ID).map((m) => m.memberId) : [];
}

/** People in the lobby counting the live user (invited ones included). */
export function lobbyHeadcount(lobby: Lobby): number {
  return 1 + lobby.members.filter((m) => m.memberId !== LIVE_MEMBER_ID).length;
}

// ---------- pure reducers (exported for tests) ----------

const now = () => new Date().toISOString();

function updateActive(s: AppState, f: (d: LobbyData) => LobbyData): AppState {
  const lobby = selectActiveLobby(s);
  if (!lobby) return { ...s, solo: f(s.solo) };
  return { ...s, lobbies: s.lobbies.map((l) => (l.id === lobby.id ? { ...l, ...f(l) } : l)) };
}

function updateLobby(s: AppState, id: Id, f: (l: Lobby) => Lobby): AppState {
  if (!s.lobbies.some((l) => l.id === id)) return s;
  return { ...s, lobbies: s.lobbies.map((l) => (l.id === id ? f(l) : l)) };
}

export const reducers = {
  createLobby(s: AppState, input: { id: Id; name: string; targetSize: number; moveIn?: string; at?: string }): AppState {
    const size = Math.min(MAX_LOBBY_SIZE, Math.max(MIN_LOBBY_SIZE, Math.round(input.targetSize) || 4));
    const lobby: Lobby = {
      id: input.id,
      name: input.name.trim() || "My housing group",
      universityId: "umich",
      targetSize: size,
      ...(input.moveIn?.trim() ? { moveIn: input.moveIn.trim() } : {}),
      createdAt: input.at ?? now(),
      members: [],
      ...emptyData(),
    };
    return { ...s, lobbies: [...s.lobbies, lobby], activeLobbyId: lobby.id };
  },
  invite(s: AppState, lobbyId: Id, memberId: Id, at = now()): AppState {
    if (memberId === LIVE_MEMBER_ID) return s;
    return updateLobby(s, lobbyId, (l) => {
      if (l.members.some((m) => m.memberId === memberId) || lobbyHeadcount(l) >= l.targetSize) return l;
      return { ...l, members: [...l.members, { memberId, status: "invited", invitedAt: at, role: "member" }] };
    });
  },
  markJoined(s: AppState, lobbyId: Id, memberId: Id, at = now()): AppState {
    return updateLobby(s, lobbyId, (l) => ({
      ...l,
      members: l.members.map((m) => (m.memberId === memberId && m.status === "invited" ? { ...m, status: "joined", joinedAt: at } : m)),
    }));
  },
  /** Finish every invite whose delay has passed. Returns the same object if nothing changed. */
  resolveInvites(s: AppState, nowMs = Date.now()): AppState {
    let changed = false;
    const lobbies = s.lobbies.map((l) => {
      const members = l.members.map((m) => {
        if (m.status !== "invited" || Date.parse(m.invitedAt) + s.demo.inviteDelayMs > nowMs) return m;
        changed = true;
        return { ...m, status: "joined" as const, joinedAt: new Date(nowMs).toISOString() };
      });
      return members.some((m, i) => m !== l.members[i]) ? { ...l, members } : l;
    });
    return changed ? { ...s, lobbies } : s;
  },
  removeMember(s: AppState, lobbyId: Id, memberId: Id): AppState {
    return updateLobby(s, lobbyId, (l) => ({ ...l, members: l.members.filter((m) => m.memberId !== memberId) }));
  },
  /** The live user leaves: the lobby goes away (you are its only real member), solo becomes active. */
  leaveLobby(s: AppState, lobbyId: Id): AppState {
    if (!s.lobbies.some((l) => l.id === lobbyId)) return s;
    return {
      ...s,
      lobbies: s.lobbies.filter((l) => l.id !== lobbyId),
      activeLobbyId: s.activeLobbyId === lobbyId ? null : s.activeLobbyId,
    };
  },
  setActiveLobby(s: AppState, lobbyId: Id | null): AppState {
    if (lobbyId !== null && !s.lobbies.some((l) => l.id === lobbyId)) return s;
    return s.activeLobbyId === lobbyId ? s : { ...s, activeLobbyId: lobbyId };
  },
  /** Any vote also saves the home (Interested, Maybe or Pass). */
  castVote(s: AppState, listingId: Id, value: VoteValue, at = now()): AppState {
    return updateActive(s, (d) =>
      ensureSaved(
        {
          ...d,
          votes: [...d.votes.filter((v) => !(v.listingId === listingId && v.memberId === LIVE_MEMBER_ID)), { memberId: LIVE_MEMBER_ID, listingId, value, at }],
        },
        listingId,
        at,
      ),
    );
  },
  clearVote(s: AppState, listingId: Id): AppState {
    return updateActive(s, (d) => ({ ...d, votes: d.votes.filter((v) => !(v.listingId === listingId && v.memberId === LIVE_MEMBER_ID)) }));
  },
  /** Save, or unsave (which also clears your vote on it). */
  toggleWatch(s: AppState, listingId: Id, at = now()): AppState {
    const saved = selectActiveData(s).watchlist.some((w) => w.listingId === listingId);
    return saved ? reducers.unsave(s, listingId) : updateActive(s, (d) => ensureSaved(d, listingId, at));
  },
  /** Remove a saved home and your vote on it. */
  unsave(s: AppState, listingId: Id): AppState {
    return updateActive(s, (d) => ({
      ...d,
      watchlist: d.watchlist.filter((w) => w.listingId !== listingId),
      votes: d.votes.filter((v) => !(v.listingId === listingId && v.memberId === LIVE_MEMBER_ID)),
    }));
  },
  /** Undo an `unsave`: the watch item and the vote come back unchanged. */
  restore(s: AppState, u: Unsaved): AppState {
    return updateActive(s, (d) => ({
      ...d,
      watchlist: d.watchlist.some((w) => w.listingId === u.item.listingId) ? d.watchlist : [...d.watchlist, u.item],
      votes: u.vote ? [...d.votes.filter((v) => !(v.listingId === u.vote!.listingId && v.memberId === u.vote!.memberId)), u.vote] : d.votes,
    }));
  },
};

// ---------- timers for pending invites ----------

const inviteTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleInviteResolution() {
  if (typeof window === "undefined") return;
  const s = getSnapshot();
  for (const l of s.lobbies) {
    for (const m of l.members) {
      const key = `${l.id}:${m.memberId}`;
      if (m.status !== "invited" || inviteTimers.has(key)) continue;
      const wait = Math.max(0, Date.parse(m.invitedAt) + s.demo.inviteDelayMs - Date.now());
      inviteTimers.set(
        key,
        setTimeout(() => {
          inviteTimers.delete(key);
          setState((st) => reducers.resolveInvites(st));
        }, wait + 20),
      );
    }
  }
}

// ---------- actions ----------

export const actions = {
  setLiveProfile(profile: MemberProfile) {
    setState((s) => ({ ...s, liveProfile: { ...profile, id: LIVE_MEMBER_ID, isLiveUser: true } }));
  },
  createLobby(input: { name: string; targetSize: number; moveIn?: string }): Id {
    const id = `lobby_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    setState((s) => reducers.createLobby(s, { ...input, id }));
    return id;
  },
  renameLobby(lobbyId: Id, name: string) {
    const n = name.trim();
    if (n) setState((s) => updateLobby(s, lobbyId, (l) => ({ ...l, name: n })));
  },
  invite(lobbyId: Id, memberId: Id) {
    setState((s) => reducers.invite(s, lobbyId, memberId));
    scheduleInviteResolution();
  },
  /** Call once on the client (app shell) so invites left pending by a reload still finish. */
  resumeInvites() {
    setState((s) => reducers.resolveInvites(s));
    scheduleInviteResolution();
  },
  removeMember(lobbyId: Id, memberId: Id) {
    setState((s) => reducers.removeMember(s, lobbyId, memberId));
  },
  leaveLobby(lobbyId: Id) {
    setState((s) => reducers.leaveLobby(s, lobbyId));
  },
  setActiveLobby(lobbyId: Id | null) {
    setState((s) => reducers.setActiveLobby(s, lobbyId));
  },
  setInviteDelay(ms: number) {
    setState((s) => ({ ...s, demo: { inviteDelayMs: Math.max(0, Math.min(30000, Math.round(ms))) } }));
  },
  castVote(listingId: Id, value: VoteValue) {
    setState((s) => reducers.castVote(s, listingId, value));
  },
  clearVote(listingId: Id) {
    setState((s) => reducers.clearVote(s, listingId));
  },
  /** Save a home that isn't saved yet. Returns false if it was already saved. */
  save(listingId: Id): boolean {
    if (selectActiveData(getSnapshot()).watchlist.some((w) => w.listingId === listingId)) return false;
    setState((s) => reducers.toggleWatch(s, listingId));
    return true;
  },
  /** Remove a saved home and your vote on it; returns what was removed (for Undo), or null. */
  unsave(listingId: Id): Unsaved | null {
    const d = selectActiveData(getSnapshot());
    const item = d.watchlist.find((w) => w.listingId === listingId);
    if (!item) return null;
    const vote = d.votes.find((v) => v.listingId === listingId && v.memberId === LIVE_MEMBER_ID) ?? null;
    setState((s) => reducers.unsave(s, listingId));
    return { item, vote };
  },
  restore(u: Unsaved) {
    setState((s) => reducers.restore(s, u));
  },
  addOpenQuestion(listingId: Id, question: string) {
    const q = question.trim();
    if (!q) return;
    setState((s) =>
      updateActive(s, (d) => ({
        ...d,
        watchlist: d.watchlist.map((w) => (w.listingId === listingId ? { ...w, openQuestions: [...w.openQuestions, q] } : w)),
      })),
    );
  },
  removeOpenQuestion(listingId: Id, index: number) {
    setState((s) =>
      updateActive(s, (d) => ({
        ...d,
        watchlist: d.watchlist.map((w) => (w.listingId === listingId ? { ...w, openQuestions: w.openQuestions.filter((_, i) => i !== index) } : w)),
      })),
    );
  },
  setScenarioBudget(memberId: Id, budget: number) {
    setState((s) =>
      updateActive(s, (d) => ({ ...d, scenario: { budgets: { ...(d.scenario?.budgets ?? {}), [memberId]: budget }, savedAt: now() } })),
    );
  },
  setScenarioBudgets(budgets: Record<Id, number>) {
    setState((s) => updateActive(s, (d) => ({ ...d, scenario: { budgets: { ...budgets }, savedAt: now() } })));
  },
  resetScenario() {
    setState((s) => updateActive(s, (d) => (d.scenario ? { ...d, scenario: null } : d)));
  },
  /** Hidden /demo: clear lobbies, votes, saved homes, scenarios and the profile. */
  resetDemo() {
    actions.deleteProfile();
  },
  /** "Delete my profile": removes everything this browser stored. */
  deleteProfile() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    inviteTimers.forEach((t) => clearTimeout(t));
    inviteTimers.clear();
    cache = DEFAULT_STATE;
    listeners.forEach((l) => l());
  },
};

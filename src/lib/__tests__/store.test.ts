import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, hydrate, joinedMemberIds, lobbyHeadcount, reducers, selectActiveData, selectActiveLobby } from "@/lib/store";
import { LIVE_MEMBER_ID, defaultLivePersona, listings } from "@/lib/data";
import { filterForLobby, rankListings } from "@/lib/engine";
import { applyEvidenceRule } from "@/lib/engine/rank";
import { DESTS, makeListing, makeMatrix, makeMember } from "@/lib/engine/__tests__/fixtures";
import type { AppState } from "@/lib/types";

const T0 = "2026-11-20T12:00:00.000Z";
const base = (): AppState => ({ ...DEFAULT_STATE, solo: { watchlist: [], votes: [], scenario: null } });
const withLobby = (size = 4) => reducers.createLobby(base(), { id: "L1", name: "Engineering House", targetSize: size, at: T0 });

describe("store v2: hydration and migration (V3 §4.1)", () => {
  it("v1 → v2 keeps only the live profile and starts with no lobby", () => {
    const v1 = { version: 1, liveProfile: defaultLivePersona, groupName: "The Packard Four", votes: [{ memberId: "member_a", listingId: "x", value: "pass", at: T0 }], watchlist: [], scenario: null };
    const s = hydrate(v1);
    expect(s.version).toBe(2);
    expect(s.liveProfile?.displayName).toBe(defaultLivePersona.displayName);
    expect(s.lobbies).toEqual([]);
    expect(s.activeLobbyId).toBeNull();
    expect(s.solo.votes).toEqual([]);
  });
  it("garbage and unknown versions reset to defaults", () => {
    for (const raw of [null, 42, "x", { version: 3 }, { version: 2, lobbies: "nope" }]) expect(hydrate(raw)).toEqual(DEFAULT_STATE);
  });
  it("a v2 payload round-trips; a dangling active id falls back to solo", () => {
    const s = withLobby();
    expect(hydrate(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(hydrate({ ...s, activeLobbyId: "gone" }).activeLobbyId).toBeNull();
  });
});

describe("store v2: lobbies", () => {
  it("create clamps size to 2–6, trims the name and makes the lobby active", () => {
    const s = reducers.createLobby(base(), { id: "a", name: "  ", targetSize: 99, at: T0 });
    expect(s.lobbies[0]).toMatchObject({ name: "My housing group", targetSize: 6, members: [] });
    expect(s.activeLobbyId).toBe("a");
    expect(reducers.createLobby(base(), { id: "b", name: "x", targetSize: 0, at: T0 }).lobbies[0].targetSize).toBe(4);
    expect(reducers.createLobby(base(), { id: "b", name: "x", targetSize: 1, at: T0 }).lobbies[0].targetSize).toBe(2);
  });
  it("invite → pending → joined after the delay; never twice, never the live user, never past full", () => {
    let s = withLobby(3);
    s = reducers.invite(s, "L1", "member_b", T0);
    s = reducers.invite(s, "L1", "member_b", T0);
    s = reducers.invite(s, "L1", LIVE_MEMBER_ID, T0);
    expect(s.lobbies[0].members).toHaveLength(1);
    expect(joinedMemberIds(selectActiveLobby(s))).toEqual([]);
    const t0 = Date.parse(T0);
    expect(reducers.resolveInvites(s, t0 + 2999)).toBe(s);
    s = reducers.resolveInvites(s, t0 + 3000);
    expect(joinedMemberIds(selectActiveLobby(s))).toEqual(["member_b"]);
    s = reducers.invite(s, "L1", "member_c", T0);
    s = reducers.invite(s, "L1", "member_d", T0); // full: you + 2 = 3
    expect(lobbyHeadcount(s.lobbies[0])).toBe(3);
    expect(s.lobbies[0].members.map((m) => m.memberId)).toEqual(["member_b", "member_c"]);
  });
  it("votes, saved homes and what-if are per lobby and separate from solo", () => {
    let s = withLobby();
    s = reducers.castVote(s, "geddes_4br", "interested", T0); // a vote also saves it
    s = reducers.createLobby(s, { id: "L2", name: "Other", targetSize: 3, at: T0 });
    expect(selectActiveData(s).votes).toEqual([]);
    expect(selectActiveData(s).watchlist).toEqual([]);
    s = reducers.setActiveLobby(s, null);
    expect(selectActiveData(s).votes).toEqual([]);
    s = reducers.setActiveLobby(s, "L1");
    expect(selectActiveData(s).votes.map((v) => v.value)).toEqual(["interested"]);
    expect(selectActiveData(s).watchlist.map((w) => w.listingId)).toEqual(["geddes_4br"]);
    // re-voting replaces, clearing removes
    s = reducers.castVote(s, "geddes_4br", "pass", T0);
    expect(selectActiveData(s).votes.map((v) => v.value)).toEqual(["pass"]);
    s = reducers.clearVote(s, "geddes_4br");
    expect(selectActiveData(s).votes).toEqual([]);
    expect(selectActiveData(s).watchlist.map((w) => w.listingId)).toEqual(["geddes_4br"]); // clearing a vote keeps it saved
  });
  it("any vote saves the home; unsave clears the vote; restore brings both back exactly", () => {
    let s = withLobby();
    for (const v of ["interested", "maybe", "pass"] as const) {
      const t = reducers.castVote(s, "um_ssv_4br", v, T0);
      expect(selectActiveData(t).watchlist.map((w) => w.listingId)).toEqual(["um_ssv_4br"]);
    }
    s = reducers.castVote(s, "um_ssv_4br", "pass", T0);
    // voting again doesn't duplicate the saved home
    s = reducers.castVote(s, "um_ssv_4br", "maybe", T0);
    expect(selectActiveData(s).watchlist).toHaveLength(1);
    const before = selectActiveData(s);
    const removed = { item: before.watchlist[0], vote: before.votes[0] };
    s = reducers.unsave(s, "um_ssv_4br");
    expect(selectActiveData(s).watchlist).toEqual([]);
    expect(selectActiveData(s).votes).toEqual([]);
    s = reducers.restore(s, removed);
    expect(selectActiveData(s).watchlist).toEqual(before.watchlist);
    expect(selectActiveData(s).votes).toEqual(before.votes);
    // toggleWatch on a saved home goes through unsave
    s = reducers.toggleWatch(s, "um_ssv_4br", T0);
    expect(selectActiveData(s).watchlist).toEqual([]);
    expect(selectActiveData(s).votes).toEqual([]);
  });
  it("leaving deletes the lobby and returns to solo; switching to an unknown id is ignored", () => {
    let s = withLobby();
    expect(reducers.setActiveLobby(s, "nope")).toBe(s);
    s = reducers.leaveLobby(s, "L1");
    expect(s.lobbies).toEqual([]);
    expect(s.activeLobbyId).toBeNull();
  });
});

describe("engine V3: per-room rent, bedroom filter, subjective features", () => {
  const m = makeMember("m", "Mo", { budgetMax: 2000 });
  const mx = makeMatrix({});
  it("whole-unit rent is divided by bedrooms, not by people; a studio is the whole rent", () => {
    const four = makeListing("four", { bedrooms: 4, rent: { amount: 4000, basis: "per_unit" } });
    const studio = makeListing("studio", { bedrooms: 0, rent: { amount: 1400, basis: "per_unit" } });
    const bed = makeListing("bed", { bedrooms: 4, rent: { amount: 950, basis: "per_bedroom" } });
    for (const members of [[m], [m, { ...m, id: "n" }]]) {
      const r = new Map(rankListings([four, studio, bed], members, mx, DESTS).map((x) => [x.listingId, x]));
      expect(r.get("four")!.perMember[0].perPersonRent).toBe(1000);
      expect(r.get("studio")!.perMember[0].perPersonRent).toBe(1400);
      expect(r.get("bed")!.perMember[0].perPersonRent).toBe(950);
    }
  });
  it("lobby shows exact bedroom matches only; solo shows every size", () => {
    expect(filterForLobby(listings, null)).toHaveLength(listings.length);
    for (const size of [2, 3, 4, 5, 6]) expect(filterForLobby(listings, size).every((l) => l.bedrooms === size)).toBe(true);
    expect(filterForLobby(listings, 4).length).toBeGreaterThan(0);
  });
  it("subjective features without the source's words are unknown, never met", () => {
    const l = makeListing("q", { featureEvidence: {}, features: { quietBuilding: true, largeKitchen: true, socialAmenities: false, dishwasher: true } });
    const f = applyEvidenceRule(l).features;
    expect([f.quietBuilding, f.largeKitchen, f.socialAmenities, f.dishwasher]).toEqual([null, null, null, true]);
    const ok = makeListing("q2");
    expect(applyEvidenceRule(ok)).toBe(ok);
  });
});

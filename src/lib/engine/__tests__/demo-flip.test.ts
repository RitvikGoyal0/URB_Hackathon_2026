/**
 * Stage flip (V3 §5.10), on the REAL catalog.
 * 4-person lobby: Alex + Jordan + Sam + whichever candidate the presenter invites.
 * Before: #1 is some eligible home X. State Street Village (Y, $885/room) is blocked ONLY by
 * Sam's $850 budget. Raising Sam's budget by any amount from $100 to $250 (slider step $25)
 * makes Y #1, and "What changed?" says why. Bus times come from the distance estimator, so
 * nothing here touches the network.
 */
import { describe, expect, it } from "vitest";
import { commuteMatrix, destinations, FRIEND_IDS, listings, personas, students } from "@/lib/data";
import { diffRankings, filterForLobby, rankListings } from "@/lib/engine";
import type { MemberProfile, TravelMode } from "@/lib/types";

const SAM_ID = "member_c";
const Y = "um_ssv_4br";
const BUMPS = [100, 125, 150, 175, 200, 225, 250];
const MODES: TravelMode[] = ["bike", "bus", "walk"];

const alex = personas.find((p) => p.isLiveUser)!;
const [jordan, sam] = FRIEND_IDS.map((id) => students.find((s) => s.id === id)!);
const candidates = students.filter((s) => !FRIEND_IDS.includes(s.id));
const pool = filterForLobby(listings, 4);
const rank = (ms: MemberProfile[]) => rankListings(pool, ms, commuteMatrix, destinations, { groupSize: 4 });
const withSam = (ms: MemberProfile[], budget: number) => ms.map((m) => (m.id === SAM_ID ? { ...m, budgetMax: budget } : m));

describe("stage flip: real home becomes #1 when Sam's budget rises", () => {
  it("cast is as the story needs", () => {
    expect(sam.id).toBe(SAM_ID);
    expect(sam.budgetMax).toBe(850);
    expect(candidates.length).toBeGreaterThanOrEqual(4);
    expect(pool.find((l) => l.id === Y)?.rent.provenance.status).not.toBe("unverified");
  });

  for (const mode of MODES) {
    for (const c of candidates) {
      it(`Alex by ${mode} + Jordan + Sam + ${c.displayName}`, () => {
        const members = [{ ...alex, travelMode: mode }, jordan, sam, c];
        const before = rank(members);
        const X = before[0];
        expect(X.listingId).not.toBe(Y);
        expect(X.eligibility).not.toBe("blocked");

        const yBefore = before.find((r) => r.listingId === Y)!;
        expect(yBefore.eligibility).toBe("blocked");
        expect(yBefore.blockers.length).toBeGreaterThan(0);
        expect(yBefore.blockers.every((b) => b.kind === "budget" && b.memberId === SAM_ID)).toBe(true);

        for (const bump of BUMPS) {
          const after = withSam(members, sam.budgetMax + bump);
          const ranked = rank(after);
          expect(ranked[0].listingId, `+$${bump}`).toBe(Y);
          expect(ranked[0].eligibility).not.toBe("blocked");
          const d = diffRankings(before, ranked, {
            changedInputs: [`Sam's budget $${sam.budgetMax} → $${sam.budgetMax + bump}`],
            listings,
            members: after,
          });
          expect(d.previousTop).toBe(X.listingId);
          expect(d.newTop).toBe(Y);
          expect(d.becameEligible).toContain(Y);
          const text = d.sentences.join(" ");
          expect(text).toContain(`${pool.find((l) => l.id === Y)!.name} became affordable for Sam`);
          expect(text).not.toMatch(/NaN|undefined|null|Infinity/);
        }
      });
    }
  }
});

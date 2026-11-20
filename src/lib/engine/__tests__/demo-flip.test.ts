/**
 * Spec §7.6 demo flip, on the REAL seed data.
 * With seeded budgets the #1 listing is X. Raising Sam's (member_c) budget by $100–$250
 * (slider step $25) makes a previously blocked listing Y eligible, and Y becomes #1.
 *
 * X / Y are found dynamically. Pin them in EXPECTED_X / EXPECTED_Y once the data is final
 * so an accidental data edit that changes the story fails loudly.
 */
import { describe, expect, it } from "vitest";
import { commuteMatrix, destinations, listings, personas } from "@/lib/data";
import { diffRankings, rankListings } from "@/lib/engine";
import type { MemberProfile, RankedResult } from "@/lib/types";

const SAM_ID = "member_c";
const MAYA_ID = "member_a";
const BUMPS = [100, 125, 150, 175, 200, 225, 250];
/** Set to listing ids once the data agent has tuned budgets (null = discover dynamically). */
const EXPECTED_X: string | null = "stub_packard_house";
const EXPECTED_Y: string | null = "stub_northside_4br";

/** Set DEMO_FLIP=1 to run it before the lead un-skips it. */
const maybeIt = it;

describe("demo flip (§7.6) — real seed data", () => {
  // TODO(lead): un-skip (replace `maybeIt` with `it`) once the data agent has finished tuning budgets / synthetic rents.
  maybeIt("raising Sam's budget by $100–$250 unblocks Y and makes it #1", () => {
    const sam = personas.find((p) => p.id === SAM_ID);
    expect(sam, "seed persona member_c (Sam)").toBeDefined();

    const before = rankListings(listings, personas, commuteMatrix, destinations);
    const X = before[0];
    if (EXPECTED_X) expect(X.listingId).toBe(EXPECTED_X);
    expect(X.eligibility).not.toBe("blocked");

    let found: { bump: number; yId: string; after: RankedResult[]; members: MemberProfile[] } | null = null;
    for (const bump of BUMPS) {
      const members = personas.map((p) => (p.id === SAM_ID ? { ...p, budgetMax: p.budgetMax + bump } : p));
      const after = rankListings(listings, members, commuteMatrix, destinations);
      const top = after[0];
      const prev = before.find((r) => r.listingId === top.listingId)!;
      if (
        top.listingId !== X.listingId &&
        top.eligibility !== "blocked" &&
        prev.eligibility === "blocked" &&
        prev.blockers.some((b) => b.kind === "budget" && b.memberId === SAM_ID)
      ) {
        found = { bump, yId: top.listingId, after, members };
        break;
      }
    }
    expect(found, `no bump in ${BUMPS.join("/")} flips #1 from ${X.listingId} to a Sam-budget-blocked listing`).not.toBeNull();
    const { bump, yId, after, members } = found!;
    if (EXPECTED_Y) expect(yId).toBe(EXPECTED_Y);

    // Y was blocked ONLY by Sam's budget (so the slider alone explains the flip)
    const yBefore = before.find((r) => r.listingId === yId)!;
    expect(yBefore.blockers.every((b) => b.kind === "budget" && b.memberId === SAM_ID)).toBe(true);

    // Y should be the strong North Campus option: better commute for Maya than X
    const mayaCommute = (r: RankedResult) => r.perMember.find((p) => p.memberId === MAYA_ID)!.subscores.commute.score ?? 0;
    const yAfter = after.find((r) => r.listingId === yId)!;
    const xAfter = after.find((r) => r.listingId === X.listingId)!;
    expect(mayaCommute(yAfter)).toBeGreaterThan(mayaCommute(xAfter));

    // "What changed?" tells the story from data
    const yName = listings.find((l) => l.id === yId)!.name;
    const d = diffRankings(before, after, {
      changedInputs: [`Sam's budget $${sam!.budgetMax} → $${sam!.budgetMax + bump}`],
      listings,
      members,
    });
    expect(d.becameEligible).toContain(yId);
    expect(d.newTop).toBe(yId);
    expect(d.previousTop).toBe(X.listingId);
    expect(d.sentences.join(" ")).toContain(`${yName} became affordable for Sam`);
    expect(d.sentences.join(" ")).toMatch(/closer to North Campus for Maya/);
  });
});

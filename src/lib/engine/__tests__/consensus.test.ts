import { describe, expect, it } from "vitest";
import { consensus } from "../consensus";
import type { Vote, VoteValue } from "@/lib/types";

const v = (memberId: string, value: VoteValue, at = "2026-11-20T10:00:00Z", listingId = "L"): Vote => ({ memberId, listingId, value, at });
const votes = (...vals: VoteValue[]) => vals.map((x, i) => v(`m${i}`, x));

describe("consensus (spec §9, 4 members)", () => {
  it.each([
    [[], "Awaiting Reviews"],
    [["interested"], "Awaiting Reviews"],
    [["interested", "interested", "interested", "interested"], "Everyone Interested"],
    [["interested", "interested", "interested"], "Strong Interest"],
    [["interested", "interested", "interested", "maybe"], "Strong Interest"],
    [["pass", "pass"], "Significant Disagreement"],
    [["interested", "pass", "pass"], "Significant Disagreement"],
    [["interested", "interested", "pass", "pass"], "Significant Disagreement"],
    [["interested", "interested", "interested", "pass"], "Mixed Opinions"],
    [["interested", "pass"], "Mixed Opinions"],
    [["maybe", "maybe"], "Under Consideration"],
    [["interested", "maybe"], "Under Consideration"],
    [["pass", "maybe", "maybe"], "Under Consideration"],
  ] as [VoteValue[], string][])("%j → %s", (vals, label) => {
    expect(consensus(votes(...vals), "L")).toBe(label);
  });

  it("uses each member's latest vote and ignores other listings", () => {
    const vs = [
      v("a", "pass", "2026-11-20T09:00:00Z"),
      v("a", "interested", "2026-11-20T11:00:00Z"),
      v("b", "interested"),
      v("c", "interested"),
      v("d", "pass", "2026-11-20T10:00:00Z", "OTHER"),
    ];
    expect(consensus(vs, "L")).toBe("Strong Interest");
    // order of the array does not matter
    expect(consensus([...vs].reverse(), "L")).toBe("Strong Interest");
    // a live vote flips Strong Interest → Everyone Interested
    expect(consensus([...vs, v("d", "interested")], "L")).toBe("Everyone Interested");
  });
});

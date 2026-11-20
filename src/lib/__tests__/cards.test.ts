import { describe, expect, it } from "vitest";
import { listings } from "@/lib/data";
import { latestVotesFor, voteTally } from "@/lib/votes";
import type { Listing, Vote } from "@/lib/types";
import { blockerLine, groupFitLabel, rentBasisText, rentFormula } from "@/components/shared/format";

const names = new Map([
  ["a", "Maya"],
  ["c", "Sam"],
]);

describe("groupFitLabel", () => {
  it("uses the V3 bands with inclusive lower edges", () => {
    expect(groupFitLabel(80)).toBe("Great fit");
    expect(groupFitLabel(79.9)).toBe("Good fit");
    expect(groupFitLabel(65)).toBe("Good fit");
    expect(groupFitLabel(64)).toBe("Some fit");
    expect(groupFitLabel(50)).toBe("Some fit");
    expect(groupFitLabel(49)).toBe("Weak fit");
    expect(groupFitLabel(0)).toBe("Weak fit");
    expect(groupFitLabel(null)).toBe("Not enough data");
  });
});

describe("blockerLine", () => {
  it("is null with no blockers", () => {
    expect(blockerLine([], names)).toBeNull();
  });
  it("names the member and the dollar gap for a budget blocker", () => {
    expect(blockerLine([{ kind: "budget", memberId: "c", amount: 150, message: "Exceeds Sam's budget by $150/mo." }], names)).toBe("Over Sam's budget by $150");
  });
  it("shows the largest budget gap first, then counts the rest", () => {
    const line = blockerLine(
      [
        { kind: "budget", memberId: "a", amount: 40, message: "x" },
        { kind: "budget", memberId: "c", amount: 210, message: "y" },
      ],
      names,
    );
    expect(line).toBe("Over Sam's budget by $210 · +1 more");
  });
  it("puts a capacity blocker ahead of budget and drops the trailing period", () => {
    const line = blockerLine(
      [
        { kind: "budget", memberId: "c", amount: 10, message: "z" },
        { kind: "capacity", message: "Max occupancy is 3; the group has 4." },
      ],
      names,
    );
    expect(line).toBe("Max occupancy is 3; the group has 4 · +1 more");
  });
  it("falls back to 'a member' for an unknown id", () => {
    expect(blockerLine([{ kind: "budget", memberId: "zz", amount: 5, message: "q" }], names)).toBe("Over a member's budget by $5");
  });
});

describe("rent wording is per room, never 'split N ways'", () => {
  const base = listings.find((l) => l.rent.basis === "per_unit" && l.rent.amount !== null && l.bedrooms === 4)!;
  it("per-unit: total for the home and the room count", () => {
    expect(rentBasisText(base)).toMatch(/^\$[\d,]+\/mo for the home · 4 rooms/);
    expect(rentBasisText(base)).not.toMatch(/split/);
  });
  it("studio counts as one room", () => {
    const studio: Listing = { ...base, bedrooms: 0 };
    expect(rentBasisText(studio)).toMatch(/· 1 room(\b|$)/);
    expect(rentFormula(studio, base.rent.amount)).toMatch(/÷ 1 room /);
  });
  it("unknown rent says so", () => {
    const unknown: Listing = { ...base, rent: { ...base.rent, amount: null, basis: "unknown" } };
    expect(rentBasisText(unknown)).toMatch(/^Rent not published/);
    expect(rentFormula(unknown, null)).toMatch(/never treated as \$0/);
  });
  it("formula divides by bedrooms, not group size", () => {
    expect(rentFormula(base, 1000)).toMatch(/÷ 4 rooms/);
  });
});

describe("vote tally", () => {
  const v = (memberId: string, value: Vote["value"], at: string, listingId = "L"): Vote => ({ memberId, value, at, listingId }) as Vote;
  const people = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  it("uses each member's latest vote on that listing only", () => {
    const latest = latestVotesFor(
      [v("a", "pass", "2026-01-01"), v("a", "interested", "2026-01-02"), v("b", "maybe", "2026-01-01"), v("c", "pass", "2026-01-01", "OTHER")],
      "L",
    );
    expect(voteTally(latest, people).text).toBe("1 Interested · 1 Maybe · 0 Pass · 2 waiting");
  });
  it("ignores votes from people not in the group", () => {
    const latest = latestVotesFor([v("x", "interested", "2026-01-01")], "L");
    expect(voteTally(latest, people)).toMatchObject({ interested: 0, waiting: 4 });
  });
  it("empty group has nothing waiting", () => {
    expect(voteTally(new Map(), []).text).toBe("0 Interested · 0 Maybe · 0 Pass · 0 waiting");
  });
});

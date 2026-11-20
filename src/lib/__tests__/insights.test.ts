import { describe, expect, it } from "vitest";
import { defaultLivePersona, friends } from "@/lib/data";
import { deriveInsights } from "@/components/lobby/insights";

describe("lobby insights: who sets the group budget limit", () => {
  it("nobody when you're alone in the lobby", () => {
    const i = deriveInsights([defaultLivePersona]);
    expect(i.bindingMemberId).toBeNull();
    expect(i.nonNegotiables.join(" ")).not.toMatch(/binding constraint/);
  });
  it("the lowest budget once there are two or more", () => {
    const group = [defaultLivePersona, ...friends];
    const lowest = [...group].sort((a, b) => a.budgetMax - b.budgetMax)[0];
    expect(deriveInsights(group).bindingMemberId).toBe(lowest.id);
  });
});

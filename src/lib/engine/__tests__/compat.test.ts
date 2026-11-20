import { describe, expect, it } from "vitest";
import { budgetSimilarity, compatLabel, compatibility, lifestyleSimilarity, rankRoommates } from "../compat";
import { FRIEND_IDS, defaultLivePersona, getDestination, personas, students } from "@/lib/data";
import { makeMember } from "./fixtures";
import { genWorld } from "./gen";

const name = (id: string) => getDestination(id)?.shortName;

describe("roommate similarity (V3 §5.7)", () => {
  it("score is in 0–100, symmetric and deterministic for every pair of seeded students", () => {
    for (const a of personas)
      for (const b of personas) {
        const ab = compatibility(a, b, name);
        expect(ab.score).toBeGreaterThanOrEqual(0);
        expect(ab.score).toBeLessThanOrEqual(100);
        expect(compatibility(b, a, name).score).toBe(ab.score);
        expect(compatibility(a, b, name)).toEqual(ab);
        for (const v of Object.values(ab.parts)) expect(v).toBeGreaterThanOrEqual(0);
        expect(ab.reasons.length).toBeLessThanOrEqual(2);
        for (const r of ab.reasons) expect(r).not.toMatch(/undefined|NaN|null/);
      }
  });
  it("a profile compared with itself scores 100 and gets two reasons", () => {
    const c = compatibility(defaultLivePersona, defaultLivePersona, name);
    expect(c.score).toBe(100);
    expect(c.label).toBe("Great match");
    expect(c.reasons).toHaveLength(2);
  });
  it("stays in range on random profiles", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const w = genWorld(seed);
      for (const a of w.members) for (const b of w.members) {
        const s = compatibility(a, b).score;
        expect(Number.isInteger(s) && s >= 0 && s <= 100).toBe(true);
      }
    }
  });
  it("budget bands: same = 1, ≥ 35% apart = 0, overlap shrinks with distance", () => {
    expect(budgetSimilarity(1000, 1000)).toBe(1);
    expect(budgetSimilarity(1000, 1400)).toBe(0);
    expect(budgetSimilarity(1000, 1100)).toBeGreaterThan(budgetSimilarity(1000, 1200));
  });
  it("lifestyle: exact 1, adjacent ½, opposite 0", () => {
    const q = { noise: "quiet", cooking: "high", guests: "rare" } as const;
    expect(lifestyleSimilarity(q, q)).toBe(1);
    expect(lifestyleSimilarity(q, { noise: "social", cooking: "low", guests: "often" })).toBe(0);
    expect(lifestyleSimilarity(q, { noise: "either", cooking: "medium", guests: "sometimes" })).toBe(0.5);
  });
  it("labels", () => {
    expect([80, 79, 65, 64, 50, 49].map(compatLabel)).toEqual(["Great match", "Good match", "Good match", "Some overlap", "Some overlap", "Different weeks"]);
  });
  it("shared organization becomes a reason", () => {
    const a = makeMember("a", "A", { major: "Engineering", organizations: ["MRacing"] });
    const b = makeMember("b", "B", { major: "Music", organizations: ["mracing"] });
    expect(compatibility(a, b).parts.majorClubs).toBe(0.5);
  });
  it("demo: 6 candidates (friends excluded), ties broken by id, Riley first for the demo profile", () => {
    const ranked = rankRoommates(defaultLivePersona, students.filter((s) => !FRIEND_IDS.includes(s.id)), name);
    expect(ranked).toHaveLength(6);
    expect(ranked[0].member.displayName).toBe("Riley");
    for (let i = 1; i < ranked.length; i++) {
      const [p, c] = [ranked[i - 1], ranked[i]];
      expect(p.compat.score > c.compat.score || (p.compat.score === c.compat.score && p.member.id < c.member.id)).toBe(true);
    }
  });
});

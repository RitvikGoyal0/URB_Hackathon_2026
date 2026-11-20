import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, applyThisOrThat, normalizeWeights, prioritiesFor, setPriority, weightsFromPriorities } from "../weights";
import { DIMS, type Weights } from "@/lib/types";

const sum = (w: Weights) => DIMS.reduce((s, d) => s + w[d], 0);

describe("weights (spec §7.5)", () => {
  it("defaults match the spec and sum to 1", () => {
    expect(DEFAULT_WEIGHTS).toEqual({ affordability: 0.3, commute: 0.25, amenities: 0.2, lifestyle: 0.15, space: 0.1 });
    expect(sum(DEFAULT_WEIGHTS)).toBeCloseTo(1, 10);
  });

  it("normalizeWeights rescales, clamps negatives and falls back to defaults when all zero", () => {
    const n = normalizeWeights({ affordability: 2, commute: 2, amenities: 0, lifestyle: -1, space: 0 });
    expect(n).toEqual({ affordability: 0.5, commute: 0.5, amenities: 0, lifestyle: 0, space: 0 });
    expect(normalizeWeights({ affordability: 0, commute: 0, amenities: 0, lifestyle: 0, space: 0 })).toEqual(DEFAULT_WEIGHTS);
  });

  it("this-or-that moves 0.05 to the chosen dimension and keeps the sum at 1", () => {
    const w = applyThisOrThat(DEFAULT_WEIGHTS, "commute", "space");
    expect(w.commute).toBeCloseTo(0.3, 10);
    expect(w.space).toBeCloseTo(0.05, 10);
    expect(sum(w)).toBeCloseTo(1, 10);
  });

  it("either / skip / same dimension make no change", () => {
    expect(applyThisOrThat(DEFAULT_WEIGHTS, "either", "space")).toEqual(DEFAULT_WEIGHTS);
    expect(applyThisOrThat(DEFAULT_WEIGHTS, "skip", "space")).toEqual(DEFAULT_WEIGHTS);
    expect(applyThisOrThat(DEFAULT_WEIGHTS, "space", "space")).toEqual(DEFAULT_WEIGHTS);
  });

  it("never drives a weight below 0", () => {
    let w = DEFAULT_WEIGHTS;
    for (let i = 0; i < 5; i++) w = applyThisOrThat(w, "affordability", "space");
    expect(w.space).toBe(0);
    expect(sum(w)).toBeCloseTo(1, 10);
  });
});

describe("priorities (V3 §5.8)", () => {
  const all = (v: 1 | 2 | 3 | 4) => ({ affordability: v, commute: v, amenities: v, lifestyle: v, space: v });

  it("levels 4/3/2/1 normalize to sum 1", () => {
    const w = weightsFromPriorities({ affordability: 4, commute: 3, amenities: 2, lifestyle: 1, space: 1 });
    expect(w.affordability).toBeCloseTo(4 / 11);
    expect(w.space).toBeCloseTo(1 / 11);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(weightsFromPriorities(all(2))).toEqual(weightsFromPriorities(all(4)));
  });

  it("derives levels from weights: the largest is Very important, defaults read 4/3/3/2/1", () => {
    expect(prioritiesFor(DEFAULT_WEIGHTS)).toEqual({ affordability: 4, commute: 3, amenities: 3, lifestyle: 2, space: 1 });
    expect(prioritiesFor(weightsFromPriorities(all(1)))).toEqual(all(4));
  });

  it("keeps the levels the student picked while the weights still match them", () => {
    const picked = { affordability: 2, commute: 2, amenities: 1, lifestyle: 1, space: 1 } as const;
    const w = weightsFromPriorities(picked);
    expect(prioritiesFor(w, picked)).toEqual(picked);
    // Weights changed elsewhere (this-or-that) → stale levels are ignored.
    expect(prioritiesFor(DEFAULT_WEIGHTS, picked)).toEqual(prioritiesFor(DEFAULT_WEIGHTS));
  });

  it("setPriority changes one row, snaps the rest to what they show, and round-trips", () => {
    const { weights, priorities } = setPriority(DEFAULT_WEIGHTS, undefined, "space", 4);
    expect(priorities).toEqual({ affordability: 4, commute: 3, amenities: 3, lifestyle: 2, space: 4 });
    expect(weights).toEqual(weightsFromPriorities(priorities));
    expect(prioritiesFor(weights, priorities)).toEqual(priorities);
    const again = setPriority(weights, priorities, "affordability", 1);
    expect(again.priorities).toEqual({ ...priorities, affordability: 1 });
  });

  it("never mutates its input", () => {
    const w = { ...DEFAULT_WEIGHTS };
    const p = { ...all(3) };
    setPriority(w, p, "commute", 1);
    expect(w).toEqual(DEFAULT_WEIGHTS);
    expect(p).toEqual(all(3));
  });
});

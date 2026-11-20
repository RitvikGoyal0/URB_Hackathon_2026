import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, applyThisOrThat, normalizeWeights } from "../weights";
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

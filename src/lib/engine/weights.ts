import type { Dim, Weights } from "../types";

export const DEFAULT_WEIGHTS: Weights = {
  affordability: 0.3,
  commute: 0.25,
  amenities: 0.2,
  lifestyle: 0.15,
  space: 0.1,
};

export function normalizeWeights(w: Weights): Weights {
  const clamped = Object.fromEntries(Object.entries(w).map(([k, v]) => [k, Math.max(0, v)])) as Weights;
  const sum = Object.values(clamped).reduce((s, v) => s + v, 0);
  if (sum === 0) return { ...DEFAULT_WEIGHTS };
  return Object.fromEntries(Object.entries(clamped).map(([k, v]) => [k, v / sum])) as Weights;
}

/**
 * This-or-that adjustment (spec §7.5): each answer moves ±0.05 from the losing
 * dimension to the chosen one, then renormalizes. "either"/"skip" = no change.
 */
export function applyThisOrThat(w: Weights, choose: Dim | "either" | "skip", over: Dim): Weights {
  if (choose === "either" || choose === "skip" || choose === over) return w;
  const next = { ...w };
  const shift = Math.min(0.05, next[over]);
  next[choose] += shift;
  next[over] -= shift;
  return normalizeWeights(next);
}

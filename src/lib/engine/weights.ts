import type { Dim, Weights } from "../types";
import { DIMS } from "../types";

/** Spec §7.5 defaults. */
export const DEFAULT_WEIGHTS: Weights = {
  affordability: 0.3,
  commute: 0.25,
  amenities: 0.2,
  lifestyle: 0.15,
  space: 0.1,
};

/** Clamp negatives / non-numbers to 0 and rescale to sum 1. All-zero → defaults. */
export function normalizeWeights(w: Weights): Weights {
  const clamped = Object.fromEntries(
    DIMS.map((d) => {
      const v = w?.[d];
      return [d, typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0];
    }),
  ) as Weights;
  const sum = DIMS.reduce((s, d) => s + clamped[d], 0);
  if (sum === 0) return { ...DEFAULT_WEIGHTS };
  return Object.fromEntries(DIMS.map((d) => [d, clamped[d] / sum])) as Weights;
}

/**
 * This-or-that adjustment (spec §7.5): each answer moves 0.05 from the losing
 * dimension to the chosen one (never below 0), then renormalizes. "either"/"skip" = no change.
 */
export function applyThisOrThat(w: Weights, choose: Dim | "either" | "skip", over: Dim): Weights {
  if (choose === "either" || choose === "skip" || choose === over) return w;
  const next = normalizeWeights(w);
  const shift = Math.min(0.05, next[over]);
  next[choose] += shift;
  next[over] -= shift;
  return normalizeWeights(next);
}

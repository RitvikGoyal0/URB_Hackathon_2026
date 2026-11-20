import type { Dim, Priorities, PriorityLevel, Weights } from "../types";
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

/** V3 §5.8: Very important / Important / Somewhat / Flexible → 4 / 3 / 2 / 1. */
export const PRIORITY_LEVELS: { value: PriorityLevel; label: string }[] = [
  { value: 4, label: "Very important" },
  { value: 3, label: "Important" },
  { value: 2, label: "Somewhat" },
  { value: 1, label: "Flexible" },
];

/** Levels normalized to sum to 1. */
export function weightsFromPriorities(p: Priorities): Weights {
  return normalizeWeights(Object.fromEntries(DIMS.map((d) => [d, p[d]])) as Weights);
}

const sameWeights = (a: Weights, b: Weights) => DIMS.every((d) => Math.abs(a[d] - b[d]) < 1e-6);

/**
 * The levels to show for a profile. If the student picked levels and the weights still match
 * them, those levels. Otherwise (defaults, this-or-that) the nearest level for each weight,
 * relative to the largest: the largest is always "Very important".
 */
export function prioritiesFor(weights: Weights, stored?: Priorities): Priorities {
  if (stored && sameWeights(weightsFromPriorities(stored), normalizeWeights(weights))) return { ...stored };
  const w = normalizeWeights(weights);
  const max = Math.max(...DIMS.map((d) => w[d]));
  return Object.fromEntries(
    DIMS.map((d) => [d, Math.min(4, Math.max(1, Math.round((w[d] / max) * 4))) as PriorityLevel]),
  ) as Priorities;
}

/** One row changed: every row takes the level it shows, and the weights follow the levels. */
export function setPriority(
  weights: Weights,
  stored: Priorities | undefined,
  dim: Dim,
  level: PriorityLevel,
): { weights: Weights; priorities: Priorities } {
  const priorities = { ...prioritiesFor(weights, stored), [dim]: level };
  return { weights: weightsFromPriorities(priorities), priorities };
}

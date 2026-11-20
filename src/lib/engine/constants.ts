/**
 * Every tunable number in the scoring engine, in one place, so the formula shown on
 * screen / in the README can cite exactly what the code does (spec §7.4).
 */

// ---- Affordability (§7.4) ----
/** Per-person rent at or below this share of budget scores 100. */
export const AFFORD_FULL_MARKS_RATIO = 0.8;
/** Score at exactly 100% of budget; linear between 80% (100) and 100% (this). Over budget → 0. */
export const AFFORD_AT_BUDGET_SCORE = 50;

// ---- Commute (§7.4, §5.7) ----
/** Trips at or under this many minutes score 100. */
export const COMMUTE_FULL_MARKS_MIN = 10;
/** Trips at or over this many minutes score 0 (linear in between). */
export const COMMUTE_ZERO_MIN = 40;
/**
 * Bus rule (§5.7): bus is never routed. Bus riders are scored on WALK time; walking time
 * beyond this threshold is assumed to be bus-able, so it counts at BUS_EXCESS_FACTOR.
 * effectiveMinutes = walk ≤ 20 ? walk : 20 + 0.5 × (walk − 20)
 * e.g. a 40-min walk is scored like a 30-min trip (33/100) rather than 0/100.
 * The effective number is never shown as a bus duration.
 */
export const BUS_WALK_THRESHOLD_MIN = 20;
export const BUS_EXCESS_FACTOR = 0.5;
export const BUS_NOTE = "Bus likely; check U-M Magic Bus";

// ---- Lifestyle rule magnitudes (§7.4). Score = clamp(50 + Σ deltas, 0, 100). ----
export const LIFESTYLE_BASE = 50;
export const LIFESTYLE = {
  quietBuildingMatch: 25, // quiet member, quietBuilding true
  quietBuildingMiss: -25, // quiet member, quietBuilding false
  quietHighRiseSocial: -15, // quiet member, high-rise with socialAmenities true
  socialMatch: 25, // social member, socialAmenities true
  socialMiss: -15, // social member, socialAmenities false
  cookHighMatch: 25, // cooking high, largeKitchen true
  cookHighMiss: -25, // cooking high, largeKitchen false
  cookMediumMatch: 10, // cooking medium, largeKitchen true
  cookMediumMiss: -5, // cooking medium, largeKitchen false
  guestsOftenMatch: 10, // guests often, socialAmenities true
  guestsOftenMiss: -10, // guests often, socialAmenities false
} as const;

// ---- Space sub-weights (§7.4). Unknown components are dropped and the rest renormalized. ----
export const SPACE_WEIGHTS = { bedroom: 0.4, bath: 0.35, sqft: 0.25 } as const;
/** Bathrooms per person at or above this → full marks (linear from 0). */
export const BATHS_PER_PERSON_FULL = 0.75;
/** Sq ft per person: ≤ SQFT_ZERO → 0, ≥ SQFT_FULL → 100, linear between. */
export const SQFT_PER_PERSON_ZERO = 100;
export const SQFT_PER_PERSON_FULL = 300;

// ---- Group score (§7.6) ----
export const GROUP_MEAN_WEIGHT = 0.75;
export const GROUP_MIN_WEIGHT = 0.25;

// ---- Capacity ----
/** A listing cannot house the group if even this many people per bedroom would not fit. */
export const MAX_PEOPLE_PER_SHARED_BEDROOM = 2;

// ---- What changed? (§7.7) ----
export const RANK_MOVE_THRESHOLD = 2;
/** Commute-subscore gap (points) at which the diff says "much closer" instead of "closer". */
export const MUCH_CLOSER_POINTS = 25;
/** Minimum subscore gap (points) worth mentioning when comparing new #1 with previous #1. */
export const COMPARE_MIN_POINTS = 10;

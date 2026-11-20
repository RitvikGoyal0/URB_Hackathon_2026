import type { Listing } from "../types";

/**
 * Per-person monthly rent (spec §7.2).
 * - per_unit: (amount + Σ per_unit fees) / groupSize + Σ per_person fees
 * - per_bedroom / per_person: amount + Σ per_person fees (+ per_unit fees / groupSize). NEVER divide amount by group size.
 * - unknown basis or null amount: null ("Contact for pricing"). Unknown rent is NEVER 0.
 */
export function perPersonRent(listing: Listing, groupSize: number): number | null {
  const { amount, basis, fees } = listing.rent;
  if (amount === null || basis === "unknown") return null;
  const unitFees = fees.filter((f) => f.scope === "per_unit").reduce((s, f) => s + f.monthly, 0);
  const personFees = fees.filter((f) => f.scope === "per_person").reduce((s, f) => s + f.monthly, 0);
  const size = Math.max(1, groupSize);
  if (basis === "per_unit") return Math.round((amount + unitFees) / size + personFees);
  return Math.round(amount + personFees + unitFees / size);
}

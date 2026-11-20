/**
 * Internal formatting helpers for engine reason / evidence / sentence strings.
 * Deterministic (no locale-dependent APIs) so the same input always yields the same text.
 */
import type { Dim, FeatureKey, Provenance, VerificationStatus } from "../types";

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const s = String(Math.round(Math.abs(n)));
  return `${sign}$${s.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function int(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Round to one decimal place (used for all published scores). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  verified: "verified",
  provider_reported: "provider-reported",
  third_party_reported: "third-party reported",
  unverified: "unverified",
  stale: "stale",
  synthetic: "synthetic demo data",
};

/** e.g. "provider-reported by Haven on Geddes, observed 2026-11-20" */
export function prov(p: Provenance): string {
  if (p.status === "synthetic") return "synthetic demo data (fictional)";
  return `${STATUS_LABEL[p.status]} by ${p.sourceName}, observed ${p.observedAt}`;
}

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  inUnitLaundry: "in-unit laundry",
  dishwasher: "dishwasher",
  parking: "parking",
  furnished: "furnished",
  largeKitchen: "large kitchen",
  socialAmenities: "social amenities",
  quietBuilding: "quiet building",
  petFriendly: "pet-friendly",
  ac: "A/C",
};

export const DIM_LABEL: Record<Dim, string> = {
  affordability: "Affordability",
  commute: "Commute",
  amenities: "Amenities",
  lifestyle: "Lifestyle",
  space: "Space",
};

/** "north_campus" → "North Campus" (fallback when no destination registry is available). */
export function humanizeId(id: string): string {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** "a, b and c" */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Deterministic string comparison (no locale). */
export function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** "a studio (no separate bedroom)" / "1 bedroom" / "3 bedrooms" */
export function bedroomsPhrase(n: number): string {
  if (n <= 0) return "a studio (no separate bedroom)";
  return `${n} bedroom${n === 1 ? "" : "s"}`;
}

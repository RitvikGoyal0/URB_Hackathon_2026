/**
 * Seeded random generators for property / fuzz tests. No dependencies: mulberry32 PRNG.
 * Every generator is a pure function of the PRNG state, so a failing seed reproduces exactly.
 */
import type {
  CampusDestination,
  CommuteMatrix,
  Destination,
  Fee,
  FeatureKey,
  HousingType,
  Listing,
  ListingFeatures,
  MemberProfile,
  RentBasis,
  RoutedMode,
  TravelMode,
  Weights,
} from "@/lib/types";
import { PROV } from "./fixtures";

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
export const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
export const chance = (r: Rng, p: number) => r() < p;
export function shuffle<T>(r: Rng, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const HOUSING: HousingType[] = ["high_rise", "garden_apartment", "townhome", "house", "duplex", "studio", "co_op", "ranch"];
export const BASES: RentBasis[] = ["per_unit", "per_bedroom", "per_person", "unknown"];
export const MODES: TravelMode[] = ["walk", "bike", "drive", "bus"];
export const ROUTED: RoutedMode[] = ["walk", "bike", "drive"];
export const FEATURES: FeatureKey[] = [
  "inUnitLaundry",
  "dishwasher",
  "parking",
  "furnished",
  "largeKitchen",
  "socialAmenities",
  "quietBuilding",
  "petFriendly",
  "ac",
];
export const DEST_IDS = ["central_campus", "north_campus", "south_campus", "medical_campus", "kerrytown"];

export const FUZZ_DESTS: CampusDestination[] = DEST_IDS.map((id) => ({
  id,
  campusId: "umich",
  name: id,
  shortName: id.replace(/_/g, " "),
  category: "campus_area",
  lat: 0,
  lng: 0,
  source: "test",
  verifiedAt: "2026-11-20",
}));

const tri = (r: Rng): boolean | null => pick(r, [true, false, null]);

export function genListing(r: Rng, i: number): Listing {
  const basis = pick(r, BASES);
  const amount = basis === "unknown" ? (chance(r, 0.5) ? null : int(r, 300, 6000)) : chance(r, 0.15) ? null : int(r, 200, 6000);
  const fees: Fee[] = [];
  for (let k = int(r, 0, 3); k > 0; k--) {
    fees.push({ label: `Fee ${k}`, monthly: int(r, 0, 120), scope: pick(r, ["per_unit", "per_person"] as const) });
  }
  const features = Object.fromEntries(FEATURES.map((f) => [f, tri(r)])) as unknown as ListingFeatures;
  const sqftRoll = r();
  return {
    // zero-padded so id order == generation order; a few duplicates of name are fine
    id: `l${String(i).padStart(4, "0")}`,
    communityId: `c${i}`,
    name: `Fuzz Listing ${i}`,
    housingType: pick(r, HOUSING),
    bedrooms: int(r, 0, 6),
    bathrooms: pick(r, [0, 0.5, 1, 1.5, 2, 2.5, 3, 4]),
    ...(sqftRoll < 0.2 ? {} : sqftRoll < 0.3 ? { sqft: 0 } : { sqft: int(r, 200, 3000) }),
    ...(chance(r, 0.6) ? {} : { maxOccupancy: int(r, 0, 8) }),
    privateBedrooms: tri(r),
    rent: {
      amount,
      ...(chance(r, 0.2) && amount !== null ? { amountMax: amount + int(r, -200, 400) } : {}),
      basis,
      fees,
      utilitiesIncluded: tri(r),
      ...(chance(r, 0.1) ? { secondary: { min: 900, max: 1300, basis: "per_bedroom" as RentBasis, label: "Per-bed range" } } : {}),
      provenance: PROV,
    },
    availability: { status: pick(r, ["available", "unknown", "unavailable"] as const), provenance: PROV },
    features,
    sourceType: pick(r, ["haven", "umich_offcampus", "synthetic"] as const),
    provenance: chance(r, 0.2) ? { ...PROV, status: "synthetic" } : PROV,
    images: [],
  };
}

export function genWeights(r: Rng): Weights {
  const kind = int(r, 0, 5);
  if (kind === 0) return { affordability: 0.3, commute: 0.25, amenities: 0.2, lifestyle: 0.15, space: 0.1 };
  if (kind === 1) return { affordability: 0, commute: 0, amenities: 0, lifestyle: 0, space: 0 };
  if (kind === 2) return { affordability: NaN, commute: 1, amenities: -0.5, lifestyle: Infinity, space: 0 };
  if (kind === 3) return { affordability: int(r, 0, 10), commute: int(r, 0, 10), amenities: int(r, 0, 10), lifestyle: int(r, 0, 10), space: int(r, 0, 10) };
  if (kind === 4) return { affordability: 1, commute: 0, amenities: 0, lifestyle: 0, space: 0 };
  return { affordability: r(), commute: r(), amenities: r(), lifestyle: r(), space: r() };
}

export function genMember(r: Rng, i: number): MemberProfile {
  const destinations: Destination[] = [];
  for (let k = int(r, 0, 4); k > 0; k--) {
    destinations.push({ destinationId: pick(r, [...DEST_IDS, "nowhere_in_matrix"]), visitsPerWeek: int(r, 0, 7), importance: pick(r, [1, 2, 3] as const) });
  }
  const budgetRoll = r();
  return {
    id: `m${i}`,
    displayName: `Mem${i}`,
    isLiveUser: i === 0,
    bio: "",
    budgetMax: budgetRoll < 0.05 ? 1 : budgetRoll < 0.1 ? 100000 : int(r, 300, 2000),
    budgetIsHardCap: chance(r, 0.5),
    travelMode: pick(r, MODES),
    hasCar: chance(r, 0.5),
    destinations,
    lifestyle: {
      noise: pick(r, ["quiet", "social", "either"] as const),
      cooking: pick(r, ["high", "medium", "low"] as const),
      guests: pick(r, ["rare", "sometimes", "often"] as const),
    },
    requirements: { privateBedroom: chance(r, 0.3), parking: chance(r, 0.3), inUnitLaundry: chance(r, 0.3) },
    desiredAmenities: FEATURES.filter(() => chance(r, 0.25)),
    weights: genWeights(r),
    fieldMeta: {},
  };
}

/** Random matrix with missing cells, missing modes, estimated cells and fractional minutes. */
export function genMatrix(r: Rng, listings: Listing[]): CommuteMatrix {
  const matrix: CommuteMatrix["matrix"] = {};
  for (const l of listings) {
    if (chance(r, 0.05)) continue; // listing absent from matrix entirely
    matrix[l.id] = {};
    for (const d of DEST_IDS) {
      if (chance(r, 0.1)) continue;
      const row: Partial<Record<RoutedMode, { minutes: number; meters: number; estimated: boolean }>> = {};
      for (const m of ROUTED) {
        if (chance(r, 0.1)) continue;
        const minutes = pick(r, [int(r, 0, 70), Math.round(r() * 700) / 10, 10, 20, 40]);
        row[m] = { minutes, meters: Math.round(minutes * 80), estimated: chance(r, 0.2) };
      }
      matrix[l.id][d] = row;
    }
  }
  return { provider: "OSRM fuzz", computedAt: "2026-11-20T00:00:00Z", matrix };
}

export interface World {
  listings: Listing[];
  members: MemberProfile[];
  matrix: CommuteMatrix;
}

export function genWorld(seed: number, nListings = int(mulberry32(seed ^ 0x9e3779b9), 1, 25)): World {
  const r = mulberry32(seed);
  const listings = Array.from({ length: nListings }, (_, i) => genListing(r, i));
  const members = Array.from({ length: int(r, 1, 6) }, (_, i) => genMember(r, i));
  return { listings, members, matrix: genMatrix(r, listings) };
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

/** Strings that must never reach the UI. */
export const BAD_TEXT = /NaN|undefined|\bnull\b|Infinity|\$-|\[object Object\]/;

/** Every string nested anywhere in a value. */
export function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => allStrings(x, out));
  return out;
}

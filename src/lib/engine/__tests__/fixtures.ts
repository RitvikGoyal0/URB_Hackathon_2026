/** Small hand-built fixtures for engine tests. Independent of the seed data. */
import type {
  CampusDestination,
  CommuteCell,
  CommuteMatrix,
  Listing,
  ListingFeatures,
  MemberProfile,
  Provenance,
  RoutedMode,
} from "@/lib/types";

export const PROV: Provenance = {
  sourceUrl: "https://example.test/listing",
  sourceName: "Example Provider",
  observedAt: "2026-11-20",
  status: "provider_reported",
};

const ALL_TRUE: ListingFeatures = {
  inUnitLaundry: true,
  dishwasher: true,
  parking: true,
  furnished: true,
  largeKitchen: true,
  socialAmenities: true,
  quietBuilding: true,
  petFriendly: true,
  ac: true,
};

type ListingOverrides = Partial<Omit<Listing, "rent" | "features">> & {
  rent?: Partial<Listing["rent"]>;
  features?: Partial<ListingFeatures>;
};

export function makeListing(id: string, o: ListingOverrides = {}): Listing {
  const { rent, features, ...rest } = o;
  return {
    id,
    communityId: "comm_" + id,
    name: `Listing ${id.toUpperCase()}`,
    housingType: "house",
    bedrooms: 4,
    bathrooms: 3,
    sqft: 1600,
    maxOccupancy: 4,
    privateBedrooms: true,
    availability: { status: "available", provenance: PROV },
    sourceType: "umich_offcampus",
    provenance: PROV,
    images: [],
    ...rest,
    rent: {
      amount: 600,
      basis: "per_bedroom",
      fees: [],
      utilitiesIncluded: true,
      provenance: PROV,
      ...rent,
    },
    features: { ...ALL_TRUE, ...features },
  };
}

type MemberOverrides = Partial<Omit<MemberProfile, "lifestyle" | "requirements">> & {
  lifestyle?: Partial<MemberProfile["lifestyle"]>;
  requirements?: Partial<MemberProfile["requirements"]>;
};

export function makeMember(id: string, name: string, o: MemberOverrides = {}): MemberProfile {
  const { lifestyle, requirements, ...rest } = o;
  return {
    id,
    displayName: name,
    isLiveUser: false,
    bio: "",
    budgetMax: 1000,
    budgetIsHardCap: false,
    travelMode: "walk",
    hasCar: false,
    destinations: [{ destinationId: "central", visitsPerWeek: 5, importance: 3 }],
    desiredAmenities: ["dishwasher"],
    weights: { affordability: 0.3, commute: 0.25, amenities: 0.2, lifestyle: 0.15, space: 0.1 },
    fieldMeta: {},
    ...rest,
    lifestyle: { noise: "either", cooking: "medium", guests: "sometimes", ...lifestyle },
    requirements: { privateBedroom: false, parking: false, inUnitLaundry: false, ...requirements },
  };
}

export const DESTS: CampusDestination[] = [
  { id: "central", campusId: "umich", name: "Central Campus (Diag)", shortName: "Central Campus", category: "campus_area", lat: 0, lng: 0, source: "test", verifiedAt: "2026-11-20" },
  { id: "north_campus", campusId: "umich", name: "North Campus (Pierpont)", shortName: "North Campus", category: "campus_area", lat: 0, lng: 0, source: "test", verifiedAt: "2026-11-20" },
];

export function cell(minutes: number, estimated = false): CommuteCell {
  return { minutes, meters: Math.round(minutes * 80), estimated };
}

/** times[listingId][destId] = minutes (same for walk/bike/drive unless given per mode) */
export function makeMatrix(
  times: Record<string, Record<string, number | Partial<Record<RoutedMode, number>>>>,
  estimated = false,
): CommuteMatrix {
  const matrix: CommuteMatrix["matrix"] = {};
  for (const [lid, row] of Object.entries(times)) {
    matrix[lid] = {};
    for (const [did, v] of Object.entries(row)) {
      const per = typeof v === "number" ? { walk: v, bike: v, drive: v } : v;
      matrix[lid][did] = Object.fromEntries(Object.entries(per).map(([m, min]) => [m, cell(min as number, estimated)]));
    }
  }
  return { provider: "OSRM test", computedAt: "2026-11-20T00:00:00Z", matrix };
}

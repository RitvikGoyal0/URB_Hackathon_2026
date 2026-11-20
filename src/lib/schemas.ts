/**
 * Zod mirrors of ./types.ts — used at every external boundary:
 * seed-file validation (tests), Gemini output, localStorage hydration.
 * FROZEN with types.ts.
 */
import { z } from "zod";
import type * as T from "./types";

export const verificationStatus = z.enum([
  "verified",
  "provider_reported",
  "third_party_reported",
  "unverified",
  "stale",
  "synthetic",
]);
export const sourceType = z.enum(["haven", "umich_offcampus", "synthetic"]);
export const rentBasis = z.enum(["per_unit", "per_bedroom", "per_person", "unknown"]);
export const travelMode = z.enum(["walk", "bike", "drive", "bus"]);
export const routedMode = z.enum(["walk", "bike", "drive"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "ISO date expected");

export const provenance = z.object({
  sourceUrl: z.string().min(1),
  sourceName: z.string().min(1),
  observedAt: isoDate,
  status: verificationStatus,
  note: z.string().optional(),
}) satisfies z.ZodType<T.Provenance>;

export const claimString = z.object({
  value: z.string(),
  provenance,
  scope: z.enum(["community", "floorplan", "unit"]),
}) satisfies z.ZodType<T.Claim<string>>;

export const university = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  shortName: z.string(),
  city: z.string(),
  state: z.string(),
  lat: z.number(),
  lng: z.number(),
  status: z.enum(["active", "coming_soon"]),
  offcampusResourceUrl: z.string(),
  description: z.string(),
  havenCommunityNames: z.array(z.string()),
}) satisfies z.ZodType<T.University>;

export const campusDestination = z.object({
  id: z.string(),
  campusId: z.string(),
  name: z.string(),
  shortName: z.string(),
  category: z.enum(["campus_area", "building", "neighborhood", "transit"]),
  lat: z.number(),
  lng: z.number(),
  source: z.string(),
  verifiedAt: isoDate,
}) satisfies z.ZodType<T.CampusDestination>;

export const community = z.object({
  id: z.string(),
  campusId: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  brand: z.enum(["Haven", "Other", "Synthetic"]),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  description: z.string(),
  amenities: z.array(claimString),
  officialUrl: z.string().optional(),
  images: z.array(z.string()),
  provenance,
}) satisfies z.ZodType<T.Community>;

const nb = z.boolean().nullable();
export const listingFeatures = z.object({
  inUnitLaundry: nb,
  dishwasher: nb,
  parking: nb,
  furnished: nb,
  largeKitchen: nb,
  socialAmenities: nb,
  quietBuilding: nb,
  petFriendly: nb,
  ac: nb,
}) satisfies z.ZodType<T.ListingFeatures>;

export const featureKey = z.enum([
  "inUnitLaundry",
  "dishwasher",
  "parking",
  "furnished",
  "largeKitchen",
  "socialAmenities",
  "quietBuilding",
  "petFriendly",
  "ac",
]);

export const fee = z.object({
  label: z.string(),
  monthly: z.number().nonnegative(),
  scope: z.enum(["per_unit", "per_person"]),
}) satisfies z.ZodType<T.Fee>;

export const listing = z
  .object({
    id: z.string(),
    communityId: z.string(),
    name: z.string(),
    housingType: z.enum(["high_rise", "garden_apartment", "townhome", "house", "duplex", "studio", "co_op", "ranch"]),
    bedrooms: z.number().int().nonnegative(),
    bathrooms: z.number().nonnegative(),
    sqft: z.number().positive().optional(),
    maxOccupancy: z.number().int().positive().optional(),
    privateBedrooms: nb,
    rent: z.object({
      amount: z.number().positive().nullable(),
      amountMax: z.number().positive().optional(),
      basis: rentBasis,
      fees: z.array(fee),
      utilitiesIncluded: nb,
      secondary: z
        .object({ min: z.number(), max: z.number(), basis: rentBasis, label: z.string() })
        .optional(),
      provenance,
    }),
    availability: z.object({
      status: z.enum(["available", "unknown", "unavailable"]),
      date: z.string().optional(),
      provenance,
    }),
    features: listingFeatures,
    sourceType,
    provenance,
    images: z.array(z.string()),
  })
  .refine((l) => (l.sourceType === "synthetic") === (l.provenance.status === "synthetic"), {
    message: "synthetic sourceType must have synthetic provenance status (and vice versa)",
  }) satisfies z.ZodType<T.Listing>;

const dimRecord = z.object({
  affordability: z.number(),
  commute: z.number(),
  amenities: z.number(),
  lifestyle: z.number(),
  space: z.number(),
});

export const weights = dimRecord.refine(
  (w) => Math.abs(w.affordability + w.commute + w.amenities + w.lifestyle + w.space - 1) < 0.001,
  { message: "weights must sum to 1" },
) satisfies z.ZodType<T.Weights>;

export const lifestyle = z.object({
  noise: z.enum(["quiet", "social", "either"]),
  cooking: z.enum(["high", "medium", "low"]),
  guests: z.enum(["rare", "sometimes", "often"]),
}) satisfies z.ZodType<T.Lifestyle>;

export const requirements = z.object({
  privateBedroom: z.boolean(),
  parking: z.boolean(),
  inUnitLaundry: z.boolean(),
}) satisfies z.ZodType<T.Requirements>;

export const fieldMeta = z.object({
  sourceText: z.string().optional(),
  sourceType: z.enum(["ai", "user", "seed"]),
  confidence: z.number().min(0).max(1).optional(),
  confirmed: z.boolean(),
}) satisfies z.ZodType<T.FieldMeta>;

export const destination = z.object({
  destinationId: z.string(),
  visitsPerWeek: z.number().nonnegative(),
  importance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
}) satisfies z.ZodType<T.Destination>;

export const memberProfile = z.object({
  id: z.string(),
  displayName: z.string().min(1),
  isLiveUser: z.boolean(),
  program: z.string().optional(),
  bio: z.string(),
  color: z.string().optional(),
  budgetMax: z.number().positive(),
  budgetIsHardCap: z.boolean(),
  travelMode,
  hasCar: z.boolean(),
  destinations: z.array(destination),
  lifestyle,
  requirements,
  desiredAmenities: z.array(featureKey),
  weights,
  fieldMeta: z.record(z.string(), fieldMeta),
}) satisfies z.ZodType<T.MemberProfile>;

export const voteValue = z.enum(["interested", "maybe", "pass"]);
export const vote = z.object({
  memberId: z.string(),
  listingId: z.string(),
  value: voteValue,
  at: z.string(),
}) satisfies z.ZodType<T.Vote>;

export const watchItem = z.object({
  listingId: z.string(),
  savedBy: z.string(),
  at: z.string(),
  openQuestions: z.array(z.string()),
}) satisfies z.ZodType<T.WatchItem>;

export const resourceLink = z.object({
  id: z.string(),
  campusId: z.string(),
  title: z.string(),
  summary: z.string(),
  url: z.string().url(),
  category: z.string(),
}) satisfies z.ZodType<T.ResourceLink>;

export const commuteCell = z.object({
  minutes: z.number().nonnegative(),
  meters: z.number().nonnegative(),
  estimated: z.boolean(),
}) satisfies z.ZodType<T.CommuteCell>;

export const commuteMatrix = z.object({
  provider: z.string(),
  computedAt: z.string(),
  matrix: z.record(
    z.string(),
    z.record(z.string(), z.object({ walk: commuteCell.optional(), bike: commuteCell.optional(), drive: commuteCell.optional() })),
  ),
}) satisfies z.ZodType<T.CommuteMatrix>;

// ---------- AI parse ----------
const pf = <S extends z.ZodTypeAny>(s: S) =>
  z.object({ value: s, sourceText: z.string(), confidence: z.number().min(0).max(1) });

export const profileParse = z.object({
  destinations: z.array(
    z.object({
      destinationId: z.string(),
      visitsPerWeek: z.number().nonnegative().optional(),
      sourceText: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  budgetMax: pf(z.number().positive()).optional(),
  travelMode: pf(travelMode).optional(),
  hasCar: pf(z.boolean()).optional(),
  lifestyle: z.object({
    noise: pf(lifestyle.shape.noise).optional(),
    cooking: pf(lifestyle.shape.cooking).optional(),
    guests: pf(lifestyle.shape.guests).optional(),
  }),
  requirements: z.object({
    privateBedroom: pf(z.boolean()).optional(),
    parking: pf(z.boolean()).optional(),
    inUnitLaundry: pf(z.boolean()).optional(),
  }),
  desiredAmenities: z.array(z.object({ value: featureKey, sourceText: z.string(), confidence: z.number().min(0).max(1) })),
  unmappedPlaces: z.array(
    z.object({ text: z.string(), suggestedDestinationId: z.string().optional(), question: z.string() }),
  ),
  missing: z.array(z.enum(["budget", "travelMode", "destinations"])),
  travelModeOptions: z.array(travelMode).optional(),
}) satisfies z.ZodType<T.ProfileParse>;

// ---------- localStorage ----------
export const scenario = z.object({
  budgets: z.record(z.string(), z.number()),
  savedAt: z.string(),
}) satisfies z.ZodType<T.Scenario>;

export const appState = z.object({
  version: z.literal(1),
  liveProfile: memberProfile.nullable(),
  groupName: z.string(),
  votes: z.array(vote),
  watchlist: z.array(watchItem),
  scenario: scenario.nullable(),
}) satisfies z.ZodType<T.AppState>;

// ---------- Seed-file array schemas ----------
export const seedSchemas = {
  universities: z.array(university),
  destinations: z.array(campusDestination),
  communities: z.array(community),
  listings: z.array(listing),
  personas: z.array(memberProfile),
  votes: z.array(vote),
  resources: z.array(resourceLink),
  commuteMatrix,
} as const;

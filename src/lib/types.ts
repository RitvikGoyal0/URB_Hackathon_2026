/**
 * Shared domain types — FROZEN contract (spec §4).
 * Data, engine, UI and AI layers all import from here.
 * Change only via the lead; Zod mirrors live in ./schemas.ts.
 */

export type Id = string;

export type VerificationStatus =
  | "verified"
  | "provider_reported"
  | "third_party_reported"
  | "unverified"
  | "stale"
  | "synthetic";

export type SourceType = "haven" | "umich_offcampus" | "synthetic";
export type RentBasis = "per_unit" | "per_bedroom" | "per_person" | "unknown";
export type TravelMode = "walk" | "bike" | "drive" | "bus";
/** Modes that have routed times in the commute matrix. Bus is never routed (spec §5.7). */
export type RoutedMode = "walk" | "bike" | "drive";

export interface Provenance {
  sourceUrl: string;
  sourceName: string;
  /** ISO date, e.g. "2026-11-20" */
  observedAt: string;
  status: VerificationStatus;
  note?: string;
}

export interface Claim<T> {
  value: T;
  provenance: Provenance;
  scope: "community" | "floorplan" | "unit";
}

export interface University {
  id: Id;
  slug: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  status: "active" | "coming_soon";
  offcampusResourceUrl: string;
  description: string;
  havenCommunityNames: string[];
}

export type DestinationCategory = "campus_area" | "building" | "neighborhood" | "transit";

export interface CampusDestination {
  id: Id;
  campusId: Id;
  name: string;
  shortName: string;
  category: DestinationCategory;
  lat: number;
  lng: number;
  source: string;
  verifiedAt: string;
}

/** A frequently visited campus building (V3 §6), verified once against OpenStreetMap. */
export interface Building {
  id: Id;
  campusId: Id;
  name: string;
  shortName: string;
  /** Other names students use ("UGLi", "the Union", "MRacing shop") */
  aliases: string[];
  /** Campus area it belongs to, or null (e.g. the downtown transit center) */
  areaId: Id | null;
  lat: number;
  lng: number;
  source: string;
  observedAt: string;
  note?: string;
}

export interface Community {
  id: Id;
  campusId: Id;
  name: string;
  aliases: string[];
  brand: "Haven" | "Other" | "Synthetic";
  address: string;
  lat: number;
  lng: number;
  description: string;
  amenities: Claim<string>[];
  officialUrl?: string;
  images: string[];
  provenance: Provenance;
}

export type HousingType =
  | "high_rise"
  | "garden_apartment"
  | "townhome"
  | "house"
  | "duplex"
  | "studio"
  | "co_op"
  | "ranch";

export interface Fee {
  label: string;
  monthly: number;
  /** per_unit fees are split across the group; per_person fees are added to each person. */
  scope: "per_unit" | "per_person";
}

export interface ListingFeatures {
  inUnitLaundry: boolean | null;
  dishwasher: boolean | null;
  parking: boolean | null;
  furnished: boolean | null;
  largeKitchen: boolean | null;
  socialAmenities: boolean | null;
  quietBuilding: boolean | null;
  petFriendly: boolean | null;
  ac: boolean | null;
}

export type FeatureKey = keyof ListingFeatures;

export interface Listing {
  id: Id;
  communityId: Id;
  /** e.g. "Haven on Geddes — 4BR Townhome" */
  name: string;
  housingType: HousingType;
  bedrooms: number;
  bathrooms: number;
  sqft?: number;
  /** undefined = unknown; must NOT be inferred from bedrooms */
  maxOccupancy?: number;
  privateBedrooms: boolean | null;
  rent: {
    /** null = unknown. Unknown rent is NEVER treated as 0. */
    amount: number | null;
    amountMax?: number;
    basis: RentBasis;
    fees: Fee[];
    utilitiesIncluded: boolean | null;
    /** Secondary display only, e.g. Geddes per-bed range $1,095–$1,335 */
    secondary?: { min: number; max: number; basis: RentBasis; label: string };
    provenance: Provenance;
  };
  availability: {
    status: "available" | "unknown" | "unavailable";
    date?: string;
    provenance: Provenance;
  };
  features: ListingFeatures;
  sourceType: SourceType;
  provenance: Provenance;
  /** Public paths or neutral placeholder images only — no hotlinked listing photos. */
  images: string[];
  /** Source wording for subjective features; without it they are unknown (V3 §4.3). */
  featureEvidence?: Partial<Record<FeatureKey, { quote: string; sourceUrl: string }>>;
}

export interface Destination {
  destinationId: Id;
  visitsPerWeek: number;
  importance: 1 | 2 | 3;
}

export type Dim = "affordability" | "commute" | "amenities" | "lifestyle" | "space";
export const DIMS: Dim[] = ["affordability", "commute", "amenities", "lifestyle", "space"];

export type Weights = Record<Dim, number>;

export interface Lifestyle {
  noise: "quiet" | "social" | "either";
  cooking: "high" | "medium" | "low";
  guests: "rare" | "sometimes" | "often";
}

export interface Requirements {
  privateBedroom: boolean;
  parking: boolean;
  inUnitLaundry: boolean;
}

export interface FieldMeta {
  sourceText?: string;
  sourceType: "ai" | "user" | "seed";
  confidence?: number;
  confirmed: boolean;
}

export interface MemberProfile {
  id: Id;
  displayName: string;
  isLiveUser: boolean;
  program?: string;
  bio: string;
  /** Avatar accent color token, e.g. "teal" */
  color?: string;
  budgetMax: number;
  budgetIsHardCap: boolean;
  travelMode: TravelMode;
  hasCar: boolean;
  destinations: Destination[];
  lifestyle: Lifestyle;
  requirements: Requirements;
  desiredAmenities: FeatureKey[];
  /** sums to 1 */
  weights: Weights;
  /** keyed by field path, e.g. "budgetMax", "destinations.north_campus" */
  fieldMeta: Record<string, FieldMeta>;
  major?: string;
  organizations?: string[];
  photo?: { dataUrl: string; updatedAt: string } | null;
  /** places beyond the 7 campus areas (known buildings, pins, class buildings); student-located only */
  places?: Place[];
  schedule?: { classes: ScheduleClass[]; confirmedAt?: string } | null;
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface Place {
  id: Id;
  name: string;
  kind: "custom" | "class";
  location: { source: "building" | "pin" | "area"; refId?: Id; label: string; lat: number; lng: number };
  visitsPerWeek: number;
  importance: 1 | 2 | 3;
  /** defaults to the profile's travelMode */
  mode?: TravelMode;
}

export interface ScheduleClass {
  name: string;
  days: Weekday[];
  /** "HH:MM" 24h */
  start: string;
  end: string;
  building?: string;
  placeId?: Id;
  confirmed: boolean;
}

export interface Group {
  id: Id;
  name: string;
  campusId: "umich";
  targetSize: 4;
  memberIds: Id[];
}

export type VoteValue = "interested" | "maybe" | "pass";

export interface Vote {
  memberId: Id;
  listingId: Id;
  value: VoteValue;
  at: string;
}

export interface WatchItem {
  listingId: Id;
  savedBy: Id;
  at: string;
  openQuestions: string[];
}

export interface ResourceLink {
  id: Id;
  campusId: Id;
  title: string;
  summary: string;
  url: string;
  category: string;
}

// ---------- Commute matrix (precomputed; app never calls OSRM at runtime) ----------

export interface CommuteCell {
  minutes: number;
  meters: number;
  /** true = haversine × 1.3 fallback, label "est. (straight-line)" */
  estimated: boolean;
}

export interface CommuteMatrix {
  provider: string;
  computedAt: string;
  /** matrix[listingId][destinationId][mode] */
  matrix: Record<Id, Record<Id, Partial<Record<RoutedMode, CommuteCell>>>>;
  /** listing coordinates, used by the distance estimator for bus trips and custom places */
  origins?: Record<Id, { lat: number; lng: number }>;
}

// ---------- Engine I/O (spec §7) ----------

export interface Subscore {
  /** 0–100, or null when it cannot be computed (weight is redistributed) */
  score: number | null;
  reason: string;
  evidence: string[];
}

export interface MemberResult {
  memberId: Id;
  /** weighted 0–100 over computed subscores; null if nothing computable */
  score: number | null;
  subscores: Record<Dim, Subscore>;
  /** effective weights after null redistribution */
  effectiveWeights: Weights;
  /** null = unknown price ("Contact for pricing") — never 0 */
  perPersonRent: number | null;
  /** Commute detail per destination for UI */
  commutes: {
    /** campus area id, or a custom/class place id */
    destinationId: Id;
    /** display name for custom places */
    name?: string;
    /** mode the minutes are for (a bus rider's short trip may be "walk": walking is faster) */
    mode: TravelMode;
    minutes: number | null;
    /** true = distance estimate (show "est."), false = routed */
    estimated: boolean;
    visitsPerWeek: number;
    note?: string;
  }[];
}

export type BlockerKind = "capacity" | "budget" | "required_feature";

export interface Blocker {
  kind: BlockerKind;
  memberId?: Id;
  message: string;
  /** budget blockers: dollars over budget per month */
  amount?: number;
}

export interface Warning {
  kind: "occupancy_unverified" | "affordability_unverified" | "feature_unverified" | "shared_bedrooms" | "utilities_excluded";
  memberId?: Id;
  message: string;
}

export type Eligibility = "eligible" | "eligible_with_unknowns" | "blocked";

export interface RankedResult {
  listingId: Id;
  rank: number;
  /** 0.75 × mean + 0.25 × min over members with non-null scores */
  groupScore: number | null;
  mean: number | null;
  min: number | null;
  /** member with the min score */
  leastSatisfiedMemberId: Id | null;
  coverage: { evaluated: number; total: number };
  perMember: MemberResult[];
  blockers: Blocker[];
  warnings: Warning[];
  eligibility: Eligibility;
}

export interface RankOptions {
  /** people sharing (capacity + space checks). Defaults to members.length. "bedrooms" = each
   *  listing is assumed full, one person per room (solo search). Rent is always per room. */
  groupSize?: number | "bedrooms";
}

export interface Explanation {
  /** e.g. "Strong fit for North Campus commutes and shared cooking." */
  summary: string;
  strengths: string[];
  /** e.g. "Main drawback: a 31-minute walk to North Campus for Maya." */
  compromise: string | null;
  perMember: Record<Id, string[]>;
}

export interface RankingDiff {
  changedInputs: string[];
  becameEligible: Id[];
  becameBlocked: Id[];
  rankMoves: { listingId: Id; from: number; to: number }[];
  newTop: Id | null;
  previousTop: Id | null;
  biggestDriver: { listingId: Id; memberId: Id; dim: Dim; delta: number } | null;
  /** Template sentences built only from the diff data */
  sentences: string[];
}

// ---------- AI parse contract (spec §8.2) ----------

export interface ParsedField<T> {
  value: T;
  sourceText: string;
  confidence: number;
}

export interface ProfileParse {
  destinations: { destinationId: Id; visitsPerWeek?: number; sourceText: string; confidence: number }[];
  budgetMax?: ParsedField<number>;
  travelMode?: ParsedField<TravelMode>;
  hasCar?: ParsedField<boolean>;
  lifestyle: {
    noise?: ParsedField<Lifestyle["noise"]>;
    cooking?: ParsedField<Lifestyle["cooking"]>;
    guests?: ParsedField<Lifestyle["guests"]>;
  };
  requirements: {
    privateBedroom?: ParsedField<boolean>;
    parking?: ParsedField<boolean>;
    inUnitLaundry?: ParsedField<boolean>;
  };
  desiredAmenities: { value: FeatureKey; sourceText: string; confidence: number }[];
  unmappedPlaces: { text: string; suggestedDestinationId?: Id; question: string }[];
  /** required fields missing: "budget" | "travelMode" | "destinations" */
  missing: ("budget" | "travelMode" | "destinations")[];
  /** if travel mode is ambiguous, e.g. ["bus","walk"] — UI asks which */
  travelModeOptions?: TravelMode[];
}

export type ParseResponse =
  | { ok: true; parse: ProfileParse; cached: boolean }
  | { ok: false; error: string };

// ---------- Client state (localStorage) ----------

export interface Scenario {
  /** memberId -> budget override */
  budgets: Record<Id, number>;
  savedAt: string;
}

export interface LobbyData {
  watchlist: WatchItem[];
  /** live user's votes for this lobby only (never shared across lobbies) */
  votes: Vote[];
  scenario: Scenario | null;
}

export interface LobbyMember {
  memberId: Id;
  status: "invited" | "joined";
  invitedAt: string;
  joinedAt?: string;
  role: "owner" | "member";
}

export interface Lobby extends LobbyData {
  id: Id;
  name: string;
  universityId: "umich";
  /** 2–6; in a lobby only homes with exactly this many bedrooms are shown */
  targetSize: number;
  moveIn?: string;
  createdAt: string;
  /** roommates only; the live user is the implicit owner */
  members: LobbyMember[];
}

export interface AppState {
  version: 2;
  liveProfile: MemberProfile | null;
  lobbies: Lobby[];
  /** null = solo search */
  activeLobbyId: Id | null;
  /** saved homes / votes / what-if while searching solo */
  solo: LobbyData;
  demo: { inviteDelayMs: number };
}

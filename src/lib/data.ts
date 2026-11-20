/**
 * Typed access to the committed seed data. Server- and client-safe (pure JSON imports).
 * Seed files are validated against Zod in src/lib/__tests__/seed.test.ts.
 */
import universitiesJson from "@/data/universities.json";
import destinationsJson from "@/data/destinations.umich.json";
import communitiesJson from "@/data/communities.json";
import listingsJson from "@/data/listings.json";
import personasJson from "@/data/personas.json";
import votesJson from "@/data/votes.seed.json";
import resourcesJson from "@/data/resources.umich.json";
import commuteMatrixJson from "@/data/commute-matrix.json";
import type {
  CampusDestination,
  Community,
  CommuteMatrix,
  Listing,
  MemberProfile,
  ResourceLink,
  University,
  Vote,
} from "./types";

export const universities = universitiesJson as University[];
export const destinations = destinationsJson as CampusDestination[];
export const communities = communitiesJson as Community[];
export const listings = listingsJson as unknown as Listing[];
export const personas = personasJson as unknown as MemberProfile[];
export const seedVotes = votesJson as Vote[];
export const resources = resourcesJson as ResourceLink[];
export const commuteMatrix = commuteMatrixJson as unknown as CommuteMatrix;

export const DEFAULT_GROUP_NAME = "The Packard Four";
export const LIVE_MEMBER_ID = "member_a";

const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));
const universityMap = byId(universities);
const destinationMap = byId(destinations);
const communityMap = byId(communities);
const listingMap = byId(listings);

export const getUniversity = (id: string) => universityMap.get(id);
export const getUniversityBySlug = (slug: string) => universities.find((u) => u.slug === slug);
export const getDestination = (id: string) => destinationMap.get(id);
export const getCommunity = (id: string) => communityMap.get(id);
export const getListing = (id: string) => listingMap.get(id);

/** Seeded roommates B, C, D (the live user A comes from onboarding / localStorage). */
export const seededRoommates = personas.filter((p) => !p.isLiveUser);
/** Default live persona ("Maya") used before onboarding or as demo fallback. */
export const defaultLivePersona = personas.find((p) => p.isLiveUser)!;

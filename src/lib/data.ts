/**
 * Typed access to the committed seed data. Server- and client-safe (pure JSON imports).
 * Seed files are validated against Zod in src/lib/__tests__/seed.test.ts.
 */
import universitiesJson from "@/data/universities.json";
import destinationsJson from "@/data/destinations.umich.json";
import buildingsJson from "@/data/buildings.umich.json";
import communitiesJson from "@/data/communities.json";
import listingsJson from "@/data/listings.json";
import personasJson from "@/data/personas.json";
import resourcesJson from "@/data/resources.umich.json";
import commuteMatrixJson from "@/data/commute-matrix.json";
import type {
  Building,
  CampusDestination,
  Community,
  CommuteMatrix,
  Listing,
  MemberProfile,
  ResourceLink,
  University,
} from "./types";

export const universities = universitiesJson as University[];
export const destinations = destinationsJson as CampusDestination[];
/** Known U-M buildings for "Where is it?" and schedule matching (V3 §6). */
export const buildings = buildingsJson as Building[];
export const communities = communitiesJson as Community[];
export const listings = listingsJson as unknown as Listing[];
export const personas = personasJson as unknown as MemberProfile[];
export const resources = resourcesJson as ResourceLink[];
const communityCoords = new Map((communitiesJson as Community[]).map((c) => [c.id, { lat: c.lat, lng: c.lng }]));
/** Routed OSRM times + each listing's coordinates for the distance estimator (bus, custom places). */
export const commuteMatrix: CommuteMatrix = {
  ...(commuteMatrixJson as unknown as CommuteMatrix),
  origins: Object.fromEntries(
    (listingsJson as unknown as Listing[]).flatMap((l) => {
      const c = communityCoords.get(l.communityId);
      return c ? [[l.id, c]] : [];
    }),
  ),
};

export const LIVE_MEMBER_ID = "member_a";

const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));
const universityMap = byId(universities);
const destinationMap = byId(destinations);
const communityMap = byId(communities);
const listingMap = byId(listings);

export const getUniversity = (id: string) => universityMap.get(id);
export const getUniversityBySlug = (slug: string) => universities.find((u) => u.slug === slug);
export const getDestination = (id: string) => destinationMap.get(id);
const buildingMap = byId(buildings);
export const getBuilding = (id: string) => buildingMap.get(id);
export const getCommunity = (id: string) => communityMap.get(id);
export const getListing = (id: string) => listingMap.get(id);

/** Fictional students you can invite (the live user comes from onboarding / localStorage). */
export const students = personas.filter((p) => !p.isLiveUser);
/** @deprecated V2 fixed group; kept for the landing-page preview and tests. */
export const seededRoommates = students;
const studentMap = byId(students);
export const getStudent = (id: string) => studentMap.get(id);
/** Default live persona ("Maya") used before onboarding or as demo fallback. */
export const defaultLivePersona = personas.find((p) => p.isLiveUser)!;

/** Students who are already the live user's friends (V3 §1: Jordan and Sam). */
export const FRIEND_IDS: readonly string[] = ["member_b", "member_c"];
export const friends = FRIEND_IDS.map((id) => studentMap.get(id)).filter((m): m is MemberProfile => !!m);

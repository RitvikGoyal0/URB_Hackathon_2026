/**
 * Places a student goes often (V3 §6, §7.8): pure helpers behind the "+ Add location" cards.
 * A place is only ever saved with a location the student picked themselves (an area, a known
 * building or a dropped pin); an AI suggestion is shown but never applied on its own.
 */
import { buildings, destinations } from "./data";
import { haversineKm } from "./engine/estimate";
import type { Building, CampusDestination, MemberProfile, Place, TravelMode } from "./types";

export type PlaceLocation = Place["location"];

export interface PlaceDraft {
  id?: string;
  name: string;
  kind?: Place["kind"];
  location: PlaceLocation | null;
  visitsPerWeek: number | null;
  mode: TravelMode | null;
  importance: Place["importance"] | null;
}

export const emptyDraft = (name = ""): PlaceDraft => ({ name, location: null, visitsPerWeek: null, mode: null, importance: null });

export const draftFromPlace = (p: Place): PlaceDraft => ({
  id: p.id,
  name: p.name,
  kind: p.kind,
  location: p.location,
  visitsPerWeek: p.visitsPerWeek,
  mode: p.mode ?? null,
  importance: p.importance,
});

export const FREQUENCIES: { label: string; visits: number }[] = [
  { label: "Daily", visits: 5 },
  { label: "A few times a week", visits: 3 },
  { label: "Weekly", visits: 1 },
  { label: "Occasionally", visits: 0.25 },
];
export const MAX_VISITS = 21;
export const IMPORTANCE_LABEL: Record<Place["importance"], string> = { 3: "High", 2: "Medium", 1: "Low" };
export const DEFAULT_IMPORTANCE: Place["importance"] = 2;

export const locationFromArea = (d: CampusDestination): PlaceLocation => ({ source: "area", refId: d.id, label: d.shortName, lat: d.lat, lng: d.lng });
export const locationFromBuilding = (b: Building): PlaceLocation => ({ source: "building", refId: b.id, label: b.shortName, lat: b.lat, lng: b.lng });

/** Nearest campus area to a point (for a readable pin label). */
export function nearestArea(lat: number, lng: number): CampusDestination | undefined {
  return [...destinations].sort((a, b) => haversineKm({ lat, lng }, a) - haversineKm({ lat, lng }, b))[0];
}
export function locationFromPin(lat: number, lng: number): PlaceLocation | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const near = nearestArea(lat, lng);
  const km = near ? haversineKm({ lat, lng }, near) : Infinity;
  return { source: "pin", label: near && km < 1.5 ? `Pin near ${near.shortName}` : "Dropped pin", lat, lng };
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9& ]/g, " ").replace(/\s+/g, " ").trim();

/** Known U-M buildings matching a search (name, short name or alias), best matches first. */
export function searchBuildings(query: string, limit = 6): Building[] {
  const q = norm(query);
  if (!q) return [];
  const scored = buildings.flatMap((b) => {
    const names = [b.shortName, b.name, ...b.aliases].map(norm);
    const best = Math.min(...names.map((n) => (n === q ? 0 : n.startsWith(q) ? 1 : n.split(" ").some((w) => w.startsWith(q)) ? 2 : n.includes(q) ? 3 : 9)));
    return best < 9 ? [{ b, best }] : [];
  });
  return scored.sort((x, y) => x.best - y.best || x.b.shortName.localeCompare(y.b.shortName)).slice(0, limit).map((x) => x.b);
}

function slug(s: string) {
  return norm(s).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 32) || "place";
}
export function newPlaceId(name: string, existing: Place[]): string {
  const base = `place_${slug(name)}`;
  const ids = new Set(existing.map((p) => p.id));
  if (!ids.has(base)) return base;
  let i = 2;
  while (ids.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

/** A finished place, or null while the name or (student-picked) location is still missing. */
export function finishDraft(draft: PlaceDraft, existing: Place[]): Place | null {
  const name = draft.name.trim().slice(0, 60);
  if (!name || !draft.location) return null;
  const v = draft.visitsPerWeek;
  const visitsPerWeek = v !== null && Number.isFinite(v) ? Math.min(MAX_VISITS, Math.max(0, v)) : 1;
  return {
    id: draft.id ?? newPlaceId(name, existing),
    name,
    kind: draft.kind ?? "custom",
    location: draft.location,
    visitsPerWeek,
    importance: draft.importance ?? DEFAULT_IMPORTANCE,
    ...(draft.mode ? { mode: draft.mode } : {}),
  };
}

export function upsertPlace(profile: MemberProfile, place: Place): MemberProfile {
  const places = profile.places ?? [];
  const i = places.findIndex((p) => p.id === place.id);
  return { ...profile, places: i < 0 ? [...places, place] : places.map((p, j) => (j === i ? place : p)) };
}

export function removePlace(profile: MemberProfile, id: string): MemberProfile {
  return { ...profile, places: (profile.places ?? []).filter((p) => p.id !== id) };
}

const MODE_WORD: Record<TravelMode, string> = { walk: "Walk", bike: "Bike", bus: "Bus", drive: "Drive" };

export function visitsLabel(v: number): string {
  if (v > 0 && v < 1) return "Occasionally";
  return `${Number.isInteger(v) ? v : v.toFixed(1)}×/wk`;
}

/** "MRacing · Wilson Center · 3×/wk · Bus · High" */
export function placeSummary(p: Place, defaultMode: TravelMode): string {
  return [p.name, p.location.label, visitsLabel(p.visitsPerWeek), MODE_WORD[p.mode ?? defaultMode], IMPORTANCE_LABEL[p.importance]].join(" · ");
}

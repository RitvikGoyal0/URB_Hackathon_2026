import type { TravelMode } from "../types";
import { BUS_ACCESS_MIN, BUS_KMH, BUS_WAIT_MIN, DETOUR_FACTOR, DRIVE_KMH, DRIVE_PARK_MIN, WALK_KMH, BIKE_KMH, BIKE_LOCK_MIN } from "./constants";

/**
 * Distance-based travel estimates (V3 §5.4). No network, pure and deterministic.
 *   road_km = haversine × 1.35
 *   walk = road_km / 4.8 km/h, bike = / 14 km/h + 1 min to lock up, drive = / 30 km/h + 4 min parking
 *   bus  = 5 min to/from stops + 5 min average wait + road_km / 18 km/h
 * A bus rider is never told to wait for a bus that's slower than walking: when the bus estimate
 * is ≥ the walk estimate, the walk time is used and `walkingFaster` is set.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const roadKm = (a: LatLng, b: LatLng) => haversineKm(a, b) * DETOUR_FACTOR;

const at = (km: number, kmh: number) => (km / kmh) * 60;

export function modeMinutes(km: number, mode: TravelMode): number {
  switch (mode) {
    case "walk":
      return at(km, WALK_KMH);
    case "bike":
      return at(km, BIKE_KMH) + BIKE_LOCK_MIN;
    case "drive":
      return at(km, DRIVE_KMH) + DRIVE_PARK_MIN;
    case "bus":
      return BUS_ACCESS_MIN + BUS_WAIT_MIN + at(km, BUS_KMH);
  }
}

export interface Estimate {
  minutes: number;
  km: number;
  /** the mode the minutes are for (walk when a bus would be slower) */
  mode: TravelMode;
  walkingFaster: boolean;
}

export function estimateTrip(from: LatLng, to: LatLng, mode: TravelMode): Estimate | null {
  if (![from.lat, from.lng, to.lat, to.lng].every(Number.isFinite)) return null;
  const km = roadKm(from, to);
  if (mode === "bus") {
    const walk = modeMinutes(km, "walk");
    const bus = modeMinutes(km, "bus");
    if (bus >= walk) return { minutes: walk, km, mode: "walk", walkingFaster: true };
    return { minutes: bus, km, mode: "bus", walkingFaster: false };
  }
  return { minutes: modeMinutes(km, mode), km, mode, walkingFaster: false };
}

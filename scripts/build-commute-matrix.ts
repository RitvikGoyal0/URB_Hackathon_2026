/**
 * Builds src/data/commute-matrix.json for every (listing × destination × mode).
 * Spec §5.7: OSRM table service for foot/bike/car; on failure, haversine × 1.3
 * fallback (walk 5 km/h, bike 15, drive 30) flagged estimated: true.
 * The app NEVER calls OSRM at runtime — run this script and commit the JSON.
 *
 * Usage: npx tsx scripts/build-commute-matrix.ts [--offline]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CampusDestination, Community, CommuteCell, CommuteMatrix, Listing, RoutedMode } from "../src/lib/types";

const root = join(__dirname, "..");
const read = <T>(f: string): T => JSON.parse(readFileSync(join(root, "src/data", f), "utf8"));

const listings = read<Listing[]>("listings.json");
const communities = read<Community[]>("communities.json");
const destinations = read<CampusDestination[]>("destinations.umich.json");
const offline = process.argv.includes("--offline");

const SPEED_KMH: Record<RoutedMode, number> = { walk: 5, bike: 15, drive: 30 };
const OSRM_PROFILE: Record<RoutedMode, string> = { walk: "routed-foot", bike: "routed-bike", drive: "routed-car" };

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fallback(a: { lat: number; lng: number }, b: { lat: number; lng: number }, mode: RoutedMode): CommuteCell {
  const meters = haversineMeters(a, b) * 1.3;
  const minutes = meters / 1000 / SPEED_KMH[mode] * 60;
  return { minutes: Math.round(minutes * 10) / 10, meters: Math.round(meters), estimated: true };
}

async function osrmTable(
  origins: { lat: number; lng: number }[],
  dests: { lat: number; lng: number }[],
  mode: RoutedMode,
): Promise<{ durations: (number | null)[][]; distances: (number | null)[][] } | null> {
  const coords = [...origins, ...dests].map((p) => `${p.lng},${p.lat}`).join(";");
  const sources = origins.map((_, i) => i).join(";");
  const destinationsIdx = dests.map((_, i) => i + origins.length).join(";");
  const url = `https://routing.openstreetmap.de/${OSRM_PROFILE[mode]}/table/v1/driving/${coords}?sources=${sources}&destinations=${destinationsIdx}&annotations=duration,distance`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "hack-the-lease-demo/0.1" } });
    if (!res.ok) return null;
    const json = (await res.json()) as { code: string; durations?: (number | null)[][]; distances?: (number | null)[][] };
    if (json.code !== "Ok" || !json.durations || !json.distances) return null;
    return { durations: json.durations, distances: json.distances };
  } catch {
    return null;
  }
}

async function main() {
  const commById = new Map(communities.map((c) => [c.id, c]));
  const origins = listings.map((l) => {
    const c = commById.get(l.communityId);
    if (!c) throw new Error(`Listing ${l.id} has unknown communityId ${l.communityId}`);
    return { id: l.id, lat: c.lat, lng: c.lng };
  });

  const out: CommuteMatrix = {
    provider: offline ? "Straight-line estimate (haversine × 1.3)" : "OSRM / OpenStreetMap (routing.openstreetmap.de)",
    computedAt: new Date().toISOString(),
    matrix: {},
  };
  for (const o of origins) out.matrix[o.id] = Object.fromEntries(destinations.map((d) => [d.id, {}]));

  let routed = 0;
  let estimated = 0;
  for (const mode of ["walk", "bike", "drive"] as RoutedMode[]) {
    const table = offline ? null : await osrmTable(origins, destinations, mode);
    origins.forEach((o, i) => {
      destinations.forEach((d, j) => {
        const dur = table?.durations[i]?.[j];
        const dist = table?.distances[i]?.[j];
        let cell: CommuteCell;
        if (dur != null && dist != null) {
          cell = { minutes: Math.round((dur / 60) * 10) / 10, meters: Math.round(dist), estimated: false };
          routed++;
        } else {
          cell = fallback(o, d, mode);
          estimated++;
        }
        out.matrix[o.id][d.id][mode] = cell;
      });
    });
  }

  writeFileSync(join(root, "src/data/commute-matrix.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`commute-matrix.json: ${origins.length} listings × ${destinations.length} destinations × 3 modes — routed ${routed}, estimated ${estimated}`);
}

main();

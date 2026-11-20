import { describe, expect, it } from "vitest";
import { seedSchemas } from "../schemas";
import universities from "@/data/universities.json";
import destinations from "@/data/destinations.umich.json";
import buildings from "@/data/buildings.umich.json";
import communities from "@/data/communities.json";
import listings from "@/data/listings.json";
import personas from "@/data/personas.json";
import resources from "@/data/resources.umich.json";
import commuteMatrix from "@/data/commute-matrix.json";

describe("seed files validate against Zod schemas", () => {
  it.each([
    ["universities", seedSchemas.universities, universities],
    ["destinations", seedSchemas.destinations, destinations],
    ["communities", seedSchemas.communities, communities],
    ["listings", seedSchemas.listings, listings],
    ["personas", seedSchemas.personas, personas],
    ["resources", seedSchemas.resources, resources],
    ["commuteMatrix", seedSchemas.commuteMatrix, commuteMatrix],
  ] as const)("%s", (_name, schema, data) => {
    const r = schema.safeParse(data);
    if (!r.success) throw new Error(JSON.stringify(r.error.issues.slice(0, 5), null, 2));
    expect(r.success).toBe(true);
  });
});

describe("referential integrity", () => {
  const commIds = new Set(communities.map((c) => c.id));
  const listingIds = new Set(listings.map((l) => l.id));
  const destIds = new Set(destinations.map((d) => d.id));

  it("every listing points at a known community", () => {
    for (const l of listings) expect(commIds.has(l.communityId), l.id).toBe(true);
  });
  it("listing ids are unique", () => {
    expect(listingIds.size).toBe(listings.length);
  });
  it("persona destinations exist", () => {
    for (const p of personas) for (const d of p.destinations) expect(destIds.has(d.destinationId), `${p.id}:${d.destinationId}`).toBe(true);
  });
  it("commute matrix covers every listing × destination × routed mode", () => {
    const m = (commuteMatrix as { matrix: Record<string, Record<string, Record<string, unknown>>> }).matrix;
    for (const l of listings)
      for (const d of destinations)
        for (const mode of ["walk", "bike", "drive"]) expect(m[l.id]?.[d.id]?.[mode], `${l.id}/${d.id}/${mode}`).toBeTruthy();
  });
  it("V3: every listing is real (no synthetic listings)", () => {
    expect(listings.filter((x) => x.sourceType === "synthetic" || x.provenance.status === "synthetic")).toEqual([]);
  });
  it("V3: a subjective feature marked true always carries the source's own words", () => {
    for (const l of listings)
      for (const k of ["quietBuilding", "largeKitchen", "socialAmenities"] as const)
        if (l.features[k] === true) expect(l.featureEvidence?.[k]?.quote, `${l.id}.${k}`).toBeTruthy();
  });
  it("V3: evidence is never stored for a feature left unknown (a quote without a value is a data slip)", () => {
    for (const l of listings)
      for (const [k, e] of Object.entries(l.featureEvidence ?? {})) {
        expect(l.features[k as keyof typeof l.features], `${l.id}.${k}`).not.toBeNull();
        expect(e?.sourceUrl, `${l.id}.${k}`).toMatch(/^https:\/\//);
      }
  });
});

describe("U-M buildings (V3 §6)", () => {
  const destById = new Map(destinations.map((d) => [d.id, d]));
  const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const r = (x: number) => (x * Math.PI) / 180;
    const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  };
  it("validates and has the buildings the spec names", () => {
    expect(seedSchemas.buildings.safeParse(buildings).success).toBe(true);
    const ids = new Set(buildings.map((b) => b.id));
    expect(ids.size).toBe(buildings.length);
    expect(buildings.length).toBeGreaterThanOrEqual(25);
    for (const id of ["wilson_center", "michigan_union", "michigan_league", "pierpont_commons", "beyster", "eecs", "gg_brown", "ford_robotics", "duderstadt", "hatcher", "shapiro", "ross", "hadley", "im_building", "university_hospital", "chemistry", "angell_hall", "mason_hall", "blake_transit"])
      expect(ids.has(id), id).toBe(true);
  });
  it("every building is in Ann Arbor and within 1.5 km of its campus area", () => {
    for (const b of buildings) {
      expect(km(b, { lat: 42.2808, lng: -83.743 }), b.id).toBeLessThan(6);
      if (b.areaId) {
        const area = destById.get(b.areaId);
        expect(area, `${b.id} → ${b.areaId}`).toBeDefined();
        expect(km(b, area!), b.id).toBeLessThan(1.5);
      }
    }
  });
});

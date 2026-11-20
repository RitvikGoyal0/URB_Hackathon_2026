import { describe, expect, it } from "vitest";
import { seedSchemas } from "../schemas";
import universities from "@/data/universities.json";
import destinations from "@/data/destinations.umich.json";
import communities from "@/data/communities.json";
import listings from "@/data/listings.json";
import personas from "@/data/personas.json";
import votes from "@/data/votes.seed.json";
import resources from "@/data/resources.umich.json";
import commuteMatrix from "@/data/commute-matrix.json";

describe("seed files validate against Zod schemas", () => {
  it.each([
    ["universities", seedSchemas.universities, universities],
    ["destinations", seedSchemas.destinations, destinations],
    ["communities", seedSchemas.communities, communities],
    ["listings", seedSchemas.listings, listings],
    ["personas", seedSchemas.personas, personas],
    ["votes", seedSchemas.votes, votes],
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
  const personaIds = new Set(personas.map((p) => p.id));

  it("every listing points at a known community", () => {
    for (const l of listings) expect(commIds.has(l.communityId), l.id).toBe(true);
  });
  it("listing ids are unique", () => {
    expect(listingIds.size).toBe(listings.length);
  });
  it("persona destinations exist", () => {
    for (const p of personas) for (const d of p.destinations) expect(destIds.has(d.destinationId), `${p.id}:${d.destinationId}`).toBe(true);
  });
  it("votes reference known members and listings", () => {
    for (const v of votes) {
      expect(personaIds.has(v.memberId)).toBe(true);
      expect(listingIds.has(v.listingId)).toBe(true);
    }
  });
  it("commute matrix covers every listing × destination × routed mode", () => {
    const m = (commuteMatrix as { matrix: Record<string, Record<string, Record<string, unknown>>> }).matrix;
    for (const l of listings)
      for (const d of destinations)
        for (const mode of ["walk", "bike", "drive"]) expect(m[l.id]?.[d.id]?.[mode], `${l.id}/${d.id}/${mode}`).toBeTruthy();
  });
  it("synthetic listings are visibly fictional", () => {
    for (const l of listings.filter((x) => x.sourceType === "synthetic")) expect(l.name).toMatch(/\(Demo\)/);
  });
});

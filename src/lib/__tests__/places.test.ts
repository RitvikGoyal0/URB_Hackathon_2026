import { describe, expect, it } from "vitest";
import { defaultLivePersona, getBuilding, getDestination } from "../data";
import {
  draftFromPlace,
  emptyDraft,
  finishDraft,
  locationFromArea,
  locationFromBuilding,
  locationFromPin,
  newPlaceId,
  placeSummary,
  removePlace,
  searchBuildings,
  upsertPlace,
  visitsLabel,
} from "../places";

const wilson = getBuilding("wilson_center")!;

describe("place follow-up flow (V3 §7.8)", () => {
  it("no place is saved until the student picks a location", () => {
    expect(finishDraft(emptyDraft("MRacing"), [])).toBeNull();
    expect(finishDraft({ ...emptyDraft("MRacing"), visitsPerWeek: 3, mode: "bus", importance: 3 }, [])).toBeNull();
    expect(finishDraft({ ...emptyDraft("   "), location: locationFromBuilding(wilson) }, [])).toBeNull();
    const p = finishDraft({ ...emptyDraft("MRacing"), location: locationFromBuilding(wilson), visitsPerWeek: 3, mode: "bus", importance: 3 }, []);
    expect(p).toMatchObject({ name: "MRacing", kind: "custom", visitsPerWeek: 3, mode: "bus", importance: 3, location: { source: "building", refId: "wilson_center" } });
  });

  it("skipped questions fall back to sensible defaults (mode follows the profile)", () => {
    const p = finishDraft({ ...emptyDraft("Gym"), location: locationFromArea(getDestination("central_campus")!) }, [])!;
    expect(p.visitsPerWeek).toBe(1);
    expect(p.importance).toBe(2);
    expect(p.mode).toBeUndefined();
  });

  it("clamps visits and trims names", () => {
    const p = finishDraft({ ...emptyDraft("  Job  "), location: locationFromPin(42.25, -83.74), visitsPerWeek: 99 }, [])!;
    expect(p.name).toBe("Job");
    expect(p.visitsPerWeek).toBe(21);
    expect(finishDraft({ ...emptyDraft("Job"), location: locationFromPin(42.25, -83.74), visitsPerWeek: -3 }, [])!.visitsPerWeek).toBe(0);
  });

  it("edit keeps the id; add never collides", () => {
    const a = finishDraft({ ...emptyDraft("MRacing"), location: locationFromBuilding(wilson) }, [])!;
    const prof = upsertPlace({ ...defaultLivePersona, places: [] }, a);
    const b = finishDraft({ ...emptyDraft("MRacing"), location: locationFromBuilding(wilson) }, prof.places!)!;
    expect(b.id).not.toBe(a.id);
    const edited = finishDraft({ ...draftFromPlace(a), visitsPerWeek: 5 }, prof.places!)!;
    expect(edited.id).toBe(a.id);
    const after = upsertPlace(prof, edited);
    expect(after.places).toHaveLength(1);
    expect(after.places![0].visitsPerWeek).toBe(5);
    expect(removePlace(after, a.id).places).toHaveLength(0);
    expect(newPlaceId("!!!", [])).toBe("place_place");
  });

  it("pins are labelled by the nearest campus area, and bad coordinates are refused", () => {
    expect(locationFromPin(42.2912, -83.7176)!.label).toBe("Pin near North Campus");
    expect(locationFromPin(42.2, -83.9)!.label).toBe("Dropped pin");
    expect(locationFromPin(NaN, -83.7)).toBeNull();
  });

  it("building search matches names, short names and aliases", () => {
    expect(searchBuildings("wilson")[0].id).toBe("wilson_center");
    expect(searchBuildings("mracing")[0].id).toBe("wilson_center");
    expect(searchBuildings("ugli")[0].id).toBe("shapiro");
    expect(searchBuildings("ccrb")[0].id).toBe("hadley");
    expect(searchBuildings("union")[0].id).toBe("michigan_union");
    expect(searchBuildings("")).toEqual([]);
    expect(searchBuildings("zzzz")).toEqual([]);
    expect(searchBuildings("a", 3)).toHaveLength(3);
  });

  it("summary row reads like the spec", () => {
    const p = finishDraft({ ...emptyDraft("MRacing"), location: locationFromBuilding(wilson), visitsPerWeek: 3, mode: "bus", importance: 3 }, [])!;
    expect(placeSummary(p, "walk")).toBe("MRacing · Wilson Center · 3×/wk · Bus · High");
    expect(placeSummary({ ...p, mode: undefined }, "walk")).toBe("MRacing · Wilson Center · 3×/wk · Walk · High");
    expect(visitsLabel(0.25)).toBe("Occasionally");
  });
});

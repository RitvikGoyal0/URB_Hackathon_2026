import { describe, expect, it } from "vitest";
import { commuteMatrix, destinations, listings } from "@/lib/data";
import { estimateTrip, haversineKm, modeMinutes, roadKm } from "../estimate";
import { BIKE_LOCK_MIN, BUS_ACCESS_MIN, BUS_WAIT_MIN, DETOUR_FACTOR, DRIVE_PARK_MIN } from "../constants";

const diag = { lat: 42.2769, lng: -83.7382 };
const pierpont = { lat: 42.29112, lng: -83.7176 };

describe("distance estimator (V3 §5.4)", () => {
  it("haversine: zero for the same point, symmetric, ~111 km per degree of latitude", () => {
    expect(haversineKm(diag, diag)).toBe(0);
    expect(haversineKm(diag, pierpont)).toBeCloseTo(haversineKm(pierpont, diag), 10);
    expect(haversineKm({ lat: 42, lng: -83 }, { lat: 43, lng: -83 })).toBeCloseTo(111.2, 0);
  });

  it("road distance is straight-line distance × the detour factor", () => {
    expect(roadKm(diag, pierpont)).toBeCloseTo(haversineKm(diag, pierpont) * DETOUR_FACTOR, 10);
  });

  it("each mode uses its documented speed and fixed minutes", () => {
    expect(modeMinutes(4.8, "walk")).toBeCloseTo(60);
    expect(modeMinutes(14, "bike")).toBeCloseTo(60 + BIKE_LOCK_MIN);
    expect(modeMinutes(30, "drive")).toBeCloseTo(60 + DRIVE_PARK_MIN);
    expect(modeMinutes(18, "bus")).toBeCloseTo(60 + BUS_ACCESS_MIN + BUS_WAIT_MIN);
    expect(modeMinutes(0, "walk")).toBe(0);
  });

  it("a bus rider gets the walk time when walking would be faster", () => {
    const near = estimateTrip(diag, { lat: 42.2785, lng: -83.7382 }, "bus")!;
    expect(near.walkingFaster).toBe(true);
    expect(near.mode).toBe("walk");
    expect(near.minutes).toBeCloseTo(modeMinutes(near.km, "walk"));
    const far = estimateTrip(diag, pierpont, "bus")!;
    expect(far.walkingFaster).toBe(false);
    expect(far.mode).toBe("bus");
    expect(far.minutes).toBeLessThan(modeMinutes(far.km, "walk"));
  });

  it("returns null for missing or non-finite coordinates instead of NaN minutes", () => {
    expect(estimateTrip({ lat: NaN, lng: -83.7 }, diag, "walk")).toBeNull();
    expect(estimateTrip(diag, { lat: 42.28, lng: Infinity }, "bus")).toBeNull();
  });

  /**
   * Sanity check against the routed OSRM times we ship for the 7 campus areas.
   * Per area, the median estimate is within ±35% of OSRM; overall ≥ 90% of trips are.
   * (The few misses are real detours a straight line can't see: the Huron River, rail lines.)
   */
  describe.each(["walk", "bike"] as const)("±35%% of OSRM: %s", (mode) => {
    const ratios = (destId: string) =>
      listings.flatMap((l) => {
        const cell = commuteMatrix.matrix[l.id]?.[destId]?.[mode];
        const origin = commuteMatrix.origins?.[l.id];
        const d = destinations.find((x) => x.id === destId)!;
        if (!cell || cell.estimated || !origin || cell.minutes <= 0) return [];
        return [estimateTrip(origin, d, mode)!.minutes / cell.minutes];
      });
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

    it.each(destinations.map((d) => d.id))("median for %s", (destId) => {
      const r = ratios(destId);
      expect(r.length).toBeGreaterThanOrEqual(10);
      expect(median(r)).toBeGreaterThan(0.65);
      expect(median(r)).toBeLessThan(1.35);
    });

    it("≥ 90% of individual trips", () => {
      const all = destinations.flatMap((d) => ratios(d.id));
      const within = all.filter((r) => Math.abs(r - 1) <= 0.35).length;
      expect(within / all.length).toBeGreaterThanOrEqual(0.9);
    });
  });
});

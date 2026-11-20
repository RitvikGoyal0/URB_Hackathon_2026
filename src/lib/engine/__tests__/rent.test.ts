import { describe, expect, it } from "vitest";
import { perPersonRent } from "../rent";
import type { RentBasis } from "@/lib/types";
import { makeListing } from "./fixtures";

describe("perPersonRent (spec §7.2)", () => {
  it("per_unit splits the amount equally across the group", () => {
    expect(perPersonRent(makeListing("a", { rent: { amount: 2400, basis: "per_unit" } }), 4)).toBe(600);
    expect(perPersonRent(makeListing("a", { rent: { amount: 4396, basis: "per_unit" } }), 4)).toBe(1099);
    expect(perPersonRent(makeListing("a", { rent: { amount: 1000, basis: "per_unit" } }), 3)).toBe(333);
  });

  it("per_unit: unit fees are split, per-person fees are added to each person", () => {
    const l = makeListing("a", {
      rent: {
        amount: 2400,
        basis: "per_unit",
        fees: [
          { label: "Trash", monthly: 100, scope: "per_unit" },
          { label: "Internet", monthly: 25, scope: "per_person" },
        ],
      },
    });
    expect(perPersonRent(l, 4)).toBe((2400 + 100) / 4 + 25);
  });

  it.each(["per_bedroom", "per_person"] as RentBasis[])("%s is NEVER divided by group size", (basis) => {
    const l = makeListing("a", { rent: { amount: 900, basis } });
    for (const g of [1, 2, 3, 4, 5, 6]) expect(perPersonRent(l, g)).toBe(900);
  });

  it.each(["per_bedroom", "per_person"] as RentBasis[])("%s adds per-person fees and splits only unit fees", (basis) => {
    const l = makeListing("a", {
      rent: {
        amount: 900,
        basis,
        fees: [
          { label: "Amenity", monthly: 30, scope: "per_person" },
          { label: "Utilities", monthly: 100, scope: "per_unit" },
        ],
      },
    });
    expect(perPersonRent(l, 4)).toBe(900 + 30 + 25);
  });

  it("basis matrix", () => {
    const rows: [RentBasis, number | null, number, number | null][] = [
      ["per_unit", 3000, 4, 750],
      ["per_unit", 3000, 2, 1500],
      ["per_bedroom", 750, 4, 750],
      ["per_person", 750, 2, 750],
      ["unknown", 3000, 4, null],
      ["per_unit", null, 4, null],
      ["per_bedroom", null, 4, null],
      ["per_person", null, 4, null],
      ["unknown", null, 4, null],
    ];
    for (const [basis, amount, g, expected] of rows) {
      expect(perPersonRent(makeListing("a", { rent: { amount, basis } }), g), `${basis} ${amount} ÷ ${g}`).toBe(expected);
    }
  });

  it("unknown rent is null, never 0 — even with fees", () => {
    const fees = [{ label: "Fee", monthly: 50, scope: "per_person" as const }];
    for (const basis of ["per_unit", "per_bedroom", "per_person", "unknown"] as RentBasis[]) {
      const r = perPersonRent(makeListing("a", { rent: { amount: null, basis, fees } }), 4);
      expect(r).toBeNull();
      expect(r).not.toBe(0);
    }
    expect(perPersonRent(makeListing("a", { rent: { amount: 1200, basis: "unknown", fees } }), 4)).toBeNull();
  });

  it("a non-positive group size is treated as 1", () => {
    expect(perPersonRent(makeListing("a", { rent: { amount: 2000, basis: "per_unit" } }), 0)).toBe(2000);
  });
});

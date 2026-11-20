import { describe, expect, it } from "vitest";
import { parseTime, scheduleTrips, tripsPerPlace } from "../schedule";
import type { ScheduleClass, Weekday } from "@/lib/types";

const cls = (name: string, days: Weekday[], start: string, end: string, placeId?: string, extra: Partial<ScheduleClass> = {}): ScheduleClass => ({
  name,
  days,
  start,
  end,
  placeId,
  confirmed: true,
  ...extra,
});
const MWF: Weekday[] = ["mon", "wed", "fri"];

describe("parseTime", () => {
  it("reads 24h HH:MM and rejects anything else", () => {
    expect(parseTime("09:00")).toBe(540);
    expect(parseTime("9:05")).toBe(545);
    expect(parseTime("23:59")).toBe(1439);
    for (const bad of ["24:00", "12:60", "9am", "", undefined, "12:5"]) expect(parseTime(bad)).toBeNull();
  });
});

describe("schedule trips (2-hour rule)", () => {
  it("a single class is one trip per meeting day", () => {
    expect(tripsPerPlace([cls("EECS 280", MWF, "10:00", "11:30", "eecs")])).toEqual({ eecs: 3 });
  });

  it("MWF back-to-back block counts only the first class of the day", () => {
    const c = [cls("Calc", MWF, "09:00", "09:50", "angell_hall"), cls("Physics", MWF, "10:00", "10:50", "chemistry"), cls("Lab", MWF, "11:00", "12:50", "chemistry")];
    expect(tripsPerPlace(c)).toEqual({ angell_hall: 3 });
  });

  it("a gap of exactly 2:00 counts as a new trip; 1:59 does not", () => {
    const exact = [cls("A", ["tue"], "09:00", "10:00", "union"), cls("B", ["tue"], "12:00", "13:00", "league")];
    expect(tripsPerPlace(exact)).toEqual({ union: 1, league: 1 });
    const short = [cls("A", ["tue"], "09:00", "10:00", "union"), cls("B", ["tue"], "11:59", "13:00", "league")];
    expect(tripsPerPlace(short)).toEqual({ union: 1 });
  });

  it("gap is measured from the latest end so far (overlapping classes)", () => {
    const c = [cls("Long", ["thu"], "09:00", "13:00", "a"), cls("Short", ["thu"], "09:30", "10:00", "b"), cls("Later", ["thu"], "14:30", "15:00", "c")];
    // 14:30 − 13:00 = 90 min < 120 → not a trip, even though Short ended at 10:00
    expect(tripsPerPlace(c)).toEqual({ a: 1 });
  });

  it("each day is counted on its own and order of input doesn't matter", () => {
    const c = [cls("Late", ["mon", "tue"], "15:00", "16:00", "x"), cls("Early", ["mon"], "08:00", "09:00", "y")];
    expect(tripsPerPlace(c)).toEqual({ y: 1, x: 2 }); // Mon: 08:00 then 15:00 (6h gap) → both; Tue: 15:00 first
    expect(tripsPerPlace([...c].reverse())).toEqual(tripsPerPlace(c));
  });

  it("unconfirmed, malformed and zero-length classes are ignored entirely", () => {
    const c = [
      cls("Draft", MWF, "09:00", "10:00", "a", { confirmed: false }),
      cls("Bad time", MWF, "9am", "10:00", "b"),
      cls("Backwards", MWF, "11:00", "10:00", "c"),
      cls("Real", MWF, "11:00", "12:00", "d"),
    ];
    expect(tripsPerPlace(c)).toEqual({ d: 3 });
  });

  it("falls back to the building text, and a class with no place still shapes the day's gaps", () => {
    const c = [cls("Seminar", ["wed"], "09:00", "10:00", undefined), cls("Studio", ["wed"], "10:30", "12:00", undefined, { building: "Art & Architecture" })];
    expect(tripsPerPlace(c)).toEqual({}); // Studio follows Seminar by 30 min
    expect(scheduleTrips(c)).toEqual([{ day: "wed", className: "Seminar", key: null, start: 540 }]);
    expect(tripsPerPlace([c[1]])).toEqual({ "Art & Architecture": 1 });
  });

  it("duplicate days in one class count once", () => {
    expect(tripsPerPlace([cls("Dup", ["mon", "mon"], "09:00", "10:00", "z")])).toEqual({ z: 1 });
  });

  it("empty schedule → no trips", () => {
    expect(tripsPerPlace([])).toEqual({});
  });
});

import type { ScheduleClass, Weekday } from "../types";

/**
 * Schedule trips (V3 §5.5). Pure and deterministic.
 * For each weekday, the confirmed classes are sorted by start time. A class is a trip from home
 * if it is the first class of the day, or if at least TRIP_GAP_MIN minutes have passed since the
 * previous class ended (overlaps count as "still on campus"). A place's visits per week is the
 * number of counted trips that go to it.
 */
export const TRIP_GAP_MIN = 120;

export const WEEKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** "HH:MM" (24h) → minutes after midnight, or null if it isn't a real time. */
export function parseTime(t: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export interface ScheduleTrip {
  day: Weekday;
  className: string;
  /** placeId, else the typed building name, else null (counted, but goes to no place yet) */
  key: string | null;
  start: number;
}

/** Where a class happens, for counting: its place, else its building text. */
const placeKey = (c: ScheduleClass): string | null => c.placeId ?? (c.building?.trim() ? c.building.trim() : null);

export function scheduleTrips(classes: ScheduleClass[]): ScheduleTrip[] {
  const usable = classes
    .filter((c) => c.confirmed)
    .map((c) => ({ c, start: parseTime(c.start), end: parseTime(c.end) }))
    .filter((x): x is { c: ScheduleClass; start: number; end: number } => x.start !== null && x.end !== null && x.end > x.start);

  const trips: ScheduleTrip[] = [];
  for (const day of WEEKDAYS) {
    const today = usable
      .filter((x) => new Set(x.c.days).has(day))
      .sort((a, b) => a.start - b.start || a.end - b.end || a.c.name.localeCompare(b.c.name));
    let lastEnd: number | null = null;
    for (const x of today) {
      if (lastEnd === null || x.start - lastEnd >= TRIP_GAP_MIN) trips.push({ day, className: x.c.name, key: placeKey(x.c), start: x.start });
      lastEnd = lastEnd === null ? x.end : Math.max(lastEnd, x.end);
    }
  }
  return trips;
}

/** Trips per week to each place (placeId or building text). Classes with no place aren't listed. */
export function tripsPerPlace(classes: ScheduleClass[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of scheduleTrips(classes)) if (t.key) out[t.key] = (out[t.key] ?? 0) + 1;
  return out;
}

/**
 * Schedule upload (V3 §9.2): pure helpers shared by the parse route and the review table.
 * Rule: only what's visible is kept. A missing time or building stays empty; nothing is guessed,
 * and nothing is saved until the student confirms the row.
 */
import { WEEKDAYS, parseTime, tripsPerPlace } from "./engine/schedule";
import { locationFromBuilding, MAX_VISITS, searchBuildings, DEFAULT_IMPORTANCE } from "./places";
import type { Building, MemberProfile, Place, ScheduleClass, Weekday } from "./types";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_CLASSES = 30;

/** Inline error for a picked file, or null when it's usable. */
export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return "Use a JPEG, PNG or WebP image.";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "That image is over 8 MB. Try a smaller one.";
  return null;
}

const DAY_NAMES: [string, Weekday][] = [
  ["monday", "mon"],
  ["tuesday", "tue"],
  ["wednesday", "wed"],
  ["thursday", "thu"],
  ["friday", "fri"],
  ["saturday", "sat"],
  ["sunday", "sun"],
];
const CODE: Record<string, Weekday> = { m: "mon", t: "tue", tu: "tue", w: "wed", th: "thu", r: "thu", f: "fri", sa: "sat", su: "sun" };

/** "Mon", "monday", "Thurs", "TTh", "MWF", "TuTh", ["tu","th"] → weekdays in calendar order, no duplicates. */
export function normalizeDays(input: unknown): Weekday[] {
  const parts = (Array.isArray(input) ? input : [input]).filter((x): x is string => typeof x === "string");
  const out = new Set<Weekday>();
  for (const raw of parts) {
    for (const w of raw.trim().toLowerCase().split(/[\s,/&.+-]+/).filter(Boolean)) {
      // a day name or its abbreviation ("we", "thurs", "tues")
      const name = w.length >= 2 ? DAY_NAMES.find(([full]) => full.startsWith(w)) : undefined;
      if (name) {
        out.add(name[1]);
        continue;
      }
      // compact registrar codes: M T W Th F Sa Su (R = Thursday)
      const codes = w.match(/th|tu|sa|su|m|t|w|r|f/g);
      if (codes && codes.join("") === w) for (const c of codes) out.add(CODE[c]);
    }
  }
  return WEEKDAYS.filter((d) => out.has(d));
}

/** "9:00", "09:00", "9:00 AM", "1:30pm", "13:30" → "HH:MM"; anything else → undefined. */
export function normalizeTime(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m?\.?\s*$/i.exec(input) ?? /^\s*(\d{1,2}):(\d{2})\s*$/.exec(input);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  const ap = m[3]?.toLowerCase();
  if (ap) {
    if (h < 1 || h > 12) return undefined;
    if (ap === "p" && h !== 12) h += 12;
    if (ap === "a" && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** A class row while it's being reviewed; times may be blank until filled in. */
export interface DraftClass {
  name: string;
  days: Weekday[];
  start: string;
  end: string;
  building: string;
  location?: Place["location"];
  confirmed: boolean;
}

/** Model output → draft rows. Unknown shapes are dropped; blanks stay blank. */
export function sanitizeSchedule(json: unknown): DraftClass[] {
  const list = json && typeof json === "object" && Array.isArray((json as { classes?: unknown }).classes) ? (json as { classes: unknown[] }).classes : [];
  const out: DraftClass[] = [];
  for (const item of list.slice(0, MAX_CLASSES)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    const days = normalizeDays(o.days);
    const start = normalizeTime(o.start) ?? "";
    const end = normalizeTime(o.end) ?? "";
    const building = typeof o.building === "string" ? o.building.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    if (!name && days.length === 0 && !start && !building) continue;
    out.push({ name, days, start, end, building, confirmed: false });
  }
  return out;
}

/** A row can be confirmed once it has a name, a day, and a start before its end. */
export function rowProblem(r: DraftClass): string | null {
  if (!r.name.trim()) return "Add the class name.";
  if (r.days.length === 0) return "Pick at least one day.";
  const s = parseTime(r.start);
  const e = parseTime(r.end);
  if (s === null || e === null) return "Add start and end times.";
  if (e <= s) return "End time must be after the start.";
  return null;
}

const NOT_A_PLACE = /^(tba|tbd|online|remote|arr|arranged|zoom|virtual|async|asynchronous)$/i;
const normName = (x: string) => x.toLowerCase().replace(/[^a-z0-9& ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Best known building for typed building text ("CHRYS 133", "Chrysler Center"), if any. Only
 * whole-word or (4+ letters) word-start matches count, so "TBA" never matches "Football" and
 * "DOW" never matches "Downtown".
 */
export function matchBuilding(text: string): Building | undefined {
  const cleaned = text.replace(/\b(rm|room)\b\.?/gi, " ").replace(/\b[a-z]?\d+[a-z]?\b/gi, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 2 || NOT_A_PLACE.test(cleaned)) return undefined;
  const q = normName(cleaned);
  return searchBuildings(cleaned, 3).find((b) =>
    [b.shortName, b.name, ...b.aliases]
      .map(normName)
      // short codes ("DOW", "EH") must match a whole word; longer text may match a word start ("CHRYS")
      .some((n) => n === q || n.split(" ").some((word) => (q.length < 4 ? word === q : word.startsWith(q))) || (q.length >= 4 && n.startsWith(q))),
  );
}

export const suggestLocation = (r: Pick<DraftClass, "building">): Place["location"] | undefined => {
  const b = r.building ? matchBuilding(r.building) : undefined;
  return b ? locationFromBuilding(b) : undefined;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "place";

export const classPlaceId = (loc: Place["location"]) => `class_${slug(loc.refId ?? `${loc.label}_${loc.lat.toFixed(4)}_${loc.lng.toFixed(4)}`)}`;

/**
 * Save the reviewed schedule: complete rows only (incomplete ones can't be stored), then rebuild
 * the profile's class places from the confirmed rows that have a location, counting trips with the
 * 2-hour rule. Custom places and any importance the student set on a class place are kept.
 */
export function applySchedule(profile: MemberProfile, rows: DraftClass[], now: string, image?: { dataUrl: string; updatedAt: string } | null): MemberProfile {
  const classes: ScheduleClass[] = rows
    .filter((r) => rowProblem(r) === null)
    .map((r) => ({
      name: r.name.trim(),
      days: r.days,
      start: normalizeTime(r.start)!,
      end: normalizeTime(r.end)!,
      ...(r.building.trim() ? { building: r.building.trim() } : {}),
      ...(r.location ? { location: r.location, placeId: classPlaceId(r.location) } : {}),
      confirmed: r.confirmed,
    }));
  const trips = tripsPerPlace(classes.filter((c) => c.placeId));
  const before = new Map((profile.places ?? []).map((p) => [p.id, p]));
  const classPlaces: Place[] = [];
  for (const c of classes) {
    if (!c.confirmed || !c.placeId || !c.location || classPlaces.some((p) => p.id === c.placeId)) continue;
    const visits = Math.min(MAX_VISITS, trips[c.placeId] ?? 0);
    if (visits <= 0) continue;
    classPlaces.push({
      id: c.placeId,
      name: c.location.label,
      kind: "class",
      location: c.location,
      visitsPerWeek: visits,
      importance: before.get(c.placeId)?.importance ?? DEFAULT_IMPORTANCE,
      ...(before.get(c.placeId)?.mode ? { mode: before.get(c.placeId)!.mode } : {}),
    });
  }
  const keep = (profile.places ?? []).filter((p) => p.kind !== "class");
  return {
    ...profile,
    places: [...keep, ...classPlaces],
    schedule: { classes, confirmedAt: now, image: image === undefined ? (profile.schedule?.image ?? null) : image },
  };
}

/** Rows for editing a saved schedule. */
export const draftsFromSchedule = (classes: ScheduleClass[]): DraftClass[] =>
  classes.map((c) => ({ name: c.name, days: c.days, start: c.start, end: c.end, building: c.building ?? "", location: c.location, confirmed: c.confirmed }));

export const emptyClass = (): DraftClass => ({ name: "", days: [], start: "", end: "", building: "", confirmed: false });

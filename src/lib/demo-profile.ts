/**
 * The stage profile ("Alex"), built exactly the way the presenter builds it on stage
 * (docs/demo-walkthrough.md), from the cached demo parse (no network call):
 *
 *   1. Your week: name "Alex", the "North Campus aerospace engineer" example sentence → Read my week.
 *   2. Check it: no follow-up questions → Confirm all.
 *   3. Roommate search: Actively looking, major "Aerospace Engineering", club "MRacing",
 *      email, consent box.
 *   4. About you: "Where is MRacing?" → Wilson Student Team Project Center, 3×/wk, Bike, High.
 *      Upload a screenshot → public/demo/alex-schedule.png (read from its known rows, no AI call)
 *      → Use each suggested building and confirm all six classes → Save schedule.
 *   5. Quick picks: More space at home → Lower rent → A room of my own (the quiet/social and
 *      cooking questions are skipped because the sentence answered them).
 *
 * The hidden /demo page's "Load demo profile" uses this, and the walkthrough tests lock the result.
 */
import { defaultLivePersona, getBuilding } from "./data";
import { lookupCachedParse } from "./ai/cache";
import {
  EXAMPLE_PROMPTS,
  applyThisOrThatAnswer,
  buildFollowUps,
  confirmAll,
  effectiveProfile,
  neutralProfile,
  parseToProfile,
  selectThisOrThat,
  setTravelMode,
  type ThisOrThat,
  type ThisOrThatAnswer,
} from "./onboarding";
import { applySchedule, suggestLocation, type DraftClass } from "./schedule-import";
import { demoScheduleRows } from "./demo-schedule";
import type { MemberProfile, Place, TravelMode } from "./types";

/** The first example chip on the "Your week" step. */
export const DEMO_SENTENCE = EXAMPLE_PROMPTS[0].text;
export const DEMO_NAME = "Alex";
export const DEMO_MAJOR = "Aerospace Engineering";
export const DEMO_CLUB = "MRacing";

/** Quick-pick answers, by question. Questions the sentence already answered are skipped. */
export const DEMO_ANSWERS: Partial<Record<ThisOrThat["id"], ThisOrThatAnswer>> = {
  closer_space: "b", // More space at home
  rent_amenities: "a", // Lower rent
  private_cheaper: "a", // A room of my own
};

/** Placeholder contact for the stage profile (consent already given). */
export const DEMO_CONTACT = { email: "alexhtl@umich.edu", phone: "7345550100", consentAt: "2026-11-20T09:00:00.000Z" } as const;

export function mracingPlace(): Place {
  const wilson = getBuilding("wilson_center");
  if (!wilson) throw new Error("wilson_center missing from buildings.umich.json");
  return {
    id: "place_mracing",
    name: DEMO_CLUB,
    kind: "custom",
    location: { source: "building", refId: wilson.id, label: wilson.name, lat: wilson.lat, lng: wilson.lng },
    visitsPerWeek: 3,
    importance: 3,
    // Bike is picked in the wizard, but it equals the profile's mode, so the app stores no override.
  };
}

/** The six demo classes after review: each building confirmed as suggested, each row confirmed. */
export function demoScheduleConfirmed(): DraftClass[] {
  return demoScheduleRows().map((r) => ({ ...r, location: suggestLocation(r), confirmed: true }));
}
export const DEMO_SCHEDULE_SAVED_AT = "2026-11-20T09:05:00.000Z";

/** Alex as the app stores it after onboarding. `mode` overrides the travel mode (for what-if tests). */
export function buildDemoProfile(mode?: TravelMode): MemberProfile {
  const parse = lookupCachedParse(DEMO_SENTENCE);
  if (!parse) throw new Error("The demo sentence is missing from demo-parse-cache.json");
  if (buildFollowUps(parse, { budgetProvided: false }).length > 0) throw new Error("The demo sentence should need no follow-up questions");
  let p = parseToProfile(parse, neutralProfile(defaultLivePersona, DEMO_NAME));
  p = confirmAll(p);
  if (mode) p = setTravelMode(p, mode);
  p = {
    ...p,
    roommateStatus: "looking",
    contact: { ...DEMO_CONTACT },
    major: DEMO_MAJOR,
    organizations: [DEMO_CLUB],
    places: [mracingPlace()],
  };
  p = applySchedule(p, demoScheduleConfirmed(), DEMO_SCHEDULE_SAVED_AT, null);
  for (const q of selectThisOrThat(parse).ask) p = applyThisOrThatAnswer(p, q, DEMO_ANSWERS[q.id] ?? "skip");
  return effectiveProfile(p);
}

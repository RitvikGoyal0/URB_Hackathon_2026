/**
 * The stage profile for the hidden /demo page (V3 §10, §12). Built on the server from the cached
 * demo parse (no network call), then the "About you" step: Engineering, MRacing at the Wilson
 * Center, 3×/wk by bus, high importance. Every detail is confirmed, as if the presenter had
 * reviewed it. This-or-that is skipped (default weights).
 */
import { defaultLivePersona, getBuilding } from "./data";
import { lookupCachedParse } from "./ai/cache";
import { addDestination, buildFollowUps, confirmAll, effectiveProfile, neutralProfile, parseToProfile, setTravelMode } from "./onboarding";
import type { MemberProfile, Place, TravelMode } from "./types";

export const DEMO_SENTENCE =
  "I'm an engineering student at Michigan. I'm on North Campus most weekdays, have evening club meetings, don't have a car, enjoy cooking with friends, and want housing under $1,150 a month.";

export function mracingPlace(): Place {
  const wilson = getBuilding("wilson_center");
  if (!wilson) throw new Error("wilson_center missing from buildings.umich.json");
  return {
    id: "place_mracing",
    name: "MRacing",
    kind: "custom",
    location: { source: "building", refId: wilson.id, label: wilson.name, lat: wilson.lat, lng: wilson.lng },
    visitsPerWeek: 3,
    importance: 3,
    mode: "bus",
  };
}

export function buildDemoProfile(mode: TravelMode = "bus"): MemberProfile {
  const parse = lookupCachedParse(DEMO_SENTENCE);
  if (!parse) throw new Error("The demo sentence is missing from demo-parse-cache.json");
  let p = parseToProfile(parse, neutralProfile(defaultLivePersona, "Maya"));
  for (const f of buildFollowUps(parse, { budgetProvided: false })) {
    if (f.kind === "place" && f.suggestedDestinationId) p = addDestination(p, f.suggestedDestinationId, 2, f.placeText);
    if (f.kind === "travelMode") p = setTravelMode(p, mode);
  }
  p = confirmAll(p);
  p = { ...p, major: "Engineering", organizations: ["MRacing"], places: [mracingPlace()] };
  return effectiveProfile(p);
}

import type { CampusDestination } from "../types";

/** System prompt contract (spec §8.2). Only ids + names of the destination registry are sent. */
export function buildSystemPrompt(destinations: CampusDestination[]): string {
  const registry = destinations.map((d) => `- ${d.id}: ${d.name}`).join("\n");
  return `You extract a student's housing preferences from their own description, for a University of Michigan (Ann Arbor) housing tool.

Return ONLY JSON matching the provided schema. Rules:
1. Extract only what the text explicitly states or clearly implies. Never invent facts.
2. Map places ONLY to these destination ids:
${registry}
   Anything else the student mentions going to (club meetings, a job, a gym, "downtown", a friend's place) goes in "unmappedPlaces" with a short clarifying "question" (e.g. "Where do your club meetings happen?") and, if one registry place is a likely answer, its id as "suggestedDestinationId".
3. "visitsPerWeek": convert phrases like "most weekdays" → 4, "every day" → 5, "twice a week" → 2. Omit if not stated.
4. NEVER invent a budget. Only set "budgetMax" if a dollar amount for rent is written in the text; use the monthly number.
5. "travelMode" is one of walk | bike | drive | bus. If the student says they have no car but does not say how they get around, omit "travelMode" and set "travelModeOptions" to the plausible options (e.g. ["bus","walk"]). Set "hasCar" only if car ownership is stated.
6. Lifestyle: noise quiet|social|either, cooking high|medium|low, guests rare|sometimes|often — only when the text supports it.
7. Requirements (privateBedroom, parking, inUnitLaundry) only when stated as needs. Nice-to-haves go in "desiredAmenities" using only these keys: inUnitLaundry, dishwasher, parking, furnished, largeKitchen, socialAmenities, quietBuilding, petFriendly, ac. (Loving to cook with friends may imply largeKitchen as a nice-to-have.)
8. Every extracted field needs "sourceText": a short exact quote from the student's text that supports it, and "confidence" 0–1.
9. "missing": list "budget", "travelMode" and/or "destinations" if they are absent (travelMode counts as missing only when travelModeOptions is also absent).`;
}

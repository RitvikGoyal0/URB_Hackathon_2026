import { getDestination } from "@/lib/data";
import type { Dim, FeatureKey, MemberProfile, Requirements } from "@/lib/types";
import { DIMS } from "@/lib/types";
import { DIM_LABEL, money } from "@/components/shared/format";

export interface GroupInsights {
  shared: string[];
  differences: string[];
  nonNegotiables: string[];
  bindingMemberId: string | null;
}

const list = (names: string[]) =>
  names.length <= 1 ? names.join("") : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

const WANT_PHRASE: Record<FeatureKey, string> = {
  inUnitLaundry: "in-unit laundry",
  dishwasher: "a dishwasher",
  parking: "parking",
  furnished: "a furnished place",
  largeKitchen: "a full kitchen",
  socialAmenities: "social spaces",
  quietBuilding: "a quiet building",
  petFriendly: "a pet-friendly place",
  ac: "air conditioning",
};

const MODE_VERB = {
  walk: ["walks", "walk"],
  bike: ["bikes", "bike"],
  bus: ["takes the bus", "take the bus"],
  drive: ["drives", "drive"],
} as const;

const REQ_PHRASE: Record<keyof Requirements, string> = {
  privateBedroom: "a private bedroom",
  parking: "parking",
  inUnitLaundry: "in-unit laundry",
};

function topDim(m: MemberProfile): Dim {
  return DIMS.reduce((best, d) => (m.weights[d] > m.weights[best] ? d : best), DIMS[0]);
}

function mainDestination(m: MemberProfile) {
  return [...m.destinations].sort((a, b) => b.visitsPerWeek * b.importance - a.visitsPerWeek * a.importance)[0];
}

/** Derived only from the structured profiles — no hardcoded narrative. */
export function deriveInsights(members: MemberProfile[]): GroupInsights {
  const n = members.length;
  const shared: string[] = [];
  const differences: string[] = [];
  const nonNegotiables: string[] = [];

  // Shared amenities
  const counts = new Map<FeatureKey, MemberProfile[]>();
  for (const m of members) for (const a of m.desiredAmenities) counts.set(a, [...(counts.get(a) ?? []), m]);
  const amen = [...counts.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [f, who] of amen.slice(0, 2)) {
    if (who.length === n) shared.push(`Everyone wants ${WANT_PHRASE[f]}`);
    else if (who.length >= Math.ceil(n / 2)) shared.push(`${list(who.map((m) => m.displayName))} want ${WANT_PHRASE[f]}`);
  }
  // Cooking
  const cooks = members.filter((m) => m.lifestyle.cooking === "high");
  if (cooks.length >= 2) shared.push(`${list(cooks.map((m) => m.displayName))} cook a lot, so kitchen size matters`);
  // Shared destination
  const destCounts = new Map<string, number>();
  for (const m of members) for (const d of m.destinations) destCounts.set(d.destinationId, (destCounts.get(d.destinationId) ?? 0) + 1);
  const [topDest] = [...destCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (topDest && topDest[1] >= 2) {
    const name = getDestination(topDest[0])?.shortName ?? topDest[0];
    shared.push(topDest[1] === n ? `${name} is on everyone's schedule` : `${name} is on ${topDest[1]} of ${n} schedules`);
  }
  // Top priority
  const dimCounts = new Map<Dim, number>();
  for (const m of members) dimCounts.set(topDim(m), (dimCounts.get(topDim(m)) ?? 0) + 1);
  const [topD] = [...dimCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (topD && topD[1] >= 2) shared.push(`${DIM_LABEL[topD[0]]} is the top priority for ${topD[1]} of ${n}`);

  // Differences: noise
  const quiet = members.filter((m) => m.lifestyle.noise === "quiet");
  const social = members.filter((m) => m.lifestyle.noise === "social");
  if (quiet.length && social.length)
    differences.push(`${list(quiet.map((m) => m.displayName))} want${quiet.length === 1 ? "s" : ""} quiet; ${list(social.map((m) => m.displayName))} want${social.length === 1 ? "s" : ""} a social place`);
  // Differences: where people go
  const mains = members.map((m) => ({ m, d: mainDestination(m) })).filter((x) => x.d);
  const majority = topDest?.[0];
  for (const { m, d } of mains) {
    if (d && d.destinationId !== majority) {
      const name = getDestination(d.destinationId)?.shortName ?? d.destinationId;
      differences.push(
        m.isLiveUser ? `${m.displayName} is at ${name} ${d.visitsPerWeek}× a week, away from the others` : `${m.displayName} is mostly at ${name}`,
      );
    }
  }
  // Differences: modes
  const modes = new Map<string, string[]>();
  for (const m of members) modes.set(m.travelMode, [...(modes.get(m.travelMode) ?? []), m.displayName]);
  if (modes.size > 1)
    differences.push(
      [...modes.entries()].map(([mode, names]) => `${list(names)} ${MODE_VERB[mode as keyof typeof MODE_VERB][names.length === 1 ? 0 : 1]}`).join(", "),
    );
  // Budget spread
  const budgets = members.map((m) => m.budgetMax);
  const minB = Math.min(...budgets);
  const maxB = Math.max(...budgets);
  if (maxB - minB >= 100) differences.push(`Budgets range from ${money(minB)} to ${money(maxB)} a month`);

  // Non-negotiables
  for (const m of members) {
    for (const k of Object.keys(REQ_PHRASE) as (keyof Requirements)[]) {
      if (m.requirements[k]) nonNegotiables.push(`${m.displayName} needs ${REQ_PHRASE[k]}`);
    }
  }
  const binding = members.reduce<MemberProfile | null>((lo, m) => (!lo || m.budgetMax < lo.budgetMax ? m : lo), null);
  if (binding) {
    nonNegotiables.push(
      `${binding.displayName}'s ${money(binding.budgetMax)} ${binding.budgetIsHardCap ? "cap" : "budget"} is the binding constraint`,
    );
  }
  for (const m of members) {
    if (m.budgetIsHardCap && m.id !== binding?.id) nonNegotiables.push(`${m.displayName}'s ${money(m.budgetMax)} cap is a hard limit`);
  }

  return { shared, differences, nonNegotiables, bindingMemberId: binding?.id ?? null };
}

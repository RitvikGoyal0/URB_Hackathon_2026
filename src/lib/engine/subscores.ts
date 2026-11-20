/**
 * Per-member subscores (spec §7.4). Internal module: rank.ts / explain.ts consume it.
 * Every function is pure and deterministic. A subscore is `null` when it cannot be
 * computed; `nullCause` records whether that is because listing data is missing
 * (counts against coverage) or because the member has no preference to test.
 */
import type {
  CampusDestination,
  CommuteMatrix,
  Destination,
  FeatureKey,
  Listing,
  MemberProfile,
  MemberResult,
  RoutedMode,
  Subscore,
  TravelMode,
} from "../types";
import { estimateTrip } from "./estimate";
import {
  AFFORD_AT_BUDGET_SCORE,
  AFFORD_FULL_MARKS_RATIO,
  BATHS_PER_PERSON_FULL,
  DETOUR_FACTOR,
  COMMUTE_FULL_MARKS_MIN,
  COMMUTE_ZERO_MIN,
  LIFESTYLE,
  LIFESTYLE_BASE,
  SPACE_WEIGHTS,
  SQFT_PER_PERSON_FULL,
  SQFT_PER_PERSON_ZERO,
} from "./constants";
import { FEATURE_LABEL, bedroomsPhrase, capitalize, clamp, humanizeId, int, joinList, money, prov, round1 } from "./format";

export type NullCause = "missing_data" | "no_preference";

export interface Scored extends Subscore {
  nullCause?: NullCause;
}

const nullScore = (cause: NullCause, reason: string, evidence: string[] = []): Scored => ({
  score: null,
  reason,
  evidence,
  nullCause: cause,
});

// ---------------------------------------------------------------- affordability

export function affordabilityCurve(rent: number, budget: number): number {
  const ratio = rent / budget;
  if (ratio <= AFFORD_FULL_MARKS_RATIO) return 100;
  if (ratio <= 1) {
    return 100 - ((ratio - AFFORD_FULL_MARKS_RATIO) / (1 - AFFORD_FULL_MARKS_RATIO)) * (100 - AFFORD_AT_BUDGET_SCORE);
  }
  return 0;
}

/** Evidence lines describing how per-person rent was derived. Shared by every member. */
/** `groupSize` here is the per-room divisor (bedrooms, a studio = 1). */
export function rentEvidence(listing: Listing, rent: number | null, groupSize: number): string[] {
  const r = listing.rent;
  const out: string[] = [];
  const size = Math.max(1, groupSize);
  if (rent === null || r.amount === null) {
    out.push(
      r.amount === null || !Number.isFinite(r.amount)
        ? "Rent not published — contact for pricing (never treated as $0)"
        : r.basis === "unknown"
          ? `Rent basis unknown (${money(r.amount)} listed without per-unit/per-bed basis) — contact for pricing`
          : `Fee data incomplete for the ${money(r.amount)} listed rent — contact for pricing`,
    );
  } else {
    const unitFees = r.fees.filter((f) => f.scope === "per_unit");
    const personFees = r.fees.filter((f) => f.scope === "per_person");
    const unitSum = unitFees.reduce((s, f) => s + f.monthly, 0);
    const personSum = personFees.reduce((s, f) => s + f.monthly, 0);
    let line: string;
    if (r.basis === "per_unit") {
      line = `${money(r.amount)}/unit${unitSum ? ` + ${money(unitSum)} unit fees` : ""} ÷ ${size} ${size === 1 ? "room" : "rooms"}${
        personSum ? ` + ${money(personSum)} per-person fees` : ""
      } = ${money(rent)}/room`;
    } else {
      const unit = r.basis === "per_bedroom" ? "bed" : "person";
      line = `${money(r.amount)}/${unit} (as listed)${personSum ? ` + ${money(personSum)} per-person fees` : ""}${
        unitSum ? ` + ${money(unitSum)} unit fees ÷ ${size}` : ""
      } = ${money(rent)}/person`;
    }
    out.push(`${line} — ${prov(r.provenance)}`);
    for (const f of r.fees) out.push(`Fee: ${f.label} ${money(f.monthly)}/mo (${f.scope === "per_unit" ? "per unit, split" : "per person"})`);
    if (r.amountMax !== undefined && r.amountMax > r.amount) {
      out.push(`Listed as a range up to ${money(r.amountMax)}; scored on the lower figure`);
    }
  }
  if (r.secondary) {
    out.push(`${r.secondary.label}: ${money(r.secondary.min)}–${money(r.secondary.max)} (${r.secondary.basis.replace("_", " ")}, shown for reference)`);
  }
  if (r.utilitiesIncluded === true) out.push("Utilities included");
  else if (r.utilitiesIncluded === false) out.push(`Rent excludes utilities${r.fees.length === 0 ? " (no utility fee data)" : ""}`);
  else out.push("Utilities: unverified");
  return out;
}

export function scoreAffordability(
  listing: Listing,
  member: MemberProfile,
  rent: number | null,
  groupSize: number,
): Scored {
  const evidence = rentEvidence(listing, rent, groupSize);
  if (rent === null) {
    return nullScore("missing_data", "Contact for pricing — rent not published, so affordability is unverified (not scored).", evidence);
  }
  if (!(member.budgetMax > 0)) {
    return nullScore("no_preference", "No budget set — affordability not scored.", evidence);
  }
  const score = round1(affordabilityCurve(rent, member.budgetMax));
  const pct = Math.round((rent / member.budgetMax) * 100);
  const utilities = listing.rent.utilitiesIncluded === false ? "; excludes utilities" : "";
  const reason =
    rent > member.budgetMax
      ? `${money(rent)}/person exceeds ${member.displayName}'s ${money(member.budgetMax)} budget by ${money(rent - member.budgetMax)}/mo${utilities}.`
      : `${money(rent)}/person is ${pct}% of ${member.displayName}'s ${money(member.budgetMax)} budget${utilities}.`;
  return { score, reason, evidence };
}

// ---------------------------------------------------------------- commute

export function commuteCurve(minutes: number): number {
  if (minutes <= COMMUTE_FULL_MARKS_MIN) return 100;
  if (minutes >= COMMUTE_ZERO_MIN) return 0;
  return ((COMMUTE_ZERO_MIN - minutes) / (COMMUTE_ZERO_MIN - COMMUTE_FULL_MARKS_MIN)) * 100;
}

const MODE_WORD: Record<TravelMode, string> = { walk: "walk", bike: "bike ride", drive: "drive", bus: "bus ride" };

export interface CommuteScored extends Scored {
  commutes: MemberResult["commutes"];
}

export function destinationWeight(visitsPerWeek: number, importance: number): number {
  return (Number.isFinite(visitsPerWeek) ? Math.max(0, visitsPerWeek) : 0) * importance;
}

type Trip = Pick<Destination, "visitsPerWeek" | "importance">;

/**
 * The weight each of a member's trips (campus areas + places) carries in their commute score:
 * visits/week × importance, or importance alone when EVERY trip has 0 visits. scoreCommute, the
 * explanation templates and "What changed?" all use this, so a destination that contributes
 * nothing to the score is never named as a strength or a drawback.
 */
export function destinationWeigher(member: MemberProfile): (d: Trip) => number {
  const all: Trip[] = [...member.destinations, ...(member.places ?? [])];
  const importanceOnly = all.every((d) => destinationWeight(d.visitsPerWeek, d.importance) === 0);
  return (d) => (importanceOnly ? d.importance : destinationWeight(d.visitsPerWeek, d.importance));
}

export interface DestInfo {
  name: string;
  lat?: number;
  lng?: number;
}

/**
 * Commute (V3 §5.4). For every campus area and located place, in the member's mode:
 * - walk / bike / drive to a campus area: routed OSRM time from the committed matrix;
 * - bus anywhere, and every mode to a custom/class place: distance estimate (estimate.ts),
 *   labelled "est."; a bus rider whose bus would be slower than walking gets the walk time.
 * Score: 100 at ≤ 10 min, 0 at ≥ 40 min, weighted by visits/week × importance.
 */
export function scoreCommute(
  listing: Listing,
  member: MemberProfile,
  matrix: CommuteMatrix,
  destInfo: Map<string, DestInfo>,
): CommuteScored {
  const commutes: MemberResult["commutes"] = [];
  const places = member.places ?? [];
  if (member.destinations.length === 0 && places.length === 0) {
    return { ...nullScore("no_preference", "No regular destinations set — commute not scored."), commutes };
  }
  const origin = matrix.origins?.[listing.id];
  const rows: { w: number; s: number; part: string; order: number }[] = [];
  const evidence: string[] = [];
  let anyEstimated = false;
  let anyWalkFaster = false;
  const weightOf = destinationWeigher(member);

  const trip = (id: string, name: string, mode: TravelMode, d: Trip, order: number, to: { lat?: number; lng?: number } | null, custom: boolean) => {
    let minutes: number | null = null;
    let estimated = false;
    let usedMode: TravelMode = mode;
    let note: string | undefined;
    const cell = !custom && mode !== "bus" ? matrix.matrix[listing.id]?.[id]?.[mode as RoutedMode] : undefined;
    if (cell && Number.isFinite(cell.minutes)) {
      minutes = cell.minutes;
      estimated = cell.estimated;
      evidence.push(`${name}: ${cell.minutes.toFixed(1)} min ${mode}, ${(cell.meters / 1000).toFixed(1)} km — ${cell.estimated ? "est. (straight-line)" : matrix.provider}`);
    } else if (origin && to && to.lat !== undefined && to.lng !== undefined) {
      const e = estimateTrip(origin, { lat: to.lat, lng: to.lng }, mode);
      if (e) {
        minutes = e.minutes;
        estimated = true;
        usedMode = e.mode;
        if (e.walkingFaster) {
          note = `Walking is faster (${Math.round(e.minutes)} min)`;
          anyWalkFaster = true;
        }
        evidence.push(`${name}: ~${e.minutes.toFixed(1)} min ${e.mode} (est. from ${e.km.toFixed(1)} km by road)`);
      }
    }
    commutes.push({ destinationId: id, ...(custom ? { name } : {}), mode: usedMode, minutes, estimated, visitsPerWeek: d.visitsPerWeek, ...(note ? { note } : minutes === null ? { note: "No travel time available" } : {}) });
    if (minutes === null) {
      evidence.push(`${name}: no travel time — excluded`);
      return;
    }
    if (estimated) anyEstimated = true;
    rows.push({
      w: weightOf(d),
      s: commuteCurve(minutes),
      order,
      part: `${name}: ${estimated ? "~" : ""}${int(minutes)}-min ${MODE_WORD[usedMode]}${estimated ? " (est.)" : ""}, ${d.visitsPerWeek}×/wk`,
    });
  };

  member.destinations.forEach((d, i) => {
    const info = destInfo.get(d.destinationId);
    trip(d.destinationId, info?.name ?? humanizeId(d.destinationId), member.travelMode, d, i, info ?? null, false);
  });
  places.forEach((p, i) => trip(p.id, p.name, p.mode ?? member.travelMode, p, member.destinations.length + i, p.location, true));

  const totalW = rows.reduce((s, r) => s + r.w, 0);
  if (rows.length === 0) {
    return { ...nullScore("missing_data", "No travel times available for this listing — commute not scored.", evidence), commutes };
  }
  if (totalW <= 0) {
    return { ...nullScore("missing_data", "No travel times for the destinations visited each week — commute not scored.", evidence), commutes };
  }
  const score = rows.reduce((s, r) => s + r.w * r.s, 0) / totalW;
  const parts = [...rows].sort((a, b) => b.w - a.w || a.order - b.order).map((r) => r.part);
  let reason = `${parts.join("; ")}.`;
  if (anyWalkFaster) reason += " Some trips are short enough that walking beats waiting for a bus.";
  if (anyEstimated) evidence.push(`Times marked est. are distance estimates (×${DETOUR_FACTOR} for streets), not routed`);
  if (member.travelMode === "drive" && !member.hasCar) evidence.push("Drive times assume car access; profile says no car");
  evidence.push("Each destination weighted by visits/week × importance; 100 at ≤10 min, 0 at ≥40 min");
  return { score: round1(score), reason, evidence, commutes };
}

/** One-way average for display: Σ(minutes × visits) / Σ visits over trips with a time. */
export function averageCommute(commutes: MemberResult["commutes"]): { minutes: number | null; counted: number; total: number; estimated: boolean } {
  const usable = commutes.filter((c) => c.minutes !== null && c.visitsPerWeek > 0);
  const visits = usable.reduce((s, c) => s + c.visitsPerWeek, 0);
  const total = commutes.filter((c) => c.visitsPerWeek > 0).length;
  if (visits <= 0) return { minutes: null, counted: 0, total, estimated: false };
  const m = usable.reduce((s, c) => s + (c.minutes as number) * c.visitsPerWeek, 0) / visits;
  return { minutes: Math.round(m), counted: usable.length, total, estimated: usable.some((c) => c.estimated) };
}

// ---------------------------------------------------------------- amenities

export interface AmenityScored extends Scored {
  met: FeatureKey[];
  missing: FeatureKey[];
  unverified: FeatureKey[];
}

export function scoreAmenities(listing: Listing, member: MemberProfile): AmenityScored {
  const desired = [...new Set(member.desiredAmenities)];
  const met: FeatureKey[] = [];
  const missing: FeatureKey[] = [];
  const unverified: FeatureKey[] = [];
  if (desired.length === 0) {
    return { ...nullScore("no_preference", "No nice-to-have amenities listed — not scored."), met, missing, unverified };
  }
  const p = prov(listing.provenance);
  const evidence: string[] = [];
  for (const k of desired) {
    const v = listing.features[k];
    const label = capitalize(FEATURE_LABEL[k]);
    if (v === true) {
      met.push(k);
      evidence.push(`${label}: yes — ${p}`);
    } else if (v === false) {
      missing.push(k);
      evidence.push(`${label}: no — ${p}`);
    } else {
      unverified.push(k);
      evidence.push(`${label}: not stated (unverified) — counted as not met`);
    }
  }
  const score = round1((met.length / desired.length) * 100);
  const bits: string[] = [`Has ${met.length} of ${desired.length} wanted`];
  if (met.length) bits[0] += `: ${joinList(met.map((k) => FEATURE_LABEL[k]))}`;
  if (missing.length) bits.push(`missing ${joinList(missing.map((k) => FEATURE_LABEL[k]))}`);
  if (unverified.length) bits.push(`${joinList(unverified.map((k) => FEATURE_LABEL[k]))} unverified (counted as not met)`);
  return { score, reason: `${bits.join("; ")}.`, evidence, met, missing, unverified };
}

// ---------------------------------------------------------------- lifestyle

export interface LifestyleRule {
  feature: FeatureKey;
  /** false = the feature is unknown; rule contributes nothing and is listed as unverified */
  evaluated: boolean;
  delta: number;
  text: string;
  /** short noun phrase for summaries, e.g. "shared cooking" */
  short: string;
}

export function lifestyleRules(member: MemberProfile, listing: Listing): LifestyleRule[] {
  const f = listing.features;
  const ls = member.lifestyle;
  const rules: LifestyleRule[] = [];
  const add = (feature: FeatureKey, value: boolean | null, yes: [number, string], no: [number, string] | null, short: string) => {
    if (value === null) {
      rules.push({ feature, evaluated: false, delta: 0, text: `${FEATURE_LABEL[feature]} unverified`, short });
    } else if (value) {
      rules.push({ feature, evaluated: true, delta: yes[0], text: yes[1], short });
    } else if (no) {
      rules.push({ feature, evaluated: true, delta: no[0], text: no[1], short });
    } else {
      rules.push({ feature, evaluated: true, delta: 0, text: "", short });
    }
  };
  if (ls.noise === "quiet") {
    add(
      "quietBuilding",
      f.quietBuilding,
      [LIFESTYLE.quietBuildingMatch, "quiet building suits a quiet routine"],
      [LIFESTYLE.quietBuildingMiss, "building isn't described as quiet"],
      "a quiet building",
    );
    if (listing.housingType === "high_rise") {
      add("socialAmenities", f.socialAmenities, [LIFESTYLE.quietHighRiseSocial, "busy high-rise with social amenities"], null, "a quiet building");
    }
  } else if (ls.noise === "social") {
    add(
      "socialAmenities",
      f.socialAmenities,
      [LIFESTYLE.socialMatch, "social amenities for a social household"],
      [LIFESTYLE.socialMiss, "no social amenities listed"],
      "social space",
    );
  }
  if (ls.cooking === "high") {
    add(
      "largeKitchen",
      f.largeKitchen,
      [LIFESTYLE.cookHighMatch, "large kitchen for frequent cooking"],
      [LIFESTYLE.cookHighMiss, "kitchen isn't described as large, for someone who cooks a lot"],
      "shared cooking",
    );
  } else if (ls.cooking === "medium") {
    add(
      "largeKitchen",
      f.largeKitchen,
      [LIFESTYLE.cookMediumMatch, "large kitchen"],
      [LIFESTYLE.cookMediumMiss, "kitchen isn't described as large"],
      "cooking",
    );
  }
  if (ls.guests === "often") {
    add(
      "socialAmenities",
      f.socialAmenities,
      [LIFESTYLE.guestsOftenMatch, "shared spaces for hosting guests"],
      [LIFESTYLE.guestsOftenMiss, "few shared spaces for hosting"],
      "hosting",
    );
  }
  return rules;
}

export function scoreLifestyle(listing: Listing, member: MemberProfile): Scored {
  const rules = lifestyleRules(member, listing);
  if (rules.length === 0) {
    return nullScore("no_preference", "No strong noise, cooking or guest preferences to test — not scored.");
  }
  const evaluated = rules.filter((r) => r.evaluated);
  const unverified = [...new Set(rules.filter((r) => !r.evaluated).map((r) => FEATURE_LABEL[r.feature]))];
  const p = prov(listing.provenance);
  const evidence = rules.map((r) =>
    r.evaluated
      ? `${capitalize(FEATURE_LABEL[r.feature])}: ${listing.features[r.feature] ? "yes" : "no"} — ${p} (${r.delta >= 0 ? "+" : ""}${r.delta})`
      : `${capitalize(FEATURE_LABEL[r.feature])}: not stated (unverified) — no credit given`,
  );
  if (evaluated.length === 0) {
    return nullScore("missing_data", `Can't assess: ${joinList(unverified)} unverified.`, evidence);
  }
  const score = round1(clamp(LIFESTYLE_BASE + evaluated.reduce((s, r) => s + r.delta, 0), 0, 100));
  const texts = [...evaluated]
    .filter((r) => r.text)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .map((r) => r.text);
  let reason = texts.length ? capitalize(texts.join("; ")) : "No lifestyle signals either way";
  if (unverified.length) reason += `; ${joinList(unverified)} unverified`;
  evidence.push(`Lifestyle = 50 + rule adjustments, clamped 0–100`);
  return { score, reason: `${reason}.`, evidence };
}

// ---------------------------------------------------------------- space

export interface SpacePart {
  key: "bedroom" | "bath" | "sqft";
  score: number | null;
  text: string;
}

export function spaceParts(listing: Listing, member: MemberProfile, groupSize: number): SpacePart[] {
  const g = Math.max(1, groupSize);
  const parts: SpacePart[] = [];
  // bedroom availability for this member
  if (member.requirements.privateBedroom) {
    if (listing.bedrooms < g) parts.push({ key: "bedroom", score: 0, text: `${listing.bedrooms <= 0 ? bedroomsPhrase(listing.bedrooms) : `only ${bedroomsPhrase(listing.bedrooms)}`} for ${g}, so no private room` });
    else if (listing.privateBedrooms === false) parts.push({ key: "bedroom", score: 0, text: "bedrooms are shared, so no private room" });
    else if (listing.privateBedrooms === null) parts.push({ key: "bedroom", score: null, text: "private bedroom unverified" });
    else parts.push({ key: "bedroom", score: 100, text: "private bedroom available" });
  } else {
    const ratio = Math.min(1, listing.bedrooms / g);
    parts.push({
      key: "bedroom",
      score: ratio * 100,
      text:
        listing.bedrooms <= 0
          ? `${bedroomsPhrase(listing.bedrooms)} for ${g}`
          : ratio >= 1
            ? `own bedroom (${listing.bedrooms} BR for ${g})`
            : `shared bedrooms (${listing.bedrooms} BR for ${g})`,
    });
  }
  const bpp = listing.bathrooms / g;
  parts.push({
    key: "bath",
    score: Math.min(1, bpp / BATHS_PER_PERSON_FULL) * 100,
    text: `${bpp.toFixed(2).replace(/0$/, "")} baths/person`,
  });
  if (listing.sqft !== undefined && listing.sqft > 0) {
    const spp = listing.sqft / g;
    parts.push({
      key: "sqft",
      score: clamp((spp - SQFT_PER_PERSON_ZERO) / (SQFT_PER_PERSON_FULL - SQFT_PER_PERSON_ZERO), 0, 1) * 100,
      text: `${int(spp)} sq ft/person`,
    });
  } else {
    parts.push({ key: "sqft", score: null, text: "sq ft not listed" });
  }
  return parts;
}

export function scoreSpace(listing: Listing, member: MemberProfile, groupSize: number): Scored {
  const parts = spaceParts(listing, member, groupSize);
  const known = parts.filter((p) => p.score !== null);
  const evidence = [
    `${listing.bedrooms} BR, ${listing.bathrooms} BA${listing.sqft ? `, ${int(listing.sqft)} sq ft` : ""} — ${prov(listing.provenance)}`,
    `Space = bedroom ${SPACE_WEIGHTS.bedroom} · baths/person ${SPACE_WEIGHTS.bath} (full at ≥${BATHS_PER_PERSON_FULL}) · sq ft/person ${SPACE_WEIGHTS.sqft} (full at ≥${SQFT_PER_PERSON_FULL}); unknown parts dropped`,
  ];
  if (known.length === 0) return nullScore("missing_data", "Space data missing.", evidence);
  const wSum = known.reduce((s, p) => s + SPACE_WEIGHTS[p.key], 0);
  const score = round1(known.reduce((s, p) => s + SPACE_WEIGHTS[p.key] * (p.score as number), 0) / wSum);
  return { score, reason: `${capitalize(parts.map((p) => p.text).join("; "))}.`, evidence };
}

export function destinationNameMap(destinations: CampusDestination[]): Map<string, string> {
  return new Map(destinations.map((d) => [d.id, d.shortName || d.name]));
}

export function destinationInfoMap(destinations: CampusDestination[]): Map<string, DestInfo> {
  return new Map(destinations.map((d) => [d.id, { name: d.shortName || d.name, lat: d.lat, lng: d.lng }]));
}

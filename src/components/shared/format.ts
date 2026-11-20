import type { Dim, FeatureKey, HousingType, Listing, MemberProfile, SourceType, TravelMode, VoteValue } from "@/lib/types";

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export const DIM_LABEL: Record<Dim, string> = {
  affordability: "Affordability",
  commute: "Commute",
  amenities: "Amenities",
  lifestyle: "Lifestyle",
  space: "Space",
};

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  inUnitLaundry: "In-unit laundry",
  dishwasher: "Dishwasher",
  parking: "Parking",
  furnished: "Furnished",
  largeKitchen: "Full kitchen",
  socialAmenities: "Social spaces",
  quietBuilding: "Quiet building",
  petFriendly: "Pet friendly",
  ac: "Air conditioning",
};

export const FEATURE_KEYS = Object.keys(FEATURE_LABEL) as FeatureKey[];

export const HOUSING_LABEL: Record<HousingType, string> = {
  high_rise: "High-rise",
  garden_apartment: "Garden apartment",
  townhome: "Townhome",
  house: "House",
  duplex: "Duplex",
  studio: "Studio",
  co_op: "Co-op",
  ranch: "Ranch",
};

export const MODE_LABEL: Record<TravelMode, string> = {
  walk: "Walk",
  bike: "Bike",
  bus: "Bus",
  drive: "Drive",
};

export const VOTE_LABEL: Record<VoteValue, string> = {
  interested: "Interested",
  maybe: "Maybe",
  pass: "Pass",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-20" → "Nov 20" (no timezone shifting). */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
}
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const mins = Math.round((now - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export const SOURCE_META: Record<SourceType, { label: string; status: string; short: string }> = {
  haven: { label: "Haven", status: "Provider-reported", short: "Haven" },
  umich_offcampus: { label: "U-M Off-Campus listing", status: "Third-party", short: "U-M listing" },
  synthetic: { label: "DEMO — fictional", status: "Fictional", short: "Demo" },
};

/** Map pin / dot color per source. */
export const SOURCE_COLOR: Record<SourceType, string> = {
  haven: "#0b7a6c",
  umich_offcampus: "#2a5fc7",
  synthetic: "#b86e00",
};

const MEMBER_COLORS: Record<string, { bg: string; soft: string; text: string; hex: string }> = {
  teal: { bg: "bg-[#0b7a6c]", soft: "bg-[#dcefea]", text: "text-[#0b7a6c]", hex: "#0b7a6c" },
  amber: { bg: "bg-[#c47a06]", soft: "bg-[#fbedd3]", text: "text-[#9a5c00]", hex: "#c47a06" },
  violet: { bg: "bg-[#6d55c0]", soft: "bg-[#ebe6fa]", text: "text-[#5841a8]", hex: "#6d55c0" },
  sky: { bg: "bg-[#2381b8]", soft: "bg-[#dff0fa]", text: "text-[#1c6a98]", hex: "#2381b8" },
  rose: { bg: "bg-[#c2416b]", soft: "bg-[#fbe3eb]", text: "text-[#a3345a]", hex: "#c2416b" },
  indigo: { bg: "bg-[#4152b8]", soft: "bg-[#e4e7fa]", text: "text-[#34449e]", hex: "#4152b8" },
  lime: { bg: "bg-[#4f7d1f]", soft: "bg-[#e7f1d9]", text: "text-[#3f6618]", hex: "#4f7d1f" },
  orange: { bg: "bg-[#c2551f]", soft: "bg-[#fbe5d8]", text: "text-[#9c4419]", hex: "#c2551f" },
};
const FALLBACK_ORDER = ["teal", "amber", "violet", "sky"];
export function memberColor(m: Pick<MemberProfile, "color">, index = 0) {
  return MEMBER_COLORS[m.color ?? ""] ?? MEMBER_COLORS[FALLBACK_ORDER[index % 4]];
}

/** Budget range bucket shown to roommates instead of the exact number (spec §10). */
export function budgetBucket(n: number): string {
  if (n < 700) return "Under $700";
  if (n < 850) return "$700–$850";
  if (n < 1000) return "$850–$1,000";
  if (n < 1200) return "$1,000–$1,200";
  if (n < 1400) return "$1,200–$1,400";
  return "$1,400+";
}

export function scoreHex(score: number | null): string {
  if (score === null) return "#a3a8b0";
  if (score >= 75) return "#0b7a6c";
  if (score >= 55) return "#14213d";
  return "#b86e00";
}

export const fmtScore = (n: number | null | undefined) => (n === null || n === undefined ? "—" : String(Math.round(n)));

/** Rent formula text for evidence panels, e.g. "$4,396 per unit ÷ 4 = $1,099/person". */
export function rentFormula(listing: Listing, groupSize: number, perPerson: number | null): string {
  const { amount, basis, fees } = listing.rent;
  if (amount === null || basis === "unknown" || perPerson === null)
    return "Rent not published, so affordability is not scored. It is never treated as $0.";
  const unitFeeSum = fees.filter((f) => f.scope === "per_unit").reduce((s, f) => s + f.monthly, 0);
  const personFeeSum = fees.filter((f) => f.scope === "per_person").reduce((s, f) => s + f.monthly, 0);
  if (basis === "per_unit") {
    const inner = unitFeeSum ? `(${money(amount)} + ${money(unitFeeSum)} fees)` : `${money(amount)} per unit`;
    const tail = personFeeSum ? ` + ${money(personFeeSum)} per-person fees` : "";
    return `${inner} ÷ ${groupSize}${tail} = ${money(perPerson)}/person`;
  }
  const label = basis === "per_bedroom" ? "per bed" : "per person";
  const extras = [personFeeSum ? `${money(personFeeSum)} fees` : "", unitFeeSum ? `${money(unitFeeSum)} ÷ ${groupSize} shared fees` : ""]
    .filter(Boolean)
    .join(" + ");
  return `${money(amount)} ${label}${extras ? ` + ${extras}` : ""} = ${money(perPerson)}/person (not divided by group size)`;
}

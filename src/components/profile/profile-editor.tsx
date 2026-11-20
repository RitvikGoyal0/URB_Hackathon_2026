"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Quote, Trash2, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { destinations as allDestinations, getDestination } from "@/lib/data";
import {
  NEUTRAL_BUDGET,
  addDestination,
  confirmAll,
  confirmField,
  importanceFor,
  isUnconfirmedAi,
  markEdited,
  removeField,
  unconfirmedCount,
  type FieldKey,
} from "@/lib/onboarding";
import type { FeatureKey, FieldMeta, Lifestyle, MemberProfile, Requirements, TravelMode } from "@/lib/types";
import { DIMS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DIM_LABEL, FEATURE_KEYS, FEATURE_LABEL, MODE_LABEL, money } from "@/components/shared/format";
import { Segmented, ToggleChip } from "./segmented";
import { PhotoField } from "./photo-field";
import { ScheduleSection } from "./schedule-section";
import { PlacesSection, type PlaceSuggestion } from "@/components/places/place-wizard";
import { searchBuildings } from "@/lib/places";

const NOISE_OPTS: { value: Lifestyle["noise"]; label: string }[] = [
  { value: "quiet", label: "Quiet" },
  { value: "either", label: "Either" },
  { value: "social", label: "Social" },
];
const COOK_OPTS: { value: Lifestyle["cooking"]; label: string }[] = [
  { value: "low", label: "Rarely" },
  { value: "medium", label: "Sometimes" },
  { value: "high", label: "A lot" },
];
const GUEST_OPTS: { value: Lifestyle["guests"]; label: string }[] = [
  { value: "rare", label: "Rarely" },
  { value: "sometimes", label: "Sometimes" },
  { value: "often", label: "Often" },
];
const MODE_OPTS: { value: TravelMode; label: string }[] = (["walk", "bike", "bus", "drive"] as TravelMode[]).map((m) => ({
  value: m,
  label: MODE_LABEL[m],
}));
const REQ_LABEL: Record<keyof Requirements, string> = {
  privateBedroom: "A private bedroom",
  parking: "Parking",
  inUnitLaundry: "In-unit laundry",
};

export function QuoteChip({ meta }: { meta: FieldMeta }) {
  if (!meta.sourceText) return null;
  return (
    <span className="inline-flex max-w-full items-start gap-1.5 rounded-xl bg-[#eef1f6] px-2.5 py-1 text-[12.5px] leading-snug text-[#3b4a6b]">
      <Quote className="mt-0.5 size-3 shrink-0 opacity-60" aria-hidden />
      <span>
        from: &ldquo;…{meta.sourceText}…&rdquo;
        {meta.sourceType === "ai" && typeof meta.confidence === "number" && (
          <span className="ml-1 text-[11px] text-[#6b7a99]">({Math.round(meta.confidence * 100)}% sure)</span>
        )}
      </span>
    </span>
  );
}

/**
 * One reviewable field. AI fields show their quote and Confirm / Edit / Remove;
 * everything else is directly editable.
 */
function FieldRow({
  label,
  meta,
  display,
  onConfirm,
  onRemove,
  children,
  removable = true,
}: {
  label: string;
  meta?: FieldMeta;
  display: React.ReactNode;
  onConfirm?: () => void;
  onRemove?: () => void;
  children: React.ReactNode;
  removable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const ai = meta?.sourceType === "ai";
  const pending = isUnconfirmedAi(meta);
  const showEditor = !ai || editing;
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3.5 transition-colors",
        pending ? "border-[#e9c27a] bg-[#fffaf0]" : "border-line bg-white",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium text-muted-foreground">{label}</div>
          {!showEditor && <div className="mt-0.5 text-[15px] font-semibold text-ink">{display}</div>}
        </div>
        {ai && (
          <div className="flex shrink-0 items-center gap-1">
            {pending ? (
              <Button size="sm" className="rounded-full px-3" onClick={onConfirm}>
                <Check aria-hidden />
                Confirm
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2.5 py-1 text-[12px] font-medium text-teal">
                <Check className="size-3.5" aria-hidden /> Confirmed
              </span>
            )}
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
              <Pencil aria-hidden />
              {editing ? "Done" : "Edit"}
            </Button>
            {removable && (
              <Button size="icon-sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={onRemove} aria-label={`Remove ${label}`}>
                <Trash2 aria-hidden />
              </Button>
            )}
          </div>
        )}
      </div>
      {showEditor && <div className="mt-2.5">{children}</div>}
      {meta?.sourceText && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <QuoteChip meta={meta} />
          {pending && <span className="text-[12px] text-[#8a5a00]">Not used for scoring until you confirm.</span>}
        </div>
      )}
    </div>
  );
}

/** Major + organizations. A new organization asks "Do you go to X regularly?" → place cards. */
export function AboutFields({
  profile,
  onChange,
  onAskPlace,
}: {
  profile: MemberProfile;
  onChange: (p: MemberProfile) => void;
  onAskPlace: (s: { name: string; suggestion?: PlaceSuggestion }) => void;
}) {
  const [org, setOrg] = useState("");
  const [ask, setAsk] = useState<string | null>(null);
  const orgs = profile.organizations ?? [];
  const addOrg = () => {
    const name = org.trim().slice(0, 40);
    if (!name) return;
    setOrg("");
    if (orgs.some((o) => o.toLowerCase() === name.toLowerCase())) return;
    onChange({ ...profile, organizations: [...orgs, name] });
    if (!(profile.places ?? []).some((p) => p.name.toLowerCase() === name.toLowerCase())) setAsk(name);
  };
  return (
    <div className="grid gap-2.5 rounded-2xl border border-line bg-white px-4 py-3.5">
      <span className="text-[12.5px] font-medium text-muted-foreground">Photo</span>
      <PhotoField profile={profile} onChange={onChange} />
      <label htmlFor="pe-major" className="mt-1 text-[12.5px] font-medium text-muted-foreground">
        Major
      </label>
      <Input
        id="pe-major"
        className="h-10 max-w-xs rounded-xl bg-white text-[15px]"
        placeholder="e.g. Mechanical Engineering"
        value={profile.major ?? ""}
        maxLength={60}
        onChange={(e) => onChange({ ...profile, major: e.target.value })}
      />
      <span className="mt-1 text-[12.5px] font-medium text-muted-foreground">Clubs, teams and organizations</span>
      <div className="flex flex-wrap items-center gap-2">
        {orgs.map((o) => (
          <span key={o} className="inline-flex items-center gap-1 rounded-full bg-teal-soft py-1 pr-1 pl-3 text-[13px] text-teal">
            {o}
            <button
              type="button"
              aria-label={`Remove ${o}`}
              className="inline-flex size-5 items-center justify-center rounded-full hover:bg-teal/15"
              onClick={() => onChange({ ...profile, organizations: orgs.filter((x) => x !== o) })}
            >
              <Minus className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            addOrg();
          }}
        >
          <Input aria-label="Add an organization" placeholder="e.g. MRacing" value={org} onChange={(e) => setOrg(e.target.value)} className="h-8 w-40 rounded-full bg-white text-[13px]" />
          <Button type="submit" size="sm" variant="outline" className="rounded-full" disabled={!org.trim()}>
            <Plus aria-hidden /> Add
          </Button>
        </form>
      </div>
      {ask && (
        <div className="mt-1 flex flex-wrap items-center gap-2 rounded-2xl bg-paper px-3.5 py-3">
          <span className="text-[14px] font-medium text-ink">Do you go to {ask} regularly?</span>
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => {
              const b = searchBuildings(ask, 1)[0];
              onAskPlace({ name: ask, suggestion: b ? { buildingId: b.id } : undefined });
              setAsk(null);
            }}
          >
            Yes, add it
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setAsk(null)}>
            No
          </Button>
        </div>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-line bg-paper/60 p-4 sm:p-5">
      <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
      {hint && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{hint}</p>}
      <div className="mt-3.5 grid gap-2.5">{children}</div>
    </section>
  );
}

export function ProfileEditor({
  profile,
  onChange,
  showName = true,
  showPlaces = true,
}: {
  profile: MemberProfile;
  onChange: (p: MemberProfile) => void;
  showName?: boolean;
  showPlaces?: boolean;
}) {
  const meta = profile.fieldMeta;
  const edit = (key: FieldKey, next: MemberProfile) => onChange(markEdited(next, key));
  const pending = unconfirmedCount(profile);
  const missingDests = allDestinations.filter((d) => !profile.destinations.some((x) => x.destinationId === d.id));
  const [addId, setAddId] = useState("");
  const [placeStart, setPlaceStart] = useState<{ name: string; suggestion?: PlaceSuggestion } | null>(null);

  return (
    <div className="grid gap-4">
      {pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-paper">
          <p className="text-[14px]">
            <span className="font-semibold">{pending}</span> detail{pending === 1 ? "" : "s"} still need your OK. Unconfirmed details use neutral
            defaults when scoring.
          </p>
          <Button size="sm" variant="secondary" className="rounded-full" onClick={() => onChange(confirmAll(profile))}>
            <Check aria-hidden /> Confirm all
          </Button>
        </div>
      )}

      {showName && (
        <Section title="About you">
          <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
            <label htmlFor="pe-name" className="text-[12.5px] font-medium text-muted-foreground">
              What should your roommates call you?
            </label>
            <Input
              id="pe-name"
              className="mt-1.5 h-10 max-w-xs rounded-xl bg-white text-[15px]"
              value={profile.displayName}
              maxLength={24}
              onChange={(e) => onChange({ ...profile, displayName: e.target.value || " " })}
              onBlur={(e) => !e.target.value.trim() && onChange({ ...profile, displayName: "Maya" })}
            />
          </div>
          <AboutFields profile={profile} onChange={onChange} onAskPlace={setPlaceStart} />
        </Section>
      )}

      {showPlaces && (
        <Section title="Places you go often" hint="Clubs, jobs, a gym, a friend's place. Each one counts toward your commute, more for places you go often and care about.">
          <PlacesSection profile={profile} onChange={onChange} start={placeStart} />
        </Section>
      )}

      {showPlaces && (
        <Section title="Schedule" hint="Upload a screenshot of your class schedule or type it in. Each class building you confirm counts as trips: the first class of the day, or one after a 2-hour gap.">
          <ScheduleSection profile={profile} onChange={onChange} />
        </Section>
      )}

      <Section title="Campus areas each week" hint="Where you go each week. Commute scores count places you go more often more heavily.">
        {profile.destinations.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line bg-white px-4 py-3 text-[13.5px] text-muted-foreground">
            No places yet. Add where you spend your weekdays so we can score commutes.
          </p>
        )}
        {profile.destinations.map((d) => {
          const key = `destinations.${d.destinationId}` as FieldKey;
          const dest = getDestination(d.destinationId);
          const setVisits = (v: number) =>
            edit(key, {
              ...profile,
              destinations: profile.destinations.map((x) =>
                x.destinationId === d.destinationId ? { ...x, visitsPerWeek: v, importance: importanceFor(v) } : x,
              ),
            });
          return (
            <FieldRow
              key={d.destinationId}
              label={dest?.name ?? d.destinationId}
              meta={meta[key]}
              display={`${d.visitsPerWeek}× per week`}
              onConfirm={() => onChange(confirmField(profile, key))}
              onRemove={() => onChange(removeField(profile, key))}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-1 rounded-full bg-secondary p-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="rounded-full"
                    aria-label="Fewer visits"
                    onClick={() => setVisits(Math.max(1, d.visitsPerWeek - 1))}
                  >
                    <Minus aria-hidden />
                  </Button>
                  <span className="min-w-20 text-center text-[14px] font-semibold text-ink tabular-nums">{d.visitsPerWeek}× / week</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="rounded-full"
                    aria-label="More visits"
                    onClick={() => setVisits(Math.min(7, d.visitsPerWeek + 1))}
                  >
                    <Plus aria-hidden />
                  </Button>
                </div>
                {meta[key]?.sourceType !== "ai" && (
                  <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={() => onChange(removeField(profile, key))}>
                    <Trash2 aria-hidden /> Remove
                  </Button>
                )}
              </div>
            </FieldRow>
          );
        })}
        {missingDests.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="pe-add-dest" className="sr-only">
              Add a place
            </label>
            <select
              id="pe-add-dest"
              value={addId}
              onChange={(e) => setAddId(e.target.value)}
              className="h-9 rounded-full border border-line bg-white px-3 text-[13.5px] text-ink focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none"
            >
              <option value="">Add a place…</option>
              {missingDests.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-full px-3.5"
              disabled={!addId}
              onClick={() => {
                onChange(addDestination(profile, addId, 2));
                setAddId("");
              }}
            >
              <Plus aria-hidden /> Add
            </Button>
          </div>
        )}
      </Section>

      <Section title="Budget" hint="The most you can pay each month for your share. Going over it flags a home; it never hides it.">
        <FieldRow
          label="Monthly budget"
          meta={meta.budgetMax}
          display={money(profile.budgetMax)}
          onConfirm={() => onChange(confirmField(profile, "budgetMax"))}
          onRemove={() => onChange(removeField(profile, "budgetMax"))}
        >
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-muted-foreground">$</span>
              <Input
                type="number"
                inputMode="numeric"
                min={300}
                max={5000}
                step={25}
                aria-label="Monthly budget in dollars"
                className="h-10 w-36 rounded-xl bg-white pl-7 text-[15px] tabular-nums"
                value={profile.budgetMax}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) edit("budgetMax", { ...profile, budgetMax: v });
                }}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-[13.5px] text-charcoal">
              <Switch checked={profile.budgetIsHardCap} onCheckedChange={(v) => onChange({ ...profile, budgetIsHardCap: v })} />
              Hard cap: I can&apos;t go over this
            </label>
          </div>
        </FieldRow>
        {meta.budgetMax?.sourceType === "ai" && !meta.budgetMax.confirmed && (
          <p className="text-[12.5px] text-muted-foreground">Until confirmed, scoring uses a neutral {money(NEUTRAL_BUDGET)} budget.</p>
        )}
      </Section>

      <Section title="Getting Around" hint="Bus times are estimated from distance: about 5 min to and from stops, 5 min waiting, then the ride. When walking is faster, we use the walk.">
        <FieldRow
          label="Usual way to campus"
          meta={meta.travelMode}
          display={MODE_LABEL[profile.travelMode]}
          onConfirm={() => onChange(confirmField(profile, "travelMode"))}
          onRemove={() => onChange(removeField(profile, "travelMode"))}
        >
          <Segmented
            ariaLabel="Travel mode"
            value={profile.travelMode}
            options={MODE_OPTS}
            onChange={(v) => edit("travelMode", { ...profile, travelMode: v })}
          />
        </FieldRow>
        <FieldRow
          label="Car"
          meta={meta.hasCar}
          display={profile.hasCar ? "Has a car" : "No car"}
          onConfirm={() => onChange(confirmField(profile, "hasCar"))}
          onRemove={() => onChange(removeField(profile, "hasCar"))}
        >
          <label className="inline-flex items-center gap-2 text-[14px] text-charcoal">
            <Switch checked={profile.hasCar} onCheckedChange={(v) => edit("hasCar", { ...profile, hasCar: v })} />
            {profile.hasCar ? "I have a car" : "I don't have a car"}
          </label>
        </FieldRow>
      </Section>

      <Section title="Lifestyle">
        {(
          [
            ["noise", "Home should feel", NOISE_OPTS],
            ["cooking", "How much you cook", COOK_OPTS],
            ["guests", "Having people over", GUEST_OPTS],
          ] as const
        ).map(([k, label, opts]) => {
          const key = `lifestyle.${k}` as FieldKey;
          const current = profile.lifestyle[k];
          return (
            <FieldRow
              key={k}
              label={label}
              meta={meta[key]}
              display={(opts as readonly { value: string; label: string }[]).find((o) => o.value === current)?.label ?? current}
              onConfirm={() => onChange(confirmField(profile, key))}
              onRemove={() => onChange(removeField(profile, key))}
            >
              <Segmented
                ariaLabel={label}
                value={current as string}
                options={opts as unknown as { value: string; label: string }[]}
                onChange={(v) => edit(key, { ...profile, lifestyle: { ...profile.lifestyle, [k]: v } })}
              />
            </FieldRow>
          );
        })}
      </Section>

      <Section title="Must-haves" hint="Deal-breakers. A home that doesn't have one gets a blocker flag, and “unknown” never counts as yes.">
        {(Object.keys(REQ_LABEL) as (keyof Requirements)[]).map((k) => {
          const key = `requirements.${k}` as FieldKey;
          return (
            <FieldRow
              key={k}
              label={REQ_LABEL[k]}
              meta={meta[key]}
              display={profile.requirements[k] ? "Required" : "Not required"}
              onConfirm={() => onChange(confirmField(profile, key))}
              onRemove={() => onChange(removeField(profile, key))}
            >
              <label className="inline-flex items-center gap-2 text-[14px] text-charcoal">
                <Switch
                  checked={profile.requirements[k]}
                  onCheckedChange={(v) => edit(key, { ...profile, requirements: { ...profile.requirements, [k]: v } })}
                />
                {profile.requirements[k] ? "Required" : "Not required"}
              </label>
            </FieldRow>
          );
        })}
      </Section>

      <Section title="Nice-to-haves" hint="Count toward the amenities score. An amenity a listing doesn't mention counts as not met and is marked unverified.">
        <div className="flex flex-wrap gap-2">
          {FEATURE_KEYS.map((f: FeatureKey) => {
            const key = `desiredAmenities.${f}` as FieldKey;
            const on = profile.desiredAmenities.includes(f);
            const m = meta[key];
            return (
              <ToggleChip
                key={f}
                pressed={on}
                className={cn(isUnconfirmedAi(m) && on && "border-[#e0a63f] bg-[#fff3dc] text-[#7a4a00]")}
                onPressedChange={(v) =>
                  edit(key, {
                    ...profile,
                    desiredAmenities: v ? [...profile.desiredAmenities, f] : profile.desiredAmenities.filter((x) => x !== f),
                  })
                }
              >
                {on && <Check className="size-3.5" aria-hidden />}
                {FEATURE_LABEL[f]}
              </ToggleChip>
            );
          })}
        </div>
        {profile.desiredAmenities
          .filter((f) => meta[`desiredAmenities.${f}`]?.sourceType === "ai")
          .map((f) => {
            const key = `desiredAmenities.${f}` as FieldKey;
            return (
              <FieldRow
                key={f}
                label={`Suggested: ${FEATURE_LABEL[f]}`}
                meta={meta[key]}
                display={FEATURE_LABEL[f]}
                onConfirm={() => onChange(confirmField(profile, key))}
                onRemove={() => onChange(removeField(profile, key))}
              >
                <p className="text-[13px] text-muted-foreground">Toggle it in the list above.</p>
              </FieldRow>
            );
          })}
      </Section>

      <Section title="What matters most to you" hint="Starts from the default mix; each this-or-that answer moves 5 points between two categories.">
        <WeightBars weights={profile.weights} />
      </Section>
    </div>
  );
}

export function WeightBars({ weights }: { weights: MemberProfile["weights"] }) {
  return (
    <ul className="grid gap-2 rounded-2xl border border-line bg-white px-4 py-3.5">
      {DIMS.map((d) => (
        <li key={d} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-[13px]">
          <span className="text-charcoal">{DIM_LABEL[d]}</span>
          <span className="h-2 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full bg-teal transition-[width] duration-500" style={{ width: `${weights[d] * 100}%` }} />
          </span>
          <span className="text-right font-medium text-ink tabular-nums">{Math.round(weights[d] * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

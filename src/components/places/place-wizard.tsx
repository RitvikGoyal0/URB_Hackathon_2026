"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Building2, MapPin, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { destinations, getBuilding, getDestination } from "@/lib/data";
import {
  DEFAULT_IMPORTANCE,
  FREQUENCIES,
  IMPORTANCE_LABEL,
  MAX_VISITS,
  draftFromPlace,
  emptyDraft,
  finishDraft,
  locationFromArea,
  locationFromBuilding,
  locationFromPin,
  placeSummary,
  removePlace,
  searchBuildings,
  upsertPlace,
  type PlaceDraft,
} from "@/lib/places";
import type { MemberProfile, Place, TravelMode } from "@/lib/types";
import { MODE_LABEL } from "@/components/shared/format";

const PinMap = dynamic(() => import("./pin-map"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-[#e8ebe4] text-[13px] text-muted-foreground">Loading map…</div>,
});

/** What the AI (or an organization) suggested; highlighted, never pre-selected. */
export interface PlaceSuggestion {
  areaId?: string;
  buildingId?: string;
}

type Q = "name" | "where" | "often" | "mode" | "importance";
const ORDER: Q[] = ["name", "where", "often", "mode", "importance"];
const MODES: TravelMode[] = ["walk", "bus", "bike", "drive"];

const choice =
  "rounded-[18px] border border-line bg-white px-4 py-3 text-left text-[14.5px] font-medium text-ink transition-all hover:-translate-y-0.5 hover:border-ink focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none";
const picked = "border-ink bg-ink text-paper hover:border-ink";
const suggested = "ring-2 ring-teal/60 ring-offset-1";

/**
 * "+ Add location" (V3 §7.8): one question at a time, the same card style as this-or-that.
 * Name → Where is it? → How often? → How do you get there? → How important?
 */
export function PlaceWizard({
  initial,
  suggestion,
  defaultMode,
  existing,
  onDone,
  onCancel,
}: {
  initial?: PlaceDraft;
  suggestion?: PlaceSuggestion;
  defaultMode: TravelMode;
  existing: Place[];
  onDone: (p: Place) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<PlaceDraft>(initial ?? emptyDraft());
  const [q, setQ] = useState<Q>(initial?.name ? (initial.location ? "often" : "where") : "name");
  const [custom, setCustom] = useState("");
  const [search, setSearch] = useState("");
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(initial?.location?.source === "pin" ? initial.location : null);
  const idx = ORDER.indexOf(q);
  const editing = !!initial?.id;

  const next = (patch: Partial<PlaceDraft>) => {
    const d = { ...draft, ...patch };
    setDraft(d);
    if (idx + 1 < ORDER.length) setQ(ORDER[idx + 1]);
    else {
      const place = finishDraft(d, existing);
      if (place) onDone(place);
    }
  };
  const back = () => (idx === 0 ? onCancel() : setQ(ORDER[idx - 1]));
  const results = searchBuildings(search);
  const suggestedBuilding = suggestion?.buildingId ? getBuilding(suggestion.buildingId) : undefined;
  const loc = draft.location;

  return (
    <div className="rounded-[26px] border-2 border-ink bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-medium text-teal">
          {editing ? "Edit place" : "Add a place"} · {idx + 1} of {ORDER.length}
        </p>
        <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-teal transition-[width] duration-300" style={{ width: `${(idx / ORDER.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={q} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.16 }} className="mt-5">
          {q === "name" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.name.trim()) next({ name: draft.name.trim() });
              }}
            >
              <h3 className="text-[22px] leading-tight font-semibold text-ink">What&apos;s the place called?</h3>
              <Input
                autoFocus
                aria-label="Place name"
                placeholder="e.g. MRacing, part-time job, the gym"
                maxLength={60}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-4 h-11 rounded-full bg-white px-4 text-[15px]"
              />
              <div className="mt-4 flex gap-2">
                <Button type="submit" className="rounded-full px-5" disabled={!draft.name.trim()}>
                  Next
                </Button>
              </div>
            </form>
          )}

          {q === "where" && (
            <div>
              <h3 className="text-[22px] leading-tight font-semibold text-ink">Where is {draft.name || "it"}?</h3>
              {(suggestion?.areaId || suggestedBuilding) && (
                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Sparkles className="size-3.5 text-teal" aria-hidden /> Suggested: {suggestedBuilding?.shortName ?? getDestination(suggestion!.areaId!)?.shortName}. Tap it if that&apos;s right.
                </p>
              )}
              {suggestedBuilding && (
                <button type="button" className={cn(choice, "mt-3 flex items-center gap-2", suggested)} onClick={() => next({ location: locationFromBuilding(suggestedBuilding) })}>
                  <Building2 className="size-4 text-teal" aria-hidden /> {suggestedBuilding.name}
                </button>
              )}
              <p className="mt-4 text-[12.5px] font-medium text-charcoal">Campus areas</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {destinations.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={cn(choice, "py-2.5 text-[13.5px]", suggestion?.areaId === d.id && suggested, loc?.source === "area" && loc.refId === d.id && picked)}
                    onClick={() => next({ location: locationFromArea(d) })}
                  >
                    {d.shortName}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[12.5px] font-medium text-charcoal">A U-M building</p>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input aria-label="Search U-M buildings" placeholder="Search: Wilson Center, Union, EECS…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 rounded-full bg-white pl-9" />
              </div>
              {search.trim() && (
                <ul className="mt-2 grid gap-1.5" aria-label="Matching buildings">
                  {results.length === 0 && <li className="px-2 text-[13px] text-muted-foreground">No match. Try another name, or drop a pin.</li>}
                  {results.map((b) => (
                    <li key={b.id}>
                      <button type="button" className={cn(choice, "flex w-full items-center gap-2 py-2.5 text-[13.5px]", loc?.refId === b.id && picked)} onClick={() => next({ location: locationFromBuilding(b) })}>
                        <Building2 className="size-4 shrink-0 text-teal" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate">{b.name}</span>
                          {b.areaId && <span className="block text-[12px] font-normal text-muted-foreground">{getDestination(b.areaId)?.shortName}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4">
                {!pinMode ? (
                  <Button variant="outline" className="rounded-full" onClick={() => setPinMode(true)}>
                    <MapPin aria-hidden /> Drop a pin on the map
                  </Button>
                ) : (
                  <div>
                    <p className="text-[12.5px] text-muted-foreground">Tap the map where {draft.name || "it"} is.</p>
                    <div className="mt-2 h-64 overflow-hidden rounded-[18px] border border-line">
                      <PinMap value={pin} onPick={setPin} />
                    </div>
                    <Button
                      className="mt-3 rounded-full"
                      disabled={!pin}
                      onClick={() => {
                        const l = pin ? locationFromPin(pin.lat, pin.lng) : null;
                        if (l) next({ location: l });
                      }}
                    >
                      Use this spot
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {q === "often" && (
            <div>
              <h3 className="text-[22px] leading-tight font-semibold text-ink">How often do you go?</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {FREQUENCIES.map((f) => (
                  <button key={f.label} type="button" className={cn(choice, draft.visitsPerWeek === f.visits && picked)} onClick={() => next({ visitsPerWeek: f.visits })}>
                    {f.label}
                    <span className="ml-1.5 text-[12.5px] font-normal opacity-70">{f.visits < 1 ? "¼/wk" : `${f.visits}/wk`}</span>
                  </button>
                ))}
              </div>
              <form
                className="mt-3 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = Number(custom);
                  if (Number.isFinite(v) && v > 0 && v <= MAX_VISITS) next({ visitsPerWeek: v });
                }}
              >
                <Input aria-label="Times per week" inputMode="decimal" placeholder="Custom" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-10 w-28 rounded-full bg-white" />
                <span className="text-[13px] text-muted-foreground">times a week</span>
                <Button type="submit" variant="outline" className="rounded-full" disabled={!(Number(custom) > 0 && Number(custom) <= MAX_VISITS)}>
                  Use
                </Button>
              </form>
            </div>
          )}

          {q === "mode" && (
            <div>
              <h3 className="text-[22px] leading-tight font-semibold text-ink">How do you usually get there?</h3>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MODES.map((m) => (
                  <button key={m} type="button" className={cn(choice, (draft.mode ?? defaultMode) === m && picked)} onClick={() => next({ mode: m === defaultMode ? null : m })}>
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12.5px] text-muted-foreground">Usually {MODE_LABEL[defaultMode].toLowerCase()}, from your profile.</p>
            </div>
          )}

          {q === "importance" && (
            <div>
              <h3 className="text-[22px] leading-tight font-semibold text-ink">How important is being close to it?</h3>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {([3, 2, 1] as const).map((i) => (
                  <button key={i} type="button" className={cn(choice, draft.importance === i && picked)} onClick={() => next({ importance: i })}>
                    {IMPORTANCE_LABEL[i]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 flex items-center justify-between gap-2">
        <Button variant="ghost" className="rounded-full" onClick={back}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        {(q === "often" || q === "mode" || q === "importance") && (
          <Button
            variant="ghost"
            className="rounded-full text-muted-foreground"
            onClick={() => next(q === "often" ? { visitsPerWeek: draft.visitsPerWeek ?? 1 } : q === "mode" ? { mode: draft.mode } : { importance: draft.importance ?? DEFAULT_IMPORTANCE })}
          >
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}

/** "Places you go often" list with + Add location, Edit and Remove (profile + onboarding). */
export function PlacesSection({
  profile,
  onChange,
  start,
}: {
  profile: MemberProfile;
  onChange: (p: MemberProfile) => void;
  /** open the cards right away (e.g. after "Do you go to MRacing regularly?" → Yes) */
  start?: { name: string; suggestion?: PlaceSuggestion } | null;
}) {
  const places = profile.places ?? [];
  const [open, setOpen] = useState<{ draft?: PlaceDraft; suggestion?: PlaceSuggestion; key: number } | null>(null);
  const [seq, setSeq] = useState(0);
  const [lastStart, setLastStart] = useState<typeof start>(null);
  // A new `start` object (re)opens the cards with that name (adjusting state during render).
  if (start && start !== lastStart) {
    setLastStart(start);
    setSeq(seq + 1);
    setOpen({ draft: emptyDraft(start.name), suggestion: start.suggestion, key: seq + 1 });
  }
  const openWith = (o: Omit<NonNullable<typeof open>, "key">) => {
    setSeq(seq + 1);
    setOpen({ ...o, key: seq + 1 });
  };

  return (
    <div>
      {places.length > 0 && (
        <ul className="grid gap-2">
          {places.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
              <MapPin className="size-4 shrink-0 text-teal" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{placeSummary(p, profile.travelMode)}</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${p.name}`} onClick={() => openWith({ draft: draftFromPlace(p) })}>
                <Pencil aria-hidden />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${p.name}`} onClick={() => onChange(removePlace(profile, p.id))}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <div className={cn(places.length > 0 && "mt-3")}>
          <PlaceWizard
            key={open.key}
            initial={open.draft}
            suggestion={open.suggestion}
            defaultMode={profile.travelMode}
            existing={places}
            onCancel={() => setOpen(null)}
            onDone={(p) => {
              onChange(upsertPlace(profile, p));
              setOpen(null);
            }}
          />
        </div>
      ) : (
        <Button variant="outline" className={cn("rounded-full", places.length > 0 && "mt-3")} onClick={() => openWith({})}>
          <Plus aria-hidden /> Add location
        </Button>
      )}
    </div>
  );
}

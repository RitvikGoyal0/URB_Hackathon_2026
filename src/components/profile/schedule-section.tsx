"use client";

import { useId, useRef, useState } from "react";
import { Check, Loader2, MapPin, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { destinations } from "@/lib/data";
import { WEEKDAYS } from "@/lib/engine/schedule";
import { resizeImage } from "@/lib/image-client";
import { locationFromArea, locationFromBuilding, searchBuildings } from "@/lib/places";
import {
  IMAGE_TYPES,
  applySchedule,
  draftsFromSchedule,
  emptyClass,
  matchBuilding,
  rowProblem,
  validateImageFile,
  type DraftClass,
} from "@/lib/schedule-import";
import type { MemberProfile, Weekday } from "@/lib/types";
import type { ScheduleParseResponse } from "@/app/api/schedule/parse/route";

const DAY_SHORT: Record<Weekday, string> = { mon: "M", tue: "T", wed: "W", thu: "Th", fri: "F", sat: "Sa", sun: "Su" };
const DAY_LONG: Record<Weekday, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

type RowPatch = Partial<DraftClass> | ((r: DraftClass) => Partial<DraftClass>);

type Mode = { kind: "idle" } | { kind: "reading" } | { kind: "editing"; rows: DraftClass[]; note?: string; image?: { dataUrl: string; updatedAt: string } | null };

/**
 * Schedule (V3 §9.2): upload a screenshot (read by Gemini, only what's visible) or type classes in.
 * Every row is reviewed and confirmed; confirmed rows with a location become class places, with
 * trips counted by the 2-hour rule.
 */
export function ScheduleSection({ profile, onChange }: { profile: MemberProfile; onChange: (p: MemberProfile) => void }) {
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const file = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const saved = profile.schedule;
  const classPlaces = (profile.places ?? []).filter((p) => p.kind === "class");

  async function upload(f: File | undefined) {
    if (file.current) file.current.value = "";
    if (!f) return;
    const problem = validateImageFile(f);
    if (problem) return setFileError(problem);
    setFileError(null);
    setMode({ kind: "reading" });
    let image: string;
    let thumb: { dataUrl: string; updatedAt: string } | null = null;
    try {
      image = await resizeImage(f, { maxEdge: 1600, maxBytes: 1_500_000 });
      thumb = { dataUrl: await resizeImage(f, { maxEdge: 480, maxBytes: 120_000 }), updatedAt: new Date().toISOString() };
    } catch {
      setMode({ kind: "idle" });
      return setFileError("That image couldn't be read. Try another file.");
    }
    let res: ScheduleParseResponse;
    try {
      const r = await fetch("/api/schedule/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image }) });
      res = (await r.json()) as ScheduleParseResponse;
    } catch {
      res = { ok: false, reason: "failed", error: "Couldn't reach the server. Enter your classes below." };
    }
    if (res.ok && res.classes.length > 0) {
      const rows = res.classes.map((c) => ({ ...c, location: undefined }));
      setMode({ kind: "editing", rows, image: thumb, note: `Found ${rows.length} ${rows.length === 1 ? "class" : "classes"}. Check each one, then confirm it.` });
    } else {
      setMode({
        kind: "editing",
        rows: [emptyClass()],
        image: thumb,
        note: res.ok ? "No classes were visible in that image. Enter them below." : res.error,
      });
    }
  }

  function save(rows: DraftClass[], image: { dataUrl: string; updatedAt: string } | null | undefined) {
    const dropped = rows.filter((r) => rowProblem(r) !== null && (r.name || r.days.length || r.start || r.building)).length;
    onChange(applySchedule(profile, rows, new Date().toISOString(), image));
    setMode({ kind: "idle" });
    toast.success(dropped > 0 ? `Schedule saved. ${dropped} incomplete ${dropped === 1 ? "row was" : "rows were"} left out.` : "Schedule saved");
  }

  if (mode.kind === "editing") {
    return <ReviewTable initial={mode.rows} note={mode.note} onCancel={() => setMode({ kind: "idle" })} onSave={(rows) => save(rows, mode.image)} />;
  }

  return (
    <div className="grid gap-3">
      {saved && saved.classes.length > 0 ? (
        <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-white p-4">
          {saved.image?.dataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL thumbnail
            <img src={saved.image.dataUrl} alt="Your schedule screenshot" className="h-20 w-28 rounded-xl border border-line object-cover object-top" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink">
              {saved.classes.length} {saved.classes.length === 1 ? "class" : "classes"} · {saved.classes.filter((c) => c.confirmed).length} confirmed
            </p>
            {classPlaces.length > 0 ? (
              <ul className="mt-1 grid gap-0.5 text-[13px] text-charcoal">
                {classPlaces.map((p) => (
                  <li key={p.id} className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-teal" aria-hidden />
                    {p.name}: {p.visitsPerWeek} {p.visitsPerWeek === 1 ? "trip" : "trips"} a week
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[13px] text-muted-foreground">No class has a confirmed location yet, so none count toward your commute.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setMode({ kind: "editing", rows: draftsFromSchedule(saved.classes), image: undefined })}>
              <Pencil aria-hidden /> Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-muted-foreground"
              onClick={() => {
                onChange({ ...applySchedule(profile, [], new Date().toISOString(), null), schedule: null });
                toast("Schedule removed");
              }}
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="rounded-full" disabled={mode.kind === "reading"} onClick={() => file.current?.click()}>
          {mode.kind === "reading" ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {mode.kind === "reading" ? "Reading your schedule…" : saved?.image ? "Replace screenshot" : "Upload a screenshot"}
        </Button>
        {mode.kind !== "reading" && !(saved && saved.classes.length > 0) && (
          <Button variant="ghost" className="rounded-full" onClick={() => setMode({ kind: "editing", rows: [emptyClass()] })}>
            <Plus aria-hidden /> Enter classes yourself
          </Button>
        )}
      </div>
      {mode.kind === "reading" && <p className="text-[12.5px] text-muted-foreground">This can take up to 15 seconds. Only what&apos;s visible is read; nothing is guessed.</p>}
      {fileError && (
        <p role="alert" className="text-[12.5px] font-medium text-blocker">
          {fileError}
        </p>
      )}
      <input
        ref={file}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a schedule screenshot"
        onChange={(e) => upload(e.target.files?.[0])}
      />
    </div>
  );
}

function ReviewTable({ initial, note, onSave, onCancel }: { initial: DraftClass[]; note?: string; onSave: (rows: DraftClass[]) => void; onCancel: () => void }) {
  const [rows, setRows] = useState<DraftClass[]>(initial);
  // Functional updates, so quick successive edits (e.g. toggling M, W, F) never overwrite each other.
  const set = (i: number, patch: RowPatch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...(typeof patch === "function" ? patch(r) : patch) } : r)));
  const confirmed = rows.filter((r) => r.confirmed && rowProblem(r) === null).length;
  return (
    <div className="grid gap-3">
      {note && <p className="rounded-2xl bg-umblue-soft px-4 py-2.5 text-[13px] text-umblue">{note}</p>}
      <ul className="grid gap-3">
        {rows.map((r, i) => (
          <ClassRow key={i} row={r} index={i} onChange={(p) => set(i, p)} onRemove={() => setRows((rs) => rs.filter((_, j) => j !== i))} />
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="rounded-full" onClick={() => setRows((rs) => [...rs, emptyClass()])} disabled={rows.length >= 30}>
          <Plus aria-hidden /> Add class
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" className="rounded-full" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="rounded-full" onClick={() => onSave(rows)}>
          <Check aria-hidden /> Save schedule{confirmed > 0 ? ` (${confirmed} confirmed)` : ""}
        </Button>
      </div>
    </div>
  );
}

function ClassRow({ row, index, onChange, onRemove }: { row: DraftClass; index: number; onChange: (p: RowPatch) => void; onRemove: () => void }) {
  const id = useId();
  const problem = rowProblem(row);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const suggestion = !row.location && row.building ? matchBuilding(row.building) : undefined;
  const results = searchBuildings(search, 5);
  const label = row.name.trim() || `Class ${index + 1}`;

  return (
    <li className={cn("rounded-2xl border bg-white p-4", row.confirmed && !problem ? "border-teal/50" : "border-line")}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid gap-1">
          <label htmlFor={`${id}-n`} className="text-[12px] font-medium text-muted-foreground">
            Class
          </label>
          <Input id={`${id}-n`} value={row.name} maxLength={80} placeholder="e.g. EECS 281 LEC" className="h-10 rounded-xl bg-white" onChange={(e) => onChange({ name: e.target.value, confirmed: false })} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${id}-b`} className="text-[12px] font-medium text-muted-foreground">
            Building / room
          </label>
          <Input
            id={`${id}-b`}
            value={row.building}
            maxLength={80}
            placeholder="e.g. 1013 DOW"
            className="h-10 rounded-xl bg-white"
            onChange={(e) => onChange({ building: e.target.value, location: undefined, confirmed: false })}
          />
        </div>
      </div>

      <fieldset className="mt-3">
        <legend className="text-[12px] font-medium text-muted-foreground">Days</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => {
            const on = row.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={DAY_LONG[d]}
                onClick={() =>
                  onChange((r) => ({ days: r.days.includes(d) ? r.days.filter((x) => x !== d) : WEEKDAYS.filter((x) => x === d || r.days.includes(x)), confirmed: false }))
                }
                className={cn(
                  "inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-2 text-[13px] font-semibold focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none",
                  on ? "border-ink bg-ink text-paper" : "border-line bg-white text-charcoal hover:border-ink/30",
                )}
              >
                {DAY_SHORT[d]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label htmlFor={`${id}-s`} className="text-[12px] font-medium text-muted-foreground">
            Starts
          </label>
          <Input id={`${id}-s`} type="time" value={row.start} className="h-10 w-32 rounded-xl bg-white" onChange={(e) => onChange({ start: e.target.value, confirmed: false })} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${id}-e`} className="text-[12px] font-medium text-muted-foreground">
            Ends
          </label>
          <Input id={`${id}-e`} type="time" value={row.end} className="h-10 w-32 rounded-xl bg-white" onChange={(e) => onChange({ end: e.target.value, confirmed: false })} />
        </div>
      </div>

      {/* Where is it? — the student confirms a known building or picks an area */}
      <div className="mt-3 rounded-xl bg-paper px-3 py-2.5 text-[13px]">
        {row.location ? (
          <p className="flex flex-wrap items-center gap-2 text-ink">
            <MapPin className="size-3.5 text-teal" aria-hidden /> <span className="font-medium">{row.location.label}</span>
            <button type="button" className="text-[12.5px] font-medium text-teal hover:underline" onClick={() => (onChange({ location: undefined, confirmed: false }), setPicking(true))}>
              Change
            </button>
          </p>
        ) : suggestion && !picking ? (
          <p className="flex flex-wrap items-center gap-2 text-charcoal">
            Is this <span className="font-semibold text-ink">{suggestion.name}</span>?
            <Button size="xs" className="rounded-full" onClick={() => onChange({ location: locationFromBuilding(suggestion) })}>
              Yes
            </Button>
            <Button size="xs" variant="outline" className="rounded-full bg-white" onClick={() => setPicking(true)}>
              No, pick
            </Button>
          </p>
        ) : picking ? (
          <div className="grid gap-2">
            <p className="font-medium text-ink">Where is it?</p>
            <div className="flex flex-wrap gap-1.5">
              {destinations.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="rounded-full border border-line bg-white px-3 py-1 text-[12.5px] text-charcoal hover:border-ink/40"
                  onClick={() => (onChange({ location: locationFromArea(d) }), setPicking(false))}
                >
                  {d.shortName}
                </button>
              ))}
            </div>
            <Input aria-label="Search U-M buildings" placeholder="Search buildings, e.g. Chemistry" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 max-w-sm rounded-xl bg-white text-[13px]" />
            {results.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {results.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="rounded-full border border-line bg-white px-3 py-1 text-[12.5px] text-charcoal hover:border-ink/40"
                    onClick={() => (onChange({ location: locationFromBuilding(b) }), setPicking(false), setSearch(""))}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="justify-self-start text-[12.5px] text-muted-foreground hover:underline" onClick={() => setPicking(false)}>
              Not now
            </button>
          </div>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            No location yet, so this class won&apos;t count toward your commute.
            <button type="button" className="font-medium text-teal hover:underline" onClick={() => setPicking(true)}>
              Where is it?
            </button>
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className={cn("inline-flex items-center gap-2 text-[13.5px] font-medium", problem ? "text-muted-foreground" : "text-ink")}>
          <input
            type="checkbox"
            className="size-4 accent-[var(--teal)]"
            checked={row.confirmed && !problem}
            disabled={!!problem}
            onChange={(e) => onChange({ confirmed: e.target.checked })}
            aria-describedby={problem ? `${id}-p` : undefined}
          />
          This is right
        </label>
        {problem && (
          <span id={`${id}-p`} className="text-[12.5px] text-[#8a5300]">
            {problem}
          </span>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={onRemove} aria-label={`Remove ${label}`}>
          <Trash2 aria-hidden /> Remove
        </Button>
      </div>
    </li>
  );
}

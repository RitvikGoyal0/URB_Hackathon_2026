"use client";

import { Bus, ChevronDown } from "lucide-react";
import { getDestination } from "@/lib/data";
import { ESTIMATE_NOTE, averageCommute } from "@/lib/engine";
import type { Blocker, MemberProfile, MemberResult, Warning } from "@/lib/types";
import { DIMS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BlockerChip, MemberAvatar, WarningChip } from "@/components/shared/bits";
import { DIM_LABEL, MODE_LABEL, fmtScore, money, scoreHex } from "@/components/shared/format";

export function SubscoreBar({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span
        className="block h-2 w-full rounded-full"
        style={{ background: "repeating-linear-gradient(90deg,#d5d8de 0 6px,#e9ebee 6px 10px)" }}
        title="Unverified: not enough data to score"
      />
    );
  }
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-secondary">
      <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${score}%`, background: scoreHex(score) }} />
    </span>
  );
}

/** One short note per roommate: the main compromise if a category is weak, otherwise the strongest fit. */
export function memberNote(pm: MemberResult): string | null {
  const scored = DIMS.map((d) => ({ d, s: pm.subscores[d] })).filter((x) => x.s.score !== null && x.s.reason);
  if (scored.length === 0) return null;
  const weakest = scored.reduce((a, b) => ((b.s.score as number) < (a.s.score as number) ? b : a));
  if ((weakest.s.score as number) < 55) return `Trade-off · ${DIM_LABEL[weakest.d]}: ${weakest.s.reason}`;
  const best = scored.reduce((a, b) => ((b.s.score as number) > (a.s.score as number) ? b : a));
  return `Best fit · ${DIM_LABEL[best.d]}: ${best.s.reason}`;
}

/**
 * Compact roommate card (V3 §7.6): Match · Commute avg · Rent · budget status, one note, and a
 * Details expander with each place's trip and the category bars.
 */
export function MemberRow({
  member,
  index,
  pm,
  blockers,
  warnings,
  isLeast,
}: {
  member: MemberProfile;
  index: number;
  pm: MemberResult;
  blockers: Blocker[];
  warnings: Warning[];
  isLeast: boolean;
}) {
  const avg = averageCommute(pm.commutes);
  const rent = pm.perPersonRent;
  const over = rent === null ? null : Math.round(rent - member.budgetMax);
  const note = memberNote(pm);
  const hardBlockers = blockers.filter((b) => b.kind !== "budget");
  // Label the trips by how they're actually made (a place can override the usual mode).
  const modes = [...new Set(pm.commutes.filter((c) => c.visitsPerWeek > 0).map((c) => c.mode))];
  const modeText = modes.length === 1 ? MODE_LABEL[modes[0]] : modes.length > 1 ? "Mixed" : MODE_LABEL[member.travelMode];

  return (
    <article className={cn("rounded-[22px] border bg-white p-4", isLeast ? "border-amber/50" : "border-line")}>
      <div className="flex items-center gap-3">
        <MemberAvatar member={member} index={index} size="md" />
        <h3 className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[15.5px] font-semibold text-ink">
          {member.displayName}
          {member.isLiveUser && <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-semibold text-teal">You</span>}
          {isLeast && <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-semibold text-[#8a5300]">Least satisfied</span>}
        </h3>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Match</dt>
          <dd className="font-display text-[18px] font-semibold tabular-nums" style={{ color: scoreHex(pm.score) }}>
            {fmtScore(pm.score)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Commute</dt>
          <dd className="font-medium text-ink">
            {avg.minutes === null ? (
              <span className="text-muted-foreground">No places yet</span>
            ) : (
              <>
                <span className="tabular-nums" title={avg.estimated ? ESTIMATE_NOTE : undefined}>
                  {avg.estimated ? "~" : ""}
                  {avg.minutes} min avg
                </span>
                <span className="block text-[11.5px] font-normal text-muted-foreground">
                  {modeText} · {avg.counted < avg.total ? `based on ${avg.counted} of ${avg.total} places` : `${avg.total} ${avg.total === 1 ? "place" : "places"}`}
                </span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rent</dt>
          <dd className="font-medium text-ink tabular-nums">{rent === null ? <span className="text-muted-foreground">Not verified</span> : `${money(rent)}/mo`}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Budget</dt>
          <dd className={cn("font-medium", over === null ? "text-muted-foreground" : over > 0 ? "text-blocker" : "text-teal")}>
            {over === null ? "Unknown" : over > 0 ? `Over by ${money(over)}` : "Within budget"}
          </dd>
        </div>
      </dl>

      {note && <p className="mt-3 line-clamp-2 text-[13px] leading-snug text-charcoal">{note}</p>}

      {(hardBlockers.length > 0 || warnings.length > 0) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {hardBlockers.map((b, i) => (
            <BlockerChip key={i} blocker={b} />
          ))}
          {warnings.map((w, i) => (
            <WarningChip key={i} warning={w} />
          ))}
        </div>
      )}

      <details className="group/d mt-3 border-t border-line pt-2.5">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-[12.5px] font-semibold text-teal [&::-webkit-details-marker]:hidden">
          Details <ChevronDown className="size-3.5 transition-transform group-open/d:rotate-180" aria-hidden />
        </summary>
        {pm.commutes.length > 0 && (
          <ul className="mt-2.5 grid gap-1">
            {pm.commutes.map((c) => (
              <li key={c.destinationId} className="flex flex-wrap items-baseline justify-between gap-x-3 text-[12.5px]">
                <span className="text-charcoal">
                  {c.mode === "bus" && <Bus className="mr-1 inline size-3 align-[-1px]" aria-hidden />}
                  {c.name ?? getDestination(c.destinationId)?.shortName ?? c.destinationId}
                  <span className="text-muted-foreground"> · {c.visitsPerWeek}×/wk</span>
                </span>
                <span className="font-medium text-ink tabular-nums">
                  {c.minutes === null ? <span className="font-normal text-muted-foreground">no location</span> : `${Math.round(c.minutes)} min ${MODE_LABEL[c.mode].toLowerCase()}`}
                  {c.estimated && (
                    <span className="font-normal text-muted-foreground" title={ESTIMATE_NOTE}>
                      {" "}
                      est.
                    </span>
                  )}
                  {c.note && <span className="font-normal text-[#8a5300]"> · {c.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <ul className="mt-3 grid gap-2">
          {DIMS.map((d) => {
            const s = pm.subscores[d];
            return (
              <li key={d} className="grid grid-cols-[6rem_1fr_2.25rem] items-center gap-3 text-[12px]">
                <span className="text-charcoal">{DIM_LABEL[d]}</span>
                <SubscoreBar score={s.score} />
                <span className={cn("text-right tabular-nums", s.score === null ? "text-muted-foreground" : "font-medium text-ink")}>{s.score === null ? "n/a" : fmtScore(s.score)}</span>
              </li>
            );
          })}
        </ul>
      </details>
    </article>
  );
}

"use client";

import { Bus } from "lucide-react";
import { getDestination } from "@/lib/data";
import type { Blocker, MemberProfile, MemberResult, Warning } from "@/lib/types";
import { DIMS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BlockerChip, MemberAvatar, WarningChip } from "@/components/shared/bits";
import { DIM_LABEL, MODE_LABEL, fmtScore, scoreHex } from "@/components/shared/format";

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

export function MemberRow({
  member,
  index,
  pm,
  lines,
  blockers,
  warnings,
  isLeast,
}: {
  member: MemberProfile;
  index: number;
  pm: MemberResult;
  lines: string[];
  blockers: Blocker[];
  warnings: Warning[];
  isLeast: boolean;
}) {
  // Explanation lines that only restate a subscore (already shown under its bar) or a blocker (shown as a chip) are skipped.
  const extraLines = lines.filter((l) => !/^(Overall fit|Affordability|Commute|Amenities|Lifestyle|Space|Blocker)\b/.test(l));
  return (
    <article className={cn("rounded-[24px] border bg-white p-4 sm:p-5", isLeast ? "border-amber/50" : "border-line")}>
      <div className="flex items-center gap-3">
        <MemberAvatar member={member} index={index} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-[16px] font-semibold text-ink">
            {member.displayName}
            {member.isLiveUser && <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-semibold text-teal">You</span>}
            {isLeast && <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-semibold text-[#8a5300]">Least satisfied</span>}
          </h3>
          <p className="text-[12.5px] text-muted-foreground">{{ walk: "Walks", bike: "Bikes", bus: "Takes the bus", drive: "Drives" }[member.travelMode]} to class</p>
        </div>
        <span className="font-display text-[28px] font-semibold tabular-nums" style={{ color: scoreHex(pm.score) }}>
          {fmtScore(pm.score)}
        </span>
      </div>

      <ul className="mt-4 grid gap-2.5">
        {DIMS.map((d) => {
          const s = pm.subscores[d];
          return (
            <li key={d} className="grid grid-cols-[6.5rem_1fr_2.25rem] items-center gap-3 text-[12.5px]">
              <span className="text-charcoal">{DIM_LABEL[d]}</span>
              <SubscoreBar score={s.score} />
              <span className={cn("text-right tabular-nums", s.score === null ? "text-muted-foreground" : "font-medium text-ink")}>
                {s.score === null ? "n/a" : fmtScore(s.score)}
              </span>
              {s.reason && <span className="col-span-3 -mt-1 pl-0 text-[12px] leading-snug text-muted-foreground sm:pl-[7.25rem]">{s.reason}</span>}
            </li>
          );
        })}
      </ul>

      {pm.commutes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {pm.commutes.map((c) => (
            <span key={c.destinationId} className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-[12px] text-charcoal">
              {c.mode === "bus" && <Bus className="size-3" aria-hidden />}
              {getDestination(c.destinationId)?.shortName ?? c.destinationId}:{" "}
              {c.minutes === null ? "no route" : `${Math.round(c.minutes)} min ${c.mode === "bus" ? "walk" : MODE_LABEL[c.mode].toLowerCase()}`}
              {c.estimated && <span className="text-muted-foreground"> (est. straight-line)</span>}
              {c.note && <span className="text-[#8a5300]"> · {c.note}</span>}
            </span>
          ))}
        </div>
      )}

      {extraLines.length > 0 && (
        <ul className="mt-3 grid gap-1 text-[13px] leading-relaxed text-charcoal">
          {extraLines.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-ink/40" aria-hidden />
              {l}
            </li>
          ))}
        </ul>
      )}

      {(blockers.length > 0 || warnings.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {blockers.map((b, i) => (
            <BlockerChip key={i} blocker={b} />
          ))}
          {warnings.map((w, i) => (
            <WarningChip key={i} warning={w} />
          ))}
        </div>
      )}
    </article>
  );
}

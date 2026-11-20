"use client";

import { Calculator } from "lucide-react";
import { commuteMatrix } from "@/lib/data";
import {
  AFFORD_AT_BUDGET_SCORE,
  AFFORD_FULL_MARKS_RATIO,
  BUS_ACCESS_MIN,
  BUS_KMH,
  BUS_WAIT_MIN,
  DETOUR_FACTOR,
  COMMUTE_FULL_MARKS_MIN,
  COMMUTE_ZERO_MIN,
  GROUP_MEAN_WEIGHT,
  GROUP_MIN_WEIGHT,
} from "@/lib/engine/constants";
import { DEFAULT_WEIGHTS } from "@/lib/engine";
import type { Listing, MemberProfile, RankedResult } from "@/lib/types";
import { DIMS } from "@/lib/types";
import { DIM_LABEL, fmtScore, longDate, rentFormula } from "@/components/shared/format";

const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/**
 * "How this score is calculated" — the full arithmetic behind the group score, with the
 * real numbers substituted in, plus every assumption the score depends on (rubric: evidence 20%).
 */
export function ScoreFormula({ result, listing, people }: { result: RankedResult; listing: Listing; people: MemberProfile[] }) {
  const scored = result.perMember.filter((pm) => pm.score !== null);
  const name = (id: string) => people.find((p) => p.id === id)?.displayName ?? id;
  const groupSize = result.perMember.length;
  const pp = result.perMember[0]?.perPersonRent ?? null;

  return (
    <section className="rounded-[26px] border border-ink/15 bg-white p-5 sm:p-6" aria-labelledby="formula-h">
      <h2 id="formula-h" className="flex items-center gap-2 text-[19px] font-semibold text-ink">
        <Calculator className="size-5 text-teal" aria-hidden /> How this score is calculated
      </h2>

      <div className="mt-4 rounded-2xl bg-ink p-4 text-paper sm:p-5">
        <p className="text-[12.5px] text-paper/70">Group score</p>
        <p className="mt-1 font-display text-[17px] leading-relaxed sm:text-[19px]">
          {GROUP_MEAN_WEIGHT} × mean({scored.map((pm) => fmtScore(pm.score)).join(", ")}) + {GROUP_MIN_WEIGHT} × min
        </p>
        <p className="mt-1 font-display text-[17px] leading-relaxed sm:text-[19px]">
          = {GROUP_MEAN_WEIGHT} × {result.mean !== null ? r1(result.mean) : "—"} + {GROUP_MIN_WEIGHT} × {result.min !== null ? r1(result.min) : "—"} ={" "}
          <span className="font-semibold text-emerald">{fmtScore(result.groupScore)}</span>
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-paper/70">
          The {Math.round(GROUP_MIN_WEIGHT * 100)}% on the least-satisfied member ({result.leastSatisfiedMemberId ? name(result.leastSatisfiedMemberId) : "—"}) keeps one person from
          being quietly outvoted by the average.
        </p>
      </div>

      <h3 className="mt-6 text-[15px] font-semibold text-ink">Each member&apos;s score</h3>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        Member score = Σ (effective weight × subscore). A category with no data is left out and its weight is shared across the others in
        proportion.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Member</th>
              {DIMS.map((d) => (
                <th key={d} className="px-1 py-1.5 text-right font-medium">
                  {DIM_LABEL[d]}
                </th>
              ))}
              <th className="py-1.5 pl-2 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {result.perMember.map((pm) => (
              <tr key={pm.memberId} className="border-t border-line align-top">
                <td className="py-2 pr-2 font-medium text-ink">{name(pm.memberId)}</td>
                {DIMS.map((d) => {
                  const s = pm.subscores[d].score;
                  const w = pm.effectiveWeights[d];
                  return (
                    <td key={d} className="px-1 py-2 text-right tabular-nums">
                      {s === null ? (
                        <span className="text-muted-foreground" title="No data: weight redistributed">
                          n/a
                        </span>
                      ) : (
                        <>
                          <span className="text-ink">{fmtScore(s)}</span>
                          <span className="block text-[11px] text-muted-foreground">× {Math.round(w * 100)}%</span>
                        </>
                      )}
                    </td>
                  );
                })}
                <td className="py-2 pl-2 text-right font-display text-[15px] font-semibold text-ink tabular-nums">{fmtScore(pm.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 text-[15px] font-semibold text-ink">Assumptions behind these numbers</h3>
      <ul className="mt-2 grid gap-2 text-[13px] leading-relaxed text-charcoal">
        <li className="rounded-xl bg-paper px-3 py-2">
          <span className="font-medium text-ink">Rent per person:</span> {rentFormula(listing, groupSize, pp)}
        </li>
        <li className="rounded-xl bg-paper px-3 py-2">
          <span className="font-medium text-ink">Affordability:</span> 100 at or under {Math.round(AFFORD_FULL_MARKS_RATIO * 100)}% of a member&apos;s budget, falling to {AFFORD_AT_BUDGET_SCORE} at 100%. Over budget scores 0
          and raises a blocker.
        </li>
        <li className="rounded-xl bg-paper px-3 py-2">
          <span className="font-medium text-ink">Commute:</span> 100 at {COMMUTE_FULL_MARKS_MIN} minutes or less, 0 at {COMMUTE_ZERO_MIN}+, weighted by visits per week × importance. Times come from{" "}
          {commuteMatrix.provider}, computed {longDate(commuteMatrix.computedAt)}. Bus trips and custom places are estimated from distance (straight line × {DETOUR_FACTOR} for streets): a bus trip is {BUS_ACCESS_MIN} min to and from stops + {BUS_WAIT_MIN} min average wait + riding at {BUS_KMH} km/h, and when walking is faster we use the walk. Estimates are marked &ldquo;est.&rdquo;
        </li>
        <li className="rounded-xl bg-paper px-3 py-2">
          <span className="font-medium text-ink">Unknowns:</span> an amenity the listing doesn&apos;t mention counts as not met; unknown rent is never $0; an unknown
          feature never satisfies a must-have.
        </li>
        <li className="rounded-xl bg-paper px-3 py-2">
          <span className="font-medium text-ink">Profiles:</span> only details each member confirmed are used. Weights start at {Object.values(DEFAULT_WEIGHTS).map((w) => Math.round(w * 100)).join("/")} (affordability/commute/amenities/lifestyle/space) and move 5 points
          per this-or-that answer.
        </li>
        <li className="rounded-xl bg-paper px-3 py-2">
          <span className="font-medium text-ink">What a score is:</span> a heuristic fit indicator from 0 to 100, not a probability that you&apos;ll like it or get
          it.
        </li>
      </ul>
    </section>
  );
}

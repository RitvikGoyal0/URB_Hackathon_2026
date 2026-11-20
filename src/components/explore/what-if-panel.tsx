"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { useMemo, useState } from "react";
import { ArrowRight, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getListing, listings } from "@/lib/data";
import { diffRankings } from "@/lib/engine";
import { actions } from "@/lib/store";
import type { MemberProfile, RankedResult } from "@/lib/types";
import { MemberAvatar } from "@/components/shared/bits";
import { fmtScore, memberColor, money } from "@/components/shared/format";

export const BUDGET_MIN = 500;
export const BUDGET_MAX = 1600;
export const BUDGET_STEP = 25;

export function BudgetSlider({
  value,
  onChange,
  color,
  label,
  baseline,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
  label: string;
  baseline?: number;
}) {
  const pct = (v: number) => ((v - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100;
  return (
    <SliderPrimitive.Root
      value={[value]}
      min={BUDGET_MIN}
      max={BUDGET_MAX}
      step={BUDGET_STEP}
      onValueChange={(v) => onChange(Array.isArray(v) ? (v as number[])[0] : (v as number))}
      thumbAlignment="edge"
      className="w-full"
    >
      <SliderPrimitive.Control className="relative flex h-7 w-full touch-none items-center select-none">
        <SliderPrimitive.Track className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <SliderPrimitive.Indicator className="h-full rounded-full" style={{ background: color }} />
        </SliderPrimitive.Track>
        {baseline !== undefined && baseline >= BUDGET_MIN && baseline <= BUDGET_MAX && (
          <span
            className="pointer-events-none absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded bg-ink/40"
            style={{ left: `calc(${pct(baseline)}% )` }}
            aria-hidden
          />
        )}
        <SliderPrimitive.Thumb
          aria-label={label}
          getAriaValueText={(_f: string, v: number) => `${money(v)} per month`}
          className="block size-6 rounded-full border-2 border-white shadow-[0_2px_8px_rgba(20,33,61,0.35)] outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
          style={{ background: color }}
        />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export function WhatIfPanel({
  people,
  baseMembers,
  members,
  baseline,
  ranking,
  changedInputs,
  compare,
  onCompareChange,
  onClose,
  className,
}: {
  people: MemberProfile[];
  baseMembers: MemberProfile[];
  members: MemberProfile[];
  baseline: RankedResult[];
  ranking: RankedResult[];
  changedInputs: string[];
  compare: boolean;
  onCompareChange: (v: boolean) => void;
  onClose: () => void;
  className?: string;
}) {
  const [allValue, setAllValue] = useState(() => Math.round(members.reduce((s, m) => s + m.budgetMax, 0) / members.length / 25) * 25);
  const changed = changedInputs.length > 0;

  const diff = useMemo(
    () => (changed ? diffRankings(baseline, ranking, { changedInputs, listings, members }) : null),
    [changed, baseline, ranking, changedInputs, members],
  );

  const rows = useMemo(() => {
    if (!changed) return [];
    const before = new Map(baseline.map((r) => [r.listingId, r]));
    return ranking
      .map((r) => ({ after: r, before: before.get(r.listingId) }))
      .filter(({ after, before: b }) => b && (b.rank !== after.rank || b.eligibility !== after.eligibility))
      .slice(0, 8);
  }, [changed, baseline, ranking]);

  const fallbackSentences = useMemo(() => {
    if (!changed) return [];
    const out: string[] = [];
    const prevTop = baseline[0]?.listingId;
    const newTop = ranking[0]?.listingId;
    if (prevTop && newTop && prevTop !== newTop) out.push(`${getListing(newTop)?.name} is now #1 (was ${getListing(prevTop)?.name}).`);
    const before = new Map(baseline.map((r) => [r.listingId, r]));
    for (const r of ranking) {
      const b = before.get(r.listingId);
      if (b?.eligibility === "blocked" && r.eligibility !== "blocked") out.push(`${getListing(r.listingId)?.name} is no longer blocked.`);
      if (b && b.eligibility !== "blocked" && r.eligibility === "blocked") out.push(`${getListing(r.listingId)?.name} is now blocked.`);
    }
    return out;
  }, [changed, baseline, ranking]);

  const sentences = (diff && diff.sentences.length > 0 ? diff.sentences : fallbackSentences).filter((x) => !x.startsWith("Changed:"));
  const beforeTop = baseline[0];
  const afterTop = ranking[0];
  const topName = (r?: RankedResult) => (r ? (getListing(r.listingId)?.name ?? r.listingId) : "No homes");

  return (
    <aside className={cn("flex flex-col rounded-[26px] border border-line bg-white", className)} aria-label="What-if budgets">
      <div className="flex items-start justify-between gap-3 border-b border-line p-5 pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-[19px] font-semibold text-ink">
            <Sparkles className="size-4.5 text-teal" aria-hidden /> What if budgets changed?
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Drag anyone&apos;s budget. Every home is re-scored for the whole group, and the list reorders live.
          </p>
        </div>
        <Button size="icon-sm" variant="ghost" className="rounded-full" onClick={onClose} aria-label="Close what-if panel">
          <X />
        </Button>
      </div>

      <div className="grid gap-5 overflow-y-auto p-5">
        <ul className="grid gap-4">
          {members.map((m, i) => {
            const person = people.find((p) => p.id === m.id) ?? m;
            const base = baseMembers[i]?.budgetMax ?? m.budgetMax;
            const c = memberColor(person, i);
            const diffAmt = m.budgetMax - base;
            return (
              <li key={m.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
                    <MemberAvatar member={person} index={i} size="xs" />
                    {person.displayName}
                    {m.budgetIsHardCap && <span className="text-[11.5px] font-normal text-blocker">hard cap</span>}
                  </span>
                  <span className="text-[14px] font-semibold text-ink tabular-nums">
                    {money(m.budgetMax)}
                    {diffAmt !== 0 && (
                      <span className={cn("ml-1.5 text-[12px] font-medium", diffAmt > 0 ? "text-teal" : "text-amber")}>
                        {diffAmt > 0 ? "+" : "−"}
                        {money(Math.abs(diffAmt))}
                      </span>
                    )}
                  </span>
                </div>
                <BudgetSlider
                  value={m.budgetMax}
                  baseline={base}
                  color={c.hex}
                  label={`${person.displayName}'s monthly budget`}
                  onChange={(v) => actions.setScenarioBudget(m.id, v)}
                />
              </li>
            );
          })}
        </ul>

        <div className="rounded-2xl bg-paper p-3.5">
          <div className="mb-1.5 flex items-center justify-between text-[13px]">
            <span className="font-medium text-ink">Everyone</span>
            <span className="font-semibold tabular-nums">{money(allValue)}</span>
          </div>
          <BudgetSlider value={allValue} onChange={setAllValue} color="#14213d" label="Budget to apply to all members" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full bg-white"
              onClick={() => actions.setScenarioBudgets(Object.fromEntries(members.map((m) => [m.id, allValue])))}
            >
              Apply to all
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => actions.resetScenario()} disabled={!changed}>
              <RotateCcw aria-hidden /> Reset
            </Button>
            <label className="ml-auto inline-flex items-center gap-2 text-[13px] text-charcoal">
              <Switch checked={compare} onCheckedChange={onCompareChange} />
              Compare
            </label>
          </div>
        </div>

        <section className="rounded-2xl border border-line p-4" aria-live="polite">
          <h3 className="text-[15px] font-semibold text-ink">What changed?</h3>
          {!changed ? (
            <p className="mt-1.5 text-[13px] text-muted-foreground">Nothing yet. These are everyone&apos;s saved budgets.</p>
          ) : (
            <>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {changedInputs.map((c) => (
                  <li key={c} className="rounded-full bg-secondary px-2.5 py-0.5 text-[12px] text-charcoal">
                    {c}
                  </li>
                ))}
              </ul>
              <dl className="mt-3 grid gap-2 text-[13px]">
                <div className="grid grid-cols-[3.75rem_1fr] gap-2 rounded-xl bg-paper px-3 py-2">
                  <dt className="text-muted-foreground">Before</dt>
                  <dd className="min-w-0 text-ink">
                    <span className="font-medium">#1 {topName(beforeTop)}</span>
                    {beforeTop?.groupScore != null && <span className="text-muted-foreground"> · match {fmtScore(beforeTop.groupScore)}</span>}
                  </dd>
                </div>
                <div className="grid grid-cols-[3.75rem_1fr] gap-2 rounded-xl bg-teal-soft px-3 py-2">
                  <dt className="font-medium text-teal">After</dt>
                  <dd className="min-w-0 text-ink">
                    <span className="font-semibold">#1 {topName(afterTop)}</span>
                    {afterTop?.groupScore != null && <span className="text-muted-foreground"> · match {fmtScore(afterTop.groupScore)}</span>}
                  </dd>
                </div>
                <div className="grid grid-cols-[3.75rem_1fr] gap-2 px-3 py-1">
                  <dt className="text-muted-foreground">Why</dt>
                  <dd className="min-w-0">
                    {sentences.length > 0 ? (
                      <ul className="grid gap-1">
                        {sentences.slice(0, 3).map((x, i) => (
                          <li key={i} className="leading-relaxed text-ink">
                            {x}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted-foreground">The ranking didn&apos;t move. Try a bigger change.</span>
                    )}
                  </dd>
                </div>
              </dl>
              {rows.length > 0 && (
                <table className="mt-3 w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 font-medium">Home</th>
                      <th className="py-1 text-right font-medium">Before</th>
                      <th className="w-5" />
                      <th className="py-1 text-right font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ before, after }) => (
                      <tr key={after.listingId} className="border-t border-line">
                        <td className="max-w-0 truncate py-1.5 pr-2 text-ink">{getListing(after.listingId)?.name}</td>
                        <td className={cn("py-1.5 text-right tabular-nums", before?.eligibility === "blocked" && "text-blocker")}>
                          #{before?.rank}
                          {before?.eligibility === "blocked" && <span className="ml-1 text-[10.5px] font-normal">blocked</span>}
                        </td>
                        <td className="text-center text-muted-foreground">
                          <ArrowRight className="mx-auto size-3" aria-hidden />
                        </td>
                        <td className={cn("py-1.5 text-right font-semibold tabular-nums", after.eligibility === "blocked" ? "text-blocker" : "text-ink")}>
                          #{after.rank}
                          {after.eligibility === "blocked" && <span className="ml-1 text-[10.5px] font-normal">blocked</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Scenario budgets are saved in this browser and only affect the ranking. Profiles stay as they are until you reset.
        </p>
      </div>
    </aside>
  );
}

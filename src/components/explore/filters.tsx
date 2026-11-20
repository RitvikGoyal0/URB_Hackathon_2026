"use client";

import { Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureKey, SourceType } from "@/lib/types";
import { FEATURE_LABEL, money } from "@/components/shared/format";
import { DEFAULT_FILTERS, isDefaultFilters, type Filters } from "@/lib/explore-query";
import { ToggleChip } from "@/components/profile/segmented";
import { BUDGET_MAX, BUDGET_MIN, BudgetSlider } from "./what-if-panel";

export { DEFAULT_FILTERS, isDefaultFilters, type Filters };

const SOURCE_OPTS: { value: SourceType; label: string; dot: string }[] = [
  { value: "haven", label: "Haven", dot: "bg-teal" },
  { value: "umich_offcampus", label: "U-M Off-Campus", dot: "bg-umblue" },
];

const FILTER_AMENITIES: FeatureKey[] = ["inUnitLaundry", "dishwasher", "parking", "largeKitchen", "ac", "furnished", "quietBuilding", "socialAmenities", "petFriendly"];

export function FilterBar({ value, onChange, showSources = true }: { value: Filters; onChange: (f: Filters) => void; showSources?: boolean }) {
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 rounded-[24px] border border-line bg-white p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[auto_auto_1fr]">
        {showSources && (
          <fieldset>
            <legend className="mb-2 text-[12.5px] font-medium text-muted-foreground">Source</legend>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_OPTS.map((o) => {
                const on = value.sources.includes(o.value);
                return (
                  <ToggleChip
                    key={o.value}
                    pressed={on}
                    onPressedChange={(v) =>
                      set({ sources: v ? [...value.sources, o.value] : value.sources.filter((s) => s !== o.value) })
                    }
                  >
                    <span className={cn("size-2.5 rounded-full", o.dot)} aria-hidden />
                    {o.label}
                  </ToggleChip>
                );
              })}
            </div>
          </fieldset>
        )}
        <fieldset>
          <legend className="mb-2 text-[12.5px] font-medium text-muted-foreground">Bedrooms</legend>
          <div className="flex flex-wrap gap-1.5">
            {(["any", "1", "2", "3", "4+"] as const).map((b) => (
              <ToggleChip key={b} pressed={value.bedrooms === b} onPressedChange={() => set({ bedrooms: b })}>
                {b === "any" ? "Any" : b}
              </ToggleChip>
            ))}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-2 flex w-full items-center justify-between text-[12.5px] font-medium text-muted-foreground">
            <span>Price per person</span>
            <span className="text-ink">{value.maxPrice === null ? "Any" : `Up to ${money(value.maxPrice)}`}</span>
          </legend>
          <BudgetSlider
            value={value.maxPrice ?? BUDGET_MAX}
            onChange={(v) => set({ maxPrice: v >= BUDGET_MAX ? null : v })}
            color="#14213d"
            label="Maximum price per person"
          />
          <div className="mt-1 flex items-center justify-between text-[11.5px] text-muted-foreground">
            <span>{money(BUDGET_MIN)}</span>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={value.includeUnpriced}
                onChange={(e) => set({ includeUnpriced: e.target.checked })}
                className="size-3.5 accent-[#14213d]"
              />
              Include homes with unverified pricing
            </label>
            <span>Any</span>
          </div>
        </fieldset>
      </div>
      <fieldset>
        <legend className="mb-2 text-[12.5px] font-medium text-muted-foreground">Must have (listed as yes)</legend>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_AMENITIES.map((a) => {
            const on = value.amenities.includes(a);
            return (
              <ToggleChip
                key={a}
                pressed={on}
                onPressedChange={(v) => set({ amenities: v ? [...value.amenities, a] : value.amenities.filter((x) => x !== a) })}
              >
                {on && <Check className="size-3.5" aria-hidden />}
                {FEATURE_LABEL[a]}
              </ToggleChip>
            );
          })}
          {!isDefaultFilters(value) && (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-teal hover:underline"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Clear filters
            </button>
          )}
        </div>
      </fieldset>
    </div>
  );
}

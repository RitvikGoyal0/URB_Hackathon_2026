"use client";

import Link from "next/link";
import { RotateCcw, Sparkles } from "lucide-react";
import { actions } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Shown on every page that reads the ranking outside Explore (lobby, watchlist, listing detail)
 * when what-if budgets are active, so a rank or score never silently reflects hypothetical budgets.
 */
export function ScenarioBanner({
  changedInputs,
  className,
}: {
  changedInputs: string[];
  className?: string;
}) {
  if (changedInputs.length === 0) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-teal/30 bg-teal/5 px-4 py-3 text-[13.5px] text-charcoal sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
        <span>
          <span className="font-semibold text-ink">
            What-if budgets applied:
          </span>{" "}
          {changedInputs.join("; ")}. Ranks and scores here use these budgets.
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-3 pl-6 sm:pl-0">
        <Link href="/explore" className="font-medium text-teal hover:underline">
          Adjust
        </Link>
        <button
          type="button"
          onClick={() => actions.resetScenario()}
          className="inline-flex items-center gap-1 font-medium text-charcoal hover:text-ink"
        >
          <RotateCcw className="size-3.5" aria-hidden /> Reset
        </button>
      </div>
    </div>
  );
}

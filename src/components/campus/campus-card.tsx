"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { University } from "@/lib/types";

export function campusHref(u: University) {
  return u.status === "active" ? "/onboarding" : `/campus/coming-soon?u=${u.slug}`;
}

/**
 * All four campuses share identical hover / selected styles (spec §3) so none looks dead
 * before it is clicked. The only difference is where the link goes.
 */
export function CampusCard({ university, compact = false }: { university: University; compact?: boolean }) {
  const [selected, setSelected] = useState(false);
  const count = university.havenCommunityNames.length;
  return (
    <Link
      href={campusHref(university)}
      onClick={() => setSelected(true)}
      data-selected={selected || undefined}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-[26px] border border-line bg-white p-5 transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_14px_40px_-24px_rgba(20,33,61,0.45)]",
        "focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none",
        "data-selected:border-teal data-selected:ring-2 data-selected:ring-teal/30",
        compact ? "min-h-40" : "min-h-56",
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            {university.city}, {university.state}
          </span>
          <ArrowUpRight className="size-5 text-ink/30 transition-colors group-hover:text-teal" aria-hidden />
        </div>
        <h3 className={cn("mt-3 font-semibold text-ink", compact ? "text-lg leading-snug" : "text-[22px] leading-tight")}>
          {university.name}
        </h3>
        {!compact && <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{university.description}</p>}
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="text-[12.5px] text-charcoal">
          <span className="font-semibold text-ink">{count}</span> Haven {count === 1 ? "community" : "communities"}
          <span className="block text-muted-foreground">{university.havenCommunityNames.join(", ")}</span>
        </div>
      </div>
    </Link>
  );
}

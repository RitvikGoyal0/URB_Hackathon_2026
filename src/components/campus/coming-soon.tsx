"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Sprout } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getUniversityBySlug, universities } from "@/lib/data";

export function ComingSoon() {
  const params = useSearchParams();
  const u = getUniversityBySlug(params.get("u") ?? "") ?? universities.find((x) => x.status === "coming_soon");
  const michigan = universities.find((x) => x.status === "active");
  const name = u?.name ?? "This campus";
  return (
    <div className="rounded-[30px] border border-line bg-white p-8 sm:p-12">
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-teal-soft text-teal">
        <Sprout className="size-6" aria-hidden />
      </span>
      <h1 className="mt-6 text-[2.2rem] leading-tight font-semibold text-ink sm:text-[2.8rem]">{name} is coming soon.</h1>
      <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
        We&apos;re mapping {u ? `${u.city}'s` : "its"} campus destinations and checking housing sources before we score anything there.
        {u && u.havenCommunityNames.length > 0 && (
          <>
            {" "}
            Haven communities we&apos;ll include: <span className="font-medium text-ink">{u.havenCommunityNames.join(", ")}</span>.
          </>
        )}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/onboarding" className={cn(buttonVariants(), "h-11 rounded-full px-5")}>
          Try {michigan?.shortName ?? "Michigan"} instead
        </Link>
        <Link href="/campus" className={cn(buttonVariants({ variant: "ghost" }), "h-11 rounded-full px-4")}>
          <ArrowLeft className="size-4" aria-hidden />
          All campuses
        </Link>
      </div>
    </div>
  );
}

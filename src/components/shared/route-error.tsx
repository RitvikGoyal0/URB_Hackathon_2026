"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shared fallback for route-level error.tsx files: never a dead end. */
export function RouteError({ error, retry, title }: { error: unknown; retry: () => void; title: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center px-4 pt-20 text-center">
      <h1 className="font-display text-2xl text-ink">{title}</h1>
      <p className="mt-2 text-[14.5px] text-charcoal">Something went wrong loading this page. Your profile and votes are safe.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={() => retry()} className={cn(buttonVariants(), "rounded-full px-5")}>
          Try again
        </button>
        <Link href="/explore" className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-5")}>
          All homes
        </Link>
      </div>
    </main>
  );
}

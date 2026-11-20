import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreView } from "@/components/explore/explore-view";
import { HydrationGate } from "@/components/shared/hydration-gate";

export const metadata: Metadata = { title: "Explore homes" };

const skeleton = (
  <main className="mx-auto w-full max-w-[90rem] px-4 pt-8 sm:px-6">
    <div className="h-12 w-80 animate-pulse rounded-2xl bg-white" />
    <div className="mt-8 grid gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-44 animate-pulse rounded-[26px] bg-white" />
      ))}
    </div>
  </main>
);

export default function ExplorePage() {
  return (
    <Suspense fallback={skeleton}>
      <HydrationGate fallback={skeleton}>
        <ExploreView />
      </HydrationGate>
    </Suspense>
  );
}

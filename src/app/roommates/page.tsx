import type { Metadata } from "next";
import { RoommatesView } from "@/components/roommates/suggested-roommates";
import { HydrationGate } from "@/components/shared/hydration-gate";

export const metadata: Metadata = { title: "Roommates" };

const skeleton = (
  <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
    <div className="h-12 w-96 max-w-full animate-pulse rounded-2xl bg-white" />
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-[22px] bg-white" />
      ))}
    </div>
  </main>
);

export default function RoommatesPage() {
  return (
    <HydrationGate fallback={skeleton}>
      <RoommatesView />
    </HydrationGate>
  );
}

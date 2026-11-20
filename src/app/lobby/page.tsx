import type { Metadata } from "next";
import { LobbyView } from "@/components/lobby/lobby-view";
import { HydrationGate } from "@/components/shared/hydration-gate";

export const metadata: Metadata = { title: "Your group" };

const skeleton = (
  <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
    <div className="h-12 w-72 animate-pulse rounded-2xl bg-white" />
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-56 animate-pulse rounded-[26px] bg-white" />
      ))}
    </div>
  </main>
);

export default function LobbyPage() {
  return (
    <HydrationGate fallback={skeleton}>
      <LobbyView />
    </HydrationGate>
  );
}

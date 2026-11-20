import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { HydrationGate } from "@/components/shared/hydration-gate";

export const metadata: Metadata = { title: "Dashboard" };

const skeleton = (
  <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
    <div className="h-12 w-80 animate-pulse rounded-2xl bg-white" />
    <div className="mt-8 grid gap-4 lg:grid-cols-2">
      <div className="h-44 animate-pulse rounded-[26px] bg-white" />
      <div className="h-44 animate-pulse rounded-[26px] bg-white" />
    </div>
  </main>
);

export default function DashboardPage() {
  return (
    <HydrationGate fallback={skeleton}>
      <DashboardView />
    </HydrationGate>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon } from "@/components/campus/coming-soon";

export const metadata: Metadata = { title: "Coming soon" };

export default function ComingSoonPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <Suspense fallback={<div className="h-72 animate-pulse rounded-[30px] bg-white" />}>
        <ComingSoon />
      </Suspense>
    </main>
  );
}

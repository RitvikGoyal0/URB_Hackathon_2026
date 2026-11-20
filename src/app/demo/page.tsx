import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { buildDemoProfile } from "@/lib/demo-profile";
import { DemoPanel } from "@/components/demo/demo-panel";
import { HydrationGate } from "@/components/shared/hydration-gate";

// Hidden presenter page (V3 §10): not linked anywhere and not indexed.
export const metadata: Metadata = { title: "Demo controls", robots: { index: false, follow: false } };

/** Yes/no only; the key's value never leaves the server. Read per request, not at build. */
async function KeyStatus() {
  await connection();
  const present = !!process.env.GEMINI_API_KEY;
  return <span className={present ? "font-semibold text-teal" : "font-semibold text-blocker"}>{present ? "Yes" : "No"}</span>;
}

export default function DemoPage() {
  const profile = buildDemoProfile();
  return (
    <HydrationGate fallback={<main className="mx-auto max-w-2xl px-4 py-10" />}>
      <DemoPanel
        demoProfile={profile}
        keyStatus={
          <Suspense fallback={<span className="text-muted-foreground">checking…</span>}>
            <KeyStatus />
          </Suspense>
        }
      />
    </HydrationGate>
  );
}

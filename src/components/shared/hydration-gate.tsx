"use client";

import type { ReactNode } from "react";
import { useHydrated } from "@/lib/store";

/**
 * Personalized views (scores, ranks, the group) depend on the profile in localStorage, which the
 * server can't see. Without this gate the server HTML scores the default persona and the numbers
 * visibly change once the client store loads. Render the fallback until the client snapshot is live.
 */
export function HydrationGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  return useHydrated() ? children : fallback;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { selectActiveLobby, useAppState, useHydrated } from "@/lib/store";

/** Old V2 route: send people to their active lobby, or the dashboard. */
export default function LobbyRedirect() {
  const router = useRouter();
  const hydrated = useHydrated();
  const lobby = selectActiveLobby(useAppState());
  useEffect(() => {
    if (hydrated) router.replace(lobby ? `/lobbies/${lobby.id}` : "/dashboard");
  }, [hydrated, lobby, router]);
  return <main className="mx-auto w-full max-w-7xl px-4 py-14 text-[14px] text-muted-foreground">Opening your group…</main>;
}

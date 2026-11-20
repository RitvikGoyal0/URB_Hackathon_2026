"use client";

import { useEffect, type ReactNode } from "react";
import { actions } from "@/lib/store";
import { CreateLobbyProvider } from "@/components/lobby/create-lobby";

/** Client-side app context: the Create Lobby dialog, and finishing invites left pending by a reload. */
export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    actions.resumeInvites();
  }, []);
  return <CreateLobbyProvider>{children}</CreateLobbyProvider>;
}

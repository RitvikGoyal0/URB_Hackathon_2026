import type { Metadata } from "next";
import { LobbyView } from "@/components/lobby/lobby-view";

export const metadata: Metadata = { title: "Your group" };

export default function LobbyPage() {
  return <LobbyView />;
}

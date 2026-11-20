import type { Metadata } from "next";
import { Suspense } from "react";
import { LobbyPageView } from "@/components/lobby/lobby-page-view";
import { HydrationGate } from "@/components/shared/hydration-gate";

export const metadata: Metadata = { title: "Lobby" };

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

async function Content({ params }: { params: PageProps<"/lobbies/[id]">["params"] }) {
  const { id } = await params;
  return (
    <HydrationGate fallback={skeleton}>
      <LobbyPageView id={id} />
    </HydrationGate>
  );
}

export default function LobbyPage(props: PageProps<"/lobbies/[id]">) {
  return (
    <Suspense fallback={skeleton}>
      <Content params={props.params} />
    </Suspense>
  );
}

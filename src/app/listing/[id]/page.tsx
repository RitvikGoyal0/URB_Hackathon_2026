import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getListing, listings } from "@/lib/data";
import { ListingDetail } from "@/components/listing/listing-detail";
import { HydrationGate } from "@/components/shared/hydration-gate";

export function generateStaticParams() {
  return listings.map((l) => ({ id: l.id }));
}

export async function generateMetadata(
  props: PageProps<"/listing/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  return { title: getListing(id)?.name ?? "Listing" };
}

async function ListingContent({
  params,
}: {
  params: PageProps<"/listing/[id]">["params"];
}) {
  const { id } = await params;
  if (!getListing(id)) notFound();
  return (
    <HydrationGate fallback={skeleton}>
      <ListingDetail id={id} />
    </HydrationGate>
  );
}

const skeleton = (
  <main className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
    <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-white" />
    <div className="mt-6 h-80 animate-pulse rounded-[24px] bg-white" />
  </main>
);

export default function ListingPage(props: PageProps<"/listing/[id]">) {
  return (
    <Suspense fallback={skeleton}>
      <ListingContent params={props.params} />
    </Suspense>
  );
}

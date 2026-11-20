import type { Metadata } from "next";
import { CampusCard } from "@/components/campus/campus-card";
import { universities } from "@/lib/data";

export const metadata: Metadata = { title: "Choose your campus" };

export default function CampusPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="max-w-2xl text-[2.4rem] leading-[1.05] font-semibold text-ink sm:text-[3.2rem]">
        Where are you looking for your next home?
      </h1>
      <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
        Pick your university. We&apos;ll use its campus map, neighborhoods and housing sources to score places for your group.
      </p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {universities.map((u) => (
          <CampusCard key={u.id} university={u} />
        ))}
      </div>
    </main>
  );
}

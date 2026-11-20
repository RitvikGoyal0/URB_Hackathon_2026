import type { Metadata } from "next";
import { ArrowUpRight, BookOpen, Bus, FileSignature, Home, Map, Search, ShieldCheck } from "lucide-react";
import { resources } from "@/lib/data";
import { PageIntro } from "@/components/shared/bits";

export const metadata: Metadata = { title: "Campus housing guide" };

const ICONS: Record<string, typeof Search> = {
  Search,
  Housing: Home,
  Neighborhoods: Map,
  Leases: FileSignature,
  Safety: ShieldCheck,
  Guide: BookOpen,
  Transit: Bus,
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function ResourcesPage() {
  const items = resources.filter((r) => r.campusId === "umich");
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageIntro title="Your Campus Housing Guide">
        University of Michigan resources for finding a place, signing a lease and getting around. Summaries are ours; follow the links for the
        official details.
      </PageIntro>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => {
          const Icon = ICONS[r.category] ?? BookOpen;
          return (
            <li key={r.id}>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="group flex h-full flex-col rounded-[26px] border border-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-ink/25 focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-teal-soft text-teal">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <ArrowUpRight className="size-5 text-ink/30 transition-colors group-hover:text-teal" aria-hidden />
                </div>
                <h2 className="mt-4 text-[18px] leading-snug font-semibold text-ink">{r.title}</h2>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted-foreground">{r.summary}</p>
                <p className="mt-4 text-[12.5px] font-medium text-charcoal">{hostOf(r.url)}</p>
              </a>
            </li>
          );
        })}
      </ul>
      <footer className="mt-10 rounded-[24px] bg-secondary p-5 text-[13px] leading-relaxed text-charcoal">
        This guide is informational only and is not legal advice. Read your lease carefully and contact the University&apos;s off-campus housing
        office or a qualified advisor with specific questions. This tool is not affiliated with, endorsed by, or sponsored by the University of
        Michigan or Hackberry Lane, and no university logos are used.
      </footer>
    </main>
  );
}

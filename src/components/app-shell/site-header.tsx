"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronDown, Menu, X } from "lucide-react";
import { universities } from "@/lib/data";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BRAND } from "@/components/shared/brand";

const NAV = [
  { href: "/lobby", label: "Dashboard" },
  { href: "/explore", label: "Explore" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/resources", label: "Resources" },
  { href: "/profile", label: "Profile" },
];

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5 rounded-lg", className)} aria-label={`${BRAND} home`}>
      <span className="relative inline-flex size-8 items-center justify-center rounded-[10px] bg-ink">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" fill="none" stroke="#f5f6f2" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="9" cy="10.5" r="1.3" fill="#14a37f" />
          <circle cx="15" cy="10.5" r="1.3" fill="#e8a33d" />
        </svg>
      </span>
      <span className="font-display text-[17px] font-semibold tracking-tight text-ink">{BRAND}</span>
    </Link>
  );
}

function CampusSwitcher() {
  const router = useRouter();
  const active = universities.find((u) => u.status === "active");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        aria-label="Switch campus"
      >
        <span className="size-2 rounded-full bg-emerald" aria-hidden />
        <span className="max-w-[9.5rem] truncate">{active?.name ?? "Choose campus"}</span>
        <ChevronDown className="size-3.5 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Campus</DropdownMenuLabel>
          {universities.map((u) => (
            <DropdownMenuItem
              key={u.id}
              className="justify-between gap-3 py-2"
              onClick={() => router.push(u.status === "active" ? "/lobby" : `/campus/coming-soon?u=${u.slug}`)}
            >
              <span className="flex flex-col">
                <span className="font-medium text-ink">{u.name}</span>
                <span className="text-xs text-muted-foreground">
                  {u.city}, {u.state}
                  {u.status === "coming_soon" ? " · Coming soon" : ""}
                </span>
              </span>
              {u.status === "active" && <Check className="size-4 text-teal" aria-hidden />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`) || (href === "/explore" && pathname.startsWith("/listing"));
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur supports-backdrop-filter:bg-paper/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <div className="hidden md:block">
          <CampusSwitcher />
        </div>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors",
                isActive(n.href) ? "bg-ink text-paper" : "text-charcoal/80 hover:bg-secondary hover:text-ink",
              )}
              aria-current={isActive(n.href) ? "page" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="ml-auto inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-secondary md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-paper px-4 pt-3 pb-5 md:hidden">
          <div className="mb-3">
            <CampusSwitcher />
          </div>
          <nav className="grid gap-1" aria-label="Main mobile">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-2xl px-4 py-3 text-[15px] font-medium",
                  isActive(n.href) ? "bg-ink text-paper" : "text-ink hover:bg-secondary",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-[12.5px] leading-relaxed text-muted-foreground sm:px-6 md:flex-row md:justify-between">
        <p className="max-w-2xl">
          Listings are a curated snapshot observed Nov 20, 2026, not live inventory. Scores are fit indicators, not probabilities.
          Not affiliated with the University of Michigan or Hackberry Lane.
        </p>
        <p>
          Map data © <a className="underline underline-offset-2" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
        </p>
      </div>
    </footer>
  );
}

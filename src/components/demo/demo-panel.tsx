"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { RotateCcw, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { actions, useAppState } from "@/lib/store";
import type { MemberProfile } from "@/lib/types";
import { Segmented } from "@/components/profile/segmented";

const STORAGE_KEY = "htl:app-state:v1";
const DELAYS = [0, 3000, 5000] as const;

function storeSize(): string {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return "empty";
    const bytes = new Blob([raw]).size;
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  } catch {
    return "unavailable (storage blocked)";
  }
}

/**
 * Presenter controls (V3 §10). Everything here touches only this browser's store; there is no
 * other data anywhere.
 */
export function DemoPanel({ demoProfile, keyStatus }: { demoProfile: MemberProfile; keyStatus: ReactNode }) {
  const state = useAppState();
  const [armed, setArmed] = useState(false);
  const delay = state.demo.inviteDelayMs;
  const delayValue = (DELAYS as readonly number[]).includes(delay) ? String(delay) : "custom";
  const votes = state.lobbies.reduce((n, l) => n + l.votes.length, 0) + state.solo.votes.length;
  const saved = state.lobbies.reduce((n, l) => n + l.watchlist.length, 0) + state.solo.watchlist.length;

  const rows: [string, ReactNode][] = [
    ["Gemini key present", keyStatus],
    ["Store size", storeSize()],
    ["Profile", state.liveProfile ? `${state.liveProfile.displayName} (saved)` : "Not set up (onboarding will run)"],
    ["Lobbies", String(state.lobbies.length)],
    ["Votes · saved homes", `${votes} · ${saved}`],
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-16 sm:px-6">
      <p className="text-[13px] font-medium text-teal">Presenter only · not linked anywhere</p>
      <h1 className="mt-1 text-[2rem] font-semibold text-ink">Demo controls</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
        Everything lives in this browser&apos;s storage. Reset clears it; nothing exists anywhere else.
      </p>

      <section className="mt-6 rounded-[24px] border border-line bg-white p-5" aria-labelledby="st-h">
        <h2 id="st-h" className="text-[17px] font-semibold text-ink">
          Status
        </h2>
        <dl className="mt-3 grid gap-2 text-[14px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-wrap justify-between gap-2 border-b border-line pb-2 last:border-0 last:pb-0">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-4 grid gap-3 rounded-[24px] border border-line bg-white p-5" aria-labelledby="ac-h">
        <h2 id="ac-h" className="text-[17px] font-semibold text-ink">
          Actions
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={armed ? "destructive" : "outline"}
            className="rounded-full"
            onClick={() => {
              if (!armed) return setArmed(true);
              actions.resetDemo();
              setArmed(false);
              toast.success("Demo reset. Lobbies, votes, saved homes, what-if and the profile are cleared.");
            }}
            onBlur={() => setArmed(false)}
          >
            <RotateCcw aria-hidden /> {armed ? "Click again to reset everything" : "Reset demo"}
          </Button>
          <span className="text-[12.5px] text-muted-foreground">Clears lobbies, votes, saved homes, what-if and onboarding.</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="rounded-full"
            onClick={() => {
              actions.setLiveProfile(demoProfile);
              toast.success("Demo profile loaded: the demo sentence, confirmed, plus MRacing at the Wilson Center.");
            }}
          >
            <UserRoundCheck aria-hidden /> Load demo profile
          </Button>
          {state.liveProfile && (
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }), "rounded-full")}>
              Go to dashboard
            </Link>
          )}
          <span className="basis-full text-[12.5px] text-muted-foreground">Skips onboarding. Lobbies and votes are left as they are.</span>
        </div>

        <div className="grid gap-1.5">
          <span className="text-[13.5px] font-medium text-ink">Invite delay (pending → joined)</span>
          <Segmented
            ariaLabel="Invite delay"
            value={delayValue as "0" | "3000" | "5000"}
            options={DELAYS.map((d) => ({ value: String(d) as "0" | "3000" | "5000", label: `${d / 1000} s` }))}
            onChange={(v) => actions.setInviteDelay(Number(v))}
          />
        </div>
      </section>
    </main>
  );
}

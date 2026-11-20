"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { actions, selectLiveProfile, useAppState, useHydrated } from "@/lib/store";
import type { MemberProfile } from "@/lib/types";
import { PageIntro, Note } from "@/components/shared/bits";
import { ProfileEditor } from "./profile-editor";

function Editor({ initial, onboarded }: { initial: MemberProfile; onboarded: boolean }) {
  const [draft, setDraft] = useState(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  return (
    <>
      {!onboarded && (
        <Note className="mb-5">
          You&apos;re seeing the demo profile. <Link href="/onboarding" className="font-medium text-teal underline">Describe your week</Link> to
          replace it, or edit it here.
        </Note>
      )}
      <ProfileEditor profile={draft} onChange={setDraft} />
      <div className="sticky bottom-3 z-10 mt-6 flex items-center justify-between gap-3 rounded-full border border-line bg-white/95 p-2 pl-5 shadow-lg backdrop-blur">
        <span className="text-[13px] text-muted-foreground">{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="ghost" className="rounded-full" onClick={() => setDraft(initial)}>
              Discard
            </Button>
          )}
          <Button
            className="h-10 rounded-full px-5"
            disabled={!dirty}
            onClick={() => {
              actions.setLiveProfile({ ...draft, displayName: draft.displayName.trim() || "Maya" });
              toast.success("Profile saved. Rankings updated.");
            }}
          >
            <Save aria-hidden /> Save changes
          </Button>
        </div>
      </div>
    </>
  );
}

export function ProfileView() {
  const state = useAppState();
  const hydrated = useHydrated();
  const router = useRouter();
  const live = selectLiveProfile(state);
  const onboarded = state.liveProfile !== null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <PageIntro title="Your profile">
        What the scoring engine knows about you. Roommates see your budget range and places, not your exact schedule.
      </PageIntro>
      {hydrated ? (
        <Editor key={JSON.stringify(live)} initial={live} onboarded={onboarded} />
      ) : (
        <div className="h-96 animate-pulse rounded-[26px] bg-white" />
      )}

      <section className="mt-12 rounded-[26px] border border-blocker/25 bg-white p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold text-ink">Privacy</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Your profile, votes, saved homes and what-if budgets are stored only in this browser. We never ask for demographic details. Deleting
          clears all of it; the seeded roommates stay as they are.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger render={<Button variant="destructive" className="h-10 rounded-full px-4" />}>
              <Trash2 aria-hidden /> Delete my profile
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete your profile?</DialogTitle>
                <DialogDescription>
                  This clears your profile, your votes, your watchlist changes and any what-if budgets from this browser. It can&apos;t be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" className="rounded-full" />}>Keep it</DialogClose>
                <DialogClose
                  render={<Button variant="destructive" className="rounded-full" />}
                  onClick={() => {
                    actions.deleteProfile();
                    toast("Profile deleted from this browser.");
                    router.push("/");
                  }}
                >
                  Delete everything
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Link href="/onboarding" className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-full px-4")}>
            Start over from a description
          </Link>
        </div>
      </section>
    </main>
  );
}

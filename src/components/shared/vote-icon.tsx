import { Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { VOTE_LABEL } from "@/components/shared/format";
import type { VoteValue } from "@/lib/types";

const ICON: Record<VoteValue, typeof ThumbsUp> = { interested: ThumbsUp, maybe: Minus, pass: ThumbsDown };
const TONE: Record<VoteValue, string> = {
  interested: "bg-teal-soft text-teal",
  maybe: "bg-secondary text-charcoal",
  pass: "bg-blocker-soft text-blocker",
};

/** One person's vote as an icon only: thumbs up / dash / thumbs down, or a dotted circle for no vote. */
export function VoteIcon({ name, value, className }: { name: string; value: VoteValue | undefined; className?: string }) {
  const label = `${name}: ${value ? VOTE_LABEL[value] : "No vote yet"}`;
  if (!value) {
    return <span role="img" aria-label={label} title={label} className={cn("inline-block size-6 shrink-0 rounded-full border-[1.5px] border-dashed border-muted-foreground/50", className)} />;
  }
  const Icon = ICON[value];
  return (
    <span role="img" aria-label={label} title={label} className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-full", TONE[value], className)}>
      <Icon className="size-3.5" aria-hidden />
    </span>
  );
}

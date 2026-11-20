import { cn } from "@/lib/utils";
import type { ConsensusLabel } from "@/lib/engine";

const TONE: Record<ConsensusLabel, string> = {
  "Everyone Interested": "bg-teal text-white",
  "Strong Interest": "bg-teal-soft text-teal",
  "Mixed Opinions": "bg-amber-soft text-[#8a5300]",
  "Significant Disagreement": "bg-blocker-soft text-blocker",
  "Under Consideration": "bg-umblue-soft text-umblue",
  "Awaiting Reviews": "bg-secondary text-muted-foreground",
};

export function ConsensusBadge({ label, className }: { label: ConsensusLabel; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center rounded-full px-3 text-[12.5px] font-semibold whitespace-nowrap", TONE[label], className)}>{label}</span>
  );
}

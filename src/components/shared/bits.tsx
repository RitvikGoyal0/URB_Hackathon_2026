import { AlertTriangle, Ban, CircleHelp, FlaskConical, Info, ShieldCheck, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Blocker, Listing, MemberProfile, RankedResult, SourceType, Warning } from "@/lib/types";
import { SOURCE_META, memberColor, shortDate } from "./format";

/** Source / provenance badge (spec §9). Required on every card, pin popup and detail page. */
export function SourceBadge({
  sourceType,
  observedAt,
  className,
  size = "sm",
}: {
  sourceType: SourceType;
  observedAt: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const base = cn(
    "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
    size === "sm" ? "h-6 px-2.5 text-[11.5px]" : "h-7 px-3 text-xs",
    className,
  );
  if (sourceType === "synthetic") {
    return (
      <span className={cn(base, "demo-stripes border border-[#e6b866] text-[#7a4700]")} title="Fictional listing created for the demo">
        <FlaskConical className="size-3.5" aria-hidden />
        DEMO — fictional
      </span>
    );
  }
  const meta = SOURCE_META[sourceType];
  const tone = sourceType === "haven" ? "bg-teal-soft text-teal" : "bg-umblue-soft text-umblue";
  const Icon = sourceType === "haven" ? ShieldCheck : Building;
  return (
    <span className={cn(base, tone)} title={`${meta.label}, ${meta.status.toLowerCase()} data observed ${shortDate(observedAt)}`}>
      <Icon className="size-3.5" aria-hidden />
      {meta.label} · {meta.status} {shortDate(observedAt)}
    </span>
  );
}

export function ListingSourceBadge({ listing, className, size }: { listing: Listing; className?: string; size?: "sm" | "md" }) {
  return <SourceBadge sourceType={listing.sourceType} observedAt={listing.provenance.observedAt} className={className} size={size} />;
}

export function MemberAvatar({
  member,
  index = 0,
  size = "md",
  className,
}: {
  member: Pick<MemberProfile, "displayName" | "color"> & { photo?: MemberProfile["photo"] };
  index?: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const c = memberColor(member, index);
  const dims = { xs: "size-5 text-[10px]", sm: "size-7 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg", xl: "size-20 text-2xl" }[size];
  if (member.photo?.dataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a small local data URL; next/image adds nothing here
      <img src={member.photo.dataUrl} alt="" aria-hidden className={cn("shrink-0 rounded-full object-cover ring-2 ring-white", dims, className)} />
    );
  }
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white", c.bg, dims, className)}
      aria-hidden
    >
      {member.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function CoverageBadge({ coverage, className }: { coverage: RankedResult["coverage"]; className?: string }) {
  if (coverage.evaluated >= coverage.total) return null;
  return (
    <span
      className={cn("inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-[#b8bcc4] px-2.5 text-[11.5px] font-medium text-muted-foreground", className)}
      title="Categories without data are left out and their weight is shared across the rest."
    >
      <CircleHelp className="size-3.5" aria-hidden />
      Scored on {coverage.evaluated} of {coverage.total} categories
    </span>
  );
}

export function BlockerChip({ blocker }: { blocker: Blocker }) {
  return (
    <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-blocker-soft px-2.5 py-0.5 text-[11.5px] font-medium text-blocker">
      <Ban className="size-3.5 shrink-0" aria-hidden />
      {blocker.message}
    </span>
  );
}

export function WarningChip({ warning }: { warning: Warning }) {
  return (
    <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-amber-soft px-2.5 py-0.5 text-[11.5px] font-medium text-[#8a5300]">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      {warning.message}
    </span>
  );
}

export function Chips({ result, max = 3 }: { result: RankedResult; max?: number }) {
  const warnings = dedupeWarnings(result.warnings);
  const shownWarnings = warnings.slice(0, Math.max(0, max - result.blockers.length));
  const hidden = result.blockers.length + warnings.length - result.blockers.length - shownWarnings.length;
  if (result.blockers.length === 0 && warnings.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {result.blockers.map((b, i) => (
        <BlockerChip key={`b${i}`} blocker={b} />
      ))}
      {shownWarnings.map((w, i) => (
        <WarningChip key={`w${i}`} warning={w} />
      ))}
      {hidden > 0 && <span className="inline-flex h-6 items-center px-1 text-[11.5px] text-muted-foreground">+{hidden} more</span>}
    </div>
  );
}

/** Group warnings that repeat for several members into one chip. */
export function dedupeWarnings(warnings: Warning[]): Warning[] {
  const seen = new Set<string>();
  return warnings.filter((w) => {
    const key = `${w.kind}:${w.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function Note({ children, tone = "info", className }: { children: React.ReactNode; tone?: "info" | "warn"; className?: string }) {
  return (
    <p
      className={cn(
        "flex gap-2 rounded-2xl px-4 py-3 text-[13px] leading-relaxed",
        tone === "info" ? "bg-secondary text-muted-foreground" : "bg-amber-soft text-[#7a4a00]",
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function PageIntro({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-[2rem] leading-[1.1] font-semibold text-ink sm:text-[2.5rem]">{title}</h1>
        {children && <div className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

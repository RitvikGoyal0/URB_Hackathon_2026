"use client";

import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex flex-wrap gap-1 rounded-full bg-secondary p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full font-medium transition-colors focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none",
              size === "sm" ? "px-3 py-1 text-[12.5px]" : "px-4 py-1.5 text-[13.5px]",
              active ? "bg-ink text-paper shadow-sm" : "text-charcoal/75 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ToggleChip({
  pressed,
  onPressedChange,
  children,
  className,
}: {
  pressed: boolean;
  onPressedChange: (v: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none",
        pressed ? "border-ink bg-ink text-paper" : "border-line bg-white text-charcoal hover:border-ink/30",
        className,
      )}
    >
      {children}
    </button>
  );
}

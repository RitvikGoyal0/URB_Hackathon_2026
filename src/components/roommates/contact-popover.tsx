"use client";

import { Popover } from "@base-ui/react/popover";
import { Copy, Mail, MessageSquare, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPhone, visibleContact } from "@/lib/contact";
import type { MemberProfile } from "@/lib/types";

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  } catch {
    toast.error("Couldn't copy. Select the text instead.");
  }
}

const linkCls =
  "inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[12.5px] font-medium text-charcoal hover:border-ink/30 focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none";

/** "Contact" → popover with the email / phone the student shared (only students who are looking). */
export function ContactPopover({ member, compact = false }: { member: MemberProfile; compact?: boolean }) {
  const c = visibleContact(member);
  if (!c) return null;
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={compact ? `Contact ${member.displayName}` : undefined}
        className={cn(
          "inline-flex h-7 items-center justify-center gap-1 rounded-full border border-line bg-white text-[12.5px] font-medium text-ink transition-colors hover:border-ink/30 focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none data-[popup-open]:border-ink",
          compact ? "w-7" : "px-2.5",
        )}
      >
        <Send className="size-3.5" aria-hidden />
        {!compact && "Contact"}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={16} className="z-50">
          <Popover.Popup className="w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-3.5 shadow-lg outline-none">
            <Popover.Title className="text-[14px] font-semibold text-ink">Reach out to {member.displayName}</Popover.Title>
            <Popover.Description className="mt-0.5 text-[12px] text-muted-foreground">Shared because {member.displayName} is looking for a roommate.</Popover.Description>
            <div className="mt-3 grid gap-3">
              {c.email && (
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] text-ink" title={c.email}>
                    {c.email}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <a href={`mailto:${c.email}`} className={linkCls}>
                      <Mail className="size-3.5" aria-hidden /> Email
                    </a>
                    <button type="button" className={linkCls} onClick={() => copy(c.email!)} aria-label={`Copy ${member.displayName}'s email`}>
                      <Copy className="size-3.5" aria-hidden /> Copy
                    </button>
                  </div>
                </div>
              )}
              {c.phone && (
                <div className="min-w-0">
                  <p className="text-[13.5px] text-ink tabular-nums">{formatPhone(c.phone)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <a href={`tel:+1${c.phone}`} className={linkCls}>
                      <Phone className="size-3.5" aria-hidden /> Call
                    </a>
                    <a href={`sms:+1${c.phone}`} className={linkCls}>
                      <MessageSquare className="size-3.5" aria-hidden /> Text
                    </a>
                    <button type="button" className={linkCls} onClick={() => copy(formatPhone(c.phone!))} aria-label={`Copy ${member.displayName}'s phone number`}>
                      <Copy className="size-3.5" aria-hidden /> Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

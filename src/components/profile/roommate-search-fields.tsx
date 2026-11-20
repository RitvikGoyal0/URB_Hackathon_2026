"use client";

import { useState } from "react";
import { Check, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPhone, normalizeEmail, normalizePhone, validateContact, type ContactDraft, type ContactErrors } from "@/lib/contact";
import type { MemberProfile, RoommateStatus } from "@/lib/types";

export const CONSENT_TEXT = "I understand my email and phone number will be shown to any student the app suggests as a possible roommate.";

const STATUS_OPTS: { value: RoommateStatus; label: string; hint: string; icon: typeof Search }[] = [
  { value: "looking", label: "Actively looking for a roommate", hint: "Other students can find you and reach out.", icon: Search },
  { value: "found", label: "Already found my roommates", hint: "You can still browse students and reach out.", icon: Users },
];

/** Draft for the form, from a saved profile. */
export function contactDraftFrom(p: MemberProfile): ContactDraft {
  return { email: p.contact?.email ?? "", phone: p.contact?.phone ? formatPhone(p.contact.phone) : "", consent: !!p.contact?.consentAt };
}

/** Apply a status + draft to a profile. Contact is saved only while looking (and only valid values). */
export function applyRoommateSearch(p: MemberProfile, status: RoommateStatus, d: ContactDraft, at = new Date().toISOString()): MemberProfile {
  if (status === "found") return { ...p, roommateStatus: "found", contact: null };
  const email = d.email.trim() ? normalizeEmail(d.email) : undefined;
  const phone = d.phone.trim() ? normalizePhone(d.phone) : undefined;
  return {
    ...p,
    roommateStatus: "looking",
    contact: { ...(email ? { email } : {}), ...(phone ? { phone } : {}), consentAt: p.contact?.consentAt ?? at },
  };
}

export function StatusChoice({ value, onChange }: { value: RoommateStatus | null; onChange: (s: RoommateStatus) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Are you looking for a roommate?">
      {STATUS_OPTS.map((o) => {
        const on = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-start gap-3 rounded-[22px] border-2 bg-white p-4 text-left transition-colors focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none sm:p-5",
              on ? "border-ink" : "border-line hover:border-ink/30",
            )}
          >
            <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full", on ? "bg-ink text-paper" : "bg-secondary text-charcoal")}>
              {on ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
            </span>
            <span className="min-w-0">
              <span className="block text-[16.5px] leading-snug font-semibold text-ink">{o.label}</span>
              <span className="mt-1 block text-[13.5px] text-muted-foreground">{o.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Email + phone + consent, with inline errors (shown once `showErrors` is on). */
export function ContactFields({
  draft,
  onChange,
  errors,
  showErrors,
  idPrefix = "rs",
}: {
  draft: ContactDraft;
  onChange: (d: ContactDraft) => void;
  errors: ContactErrors;
  showErrors: boolean;
  idPrefix?: string;
}) {
  const err = (k: keyof ContactErrors) => (showErrors ? errors[k] : undefined);
  return (
    <div className="grid gap-3 rounded-2xl border border-line bg-white px-4 py-4">
      <div>
        <p className="text-[15px] font-semibold text-ink">How matches can reach you</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Add at least one. Students the app suggests as roommates will see it.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-email`} className="text-[12.5px] font-medium text-muted-foreground">
            U-M email
          </label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="uniqname@umich.edu"
            value={draft.email}
            maxLength={80}
            aria-invalid={!!err("email") || undefined}
            onChange={(e) => onChange({ ...draft, email: e.target.value })}
            className="mt-1.5 h-10 rounded-xl bg-white text-[15px]"
          />
          {err("email") && <p className="mt-1 text-[12.5px] text-blocker">{err("email")}</p>}
        </div>
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-phone`} className="text-[12.5px] font-medium text-muted-foreground">
            Phone
          </label>
          <Input
            id={`${idPrefix}-phone`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(734) 555-0123"
            value={draft.phone}
            maxLength={20}
            aria-invalid={!!err("phone") || undefined}
            onChange={(e) => onChange({ ...draft, phone: e.target.value })}
            onBlur={(e) => onChange({ ...draft, phone: formatPhone(e.target.value) })}
            className="mt-1.5 h-10 rounded-xl bg-white text-[15px]"
          />
          {err("phone") && <p className="mt-1 text-[12.5px] text-blocker">{err("phone")}</p>}
        </div>
      </div>
      {err("contact") && <p className="text-[12.5px] text-blocker">{err("contact")}</p>}
      <label className="flex items-start gap-2.5 rounded-xl bg-paper px-3 py-2.5 text-[13.5px] leading-snug text-charcoal">
        <Checkbox
          checked={draft.consent}
          onCheckedChange={(v) => onChange({ ...draft, consent: v === true })}
          aria-invalid={!!err("consent") || undefined}
          className="mt-0.5"
        />
        <span>{CONSENT_TEXT}</span>
      </label>
      {err("consent") && <p className="-mt-1 text-[12.5px] text-blocker">{err("consent")}</p>}
    </div>
  );
}

export { validateContact };

/** /profile → "Roommate search": change status and contact later. Collapsed; saves on its own. */
export function RoommateSearchSettings({ profile, onSave }: { profile: MemberProfile; onSave: (p: MemberProfile) => void }) {
  const [status, setStatus] = useState<RoommateStatus | null>(profile.roommateStatus ?? null);
  const [draft, setDraft] = useState<ContactDraft>(() => contactDraftFrom(profile));
  const [showErrors, setShowErrors] = useState(false);
  const errors = validateContact(draft);
  const ok = Object.keys(errors).length === 0;
  return (
    <details className="group mt-6 rounded-[26px] border border-line bg-paper/60 p-4 sm:p-5">
      <summary className="cursor-pointer list-none text-[17px] font-semibold text-ink marker:hidden">
        Roommate search
        <span className="ml-2 text-[13px] font-normal text-muted-foreground">
          {profile.roommateStatus === "looking" ? "Actively looking" : profile.roommateStatus === "found" ? "Already found" : "Not set"}
        </span>
      </summary>
      <div className="mt-4 grid gap-4">
        <StatusChoice value={status} onChange={setStatus} />
        {status === "looking" && <ContactFields draft={draft} onChange={setDraft} errors={errors} showErrors={showErrors} idPrefix="pf-rs" />}
        <div>
          <Button
            className="h-10 rounded-full px-5"
            disabled={!status}
            onClick={() => {
              if (!status) return;
              if (status === "looking" && !ok) return setShowErrors(true);
              onSave(applyRoommateSearch(profile, status, draft));
              toast.success(status === "looking" ? "Saved. Matches can see how to reach you." : "Saved. Your contact details are hidden.");
            }}
          >
            Save roommate search
          </Button>
        </div>
      </div>
    </details>
  );
}

/**
 * Roommate-search contact details (shared with suggested matches only when a student is actively
 * looking and ticked the consent box). Pure helpers, no React.
 */
import type { MemberProfile } from "./types";

/** "name@umich.edu" (case-insensitive, trimmed). Only umich.edu addresses are accepted. */
export const UMICH_EMAIL_RE = /^[a-z0-9._%+-]+@umich\.edu$/;
/** 10 US digits, stored without formatting. */
export const PHONE_RE = /^\d{10}$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Digits only; a leading US country code (1) on an 11-digit number is dropped. */
export function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

export function isValidEmail(raw: string): boolean {
  return UMICH_EMAIL_RE.test(normalizeEmail(raw));
}

export function isValidPhone(raw: string): boolean {
  return PHONE_RE.test(normalizePhone(raw));
}

/** "7345550123" → "(734) 555-0123". Anything else is returned unchanged. */
export function formatPhone(digits: string): string {
  const d = normalizePhone(digits);
  return PHONE_RE.test(d) ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : digits;
}

export type ContactDraft = { email: string; phone: string; consent: boolean };
export type ContactErrors = { email?: string; phone?: string; contact?: string; consent?: string };

/** Errors for the "Actively looking" form: one valid contact method plus the ticked box. */
export function validateContact(d: ContactDraft): ContactErrors {
  const e: ContactErrors = {};
  const email = d.email.trim();
  const phone = d.phone.trim();
  if (email && !isValidEmail(email)) e.email = "Use your @umich.edu email.";
  if (phone && !isValidPhone(phone)) e.phone = "Enter a 10-digit US phone number.";
  if (!email && !phone) e.contact = "Add an email or a phone number so matches can reach you.";
  if (!d.consent) e.consent = "Tick the box to share your contact details with matches.";
  return e;
}

/** Contact details a match may see, or null (not looking, no consent, or nothing to show). */
export function visibleContact(m: MemberProfile): { email?: string; phone?: string } | null {
  if (m.roommateStatus !== "looking" || !m.contact?.consentAt) return null;
  const { email, phone } = m.contact;
  return email || phone ? { ...(email ? { email } : {}), ...(phone ? { phone } : {}) } : null;
}

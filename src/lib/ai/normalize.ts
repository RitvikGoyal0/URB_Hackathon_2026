import { createHash } from "node:crypto";

/** Spec §8.1: trim, collapse whitespace, lowercase — then hash for the demo cache. */
export function normalizeProfileText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function hashProfileText(text: string): string {
  return createHash("sha256").update(normalizeProfileText(text)).digest("hex");
}

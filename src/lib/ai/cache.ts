import cacheJson from "@/data/demo-parse-cache.json";
import { profileParse } from "../schemas";
import type { ProfileParse } from "../types";
import { hashProfileText } from "./normalize";

const entries = new Map<string, ProfileParse>(
  (cacheJson.entries as { textHash: string; parse: unknown }[]).map((e) => [e.textHash, profileParse.parse(e.parse)]),
);

/** Exact-demo-sentence cache (spec §8.1): returns instantly with no network call. */
export function lookupCachedParse(text: string): ProfileParse | null {
  const hit = entries.get(hashProfileText(text));
  return hit ? structuredClone(hit) : null;
}

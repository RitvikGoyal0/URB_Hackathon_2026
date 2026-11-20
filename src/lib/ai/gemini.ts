import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { profileParse } from "../schemas";
import type { CampusDestination, ProfileParse } from "../types";
import { buildSystemPrompt } from "./prompt";
import { sanitizeParse } from "./sanitize";

/**
 * Free-tier latency is spiky (the same model answers in ~1.5s or >15s), so models are RACED, not
 * tried in sequence: each entry starts after `delayMs`, the first valid parse wins and the rest are
 * aborted. Everything shares the spec's 8s budget (§8.1). GEMINI_MODEL env adds a model at t=0.
 * Models were benchmarked on this key on 2026-11-20; `-latest` aliases 404 on this API version and
 * gemini-3.8-flash rejects MINIMAL thinking, so no thinkingConfig is sent.
 */
const RACE: { model: string; delayMs: number }[] = [
  ...(process.env.GEMINI_MODEL ? [{ model: process.env.GEMINI_MODEL, delayMs: 0 }] : []),
  { model: "gemini-3.1-flash-lite", delayMs: 0 },
  { model: "gemini-3.5-flash-lite", delayMs: 0 },
  { model: "gemini-3.5-flash", delayMs: 1500 },
].filter((m, i, a) => a.findIndex((x) => x.model === m.model) === i);
const TIMEOUT_MS = 8000;

/** JSON Schema sent to Gemini; output is still validated with Zod (never trust the model). */
const responseJsonSchema = z.toJSONSchema(profileParse);

export class ParseError extends Error {}

export async function parseProfileWithGemini(text: string, destinations: CampusDestination[]): Promise<ProfileParse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ParseError("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey });
  const registryIds = new Set(destinations.map((d) => d.id));
  const systemInstruction = buildSystemPrompt(destinations);
  const done = new AbortController();
  const signal = AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), done.signal]);
  const errors: string[] = [];

  /** One model: call, parse JSON, validate; 1 retry on a validation failure (spec §8.1). */
  async function attempt(model: string, delayMs: number): Promise<ProfileParse> {
    if (delayMs > 0) await sleep(delayMs, signal);
    for (let tries = 0; tries < 2; tries++) {
      if (signal.aborted) throw new Error(`${model}: aborted`);
      let raw: string | undefined;
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text }] }],
          config: { systemInstruction, responseMimeType: "application/json", responseJsonSchema, temperature: 0, abortSignal: signal },
        });
        raw = res.text;
      } catch (err) {
        throw new Error(`${model}: ${err instanceof Error ? err.message.slice(0, 160) : String(err)}`);
      }
      if (!raw) throw new Error(`${model}: empty response`);
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`${model}: response was not JSON`);
      }
      const parsed = profileParse.safeParse(withDefaults(json));
      if (parsed.success) return sanitizeParse(parsed.data, text, registryIds);
      errors.push(`${model}: schema validation failed: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
    }
    throw new Error(`${model}: invalid output twice`);
  }

  try {
    return await Promise.any(
      RACE.map(({ model, delayMs }) =>
        attempt(model, delayMs).catch((err: unknown) => {
          errors.push(err instanceof Error ? err.message : String(err));
          throw err;
        }),
      ),
    );
  } catch {
    throw new ParseError(signal.aborted && !done.signal.aborted ? `timed out after ${TIMEOUT_MS}ms; ${errors.join(" | ")}` : errors.join(" | "));
  } finally {
    done.abort(); // cancel the losers
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(new Error("aborted"))), { once: true });
  });
}

/** Models sometimes omit empty arrays/objects; fill them before strict validation. */
function withDefaults(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const o = json as Record<string, unknown>;
  return {
    destinations: [],
    lifestyle: {},
    requirements: {},
    desiredAmenities: [],
    unmappedPlaces: [],
    missing: [],
    ...o,
  };
}

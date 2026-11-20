import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { profileParse } from "../schemas";
import type { CampusDestination, ProfileParse } from "../types";
import { buildSystemPrompt } from "./prompt";
import { sanitizeParse } from "./sanitize";

/** Tried in order; GEMINI_MODEL env overrides the first choice. */
const MODELS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
].filter((m, i, a) => a.indexOf(m) === i);
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
  const deadline = AbortSignal.timeout(TIMEOUT_MS);

  let lastError = "unknown error";
  let validationRetries = 0;
  // Model fallback on API errors (overload / retired model); 1 retry on validation
  // failure (spec §8.1). Everything shares the 8s deadline.
  for (const model of MODELS) {
    if (deadline.aborted) break;
    let res;
    try {
      res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text }] }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema,
          temperature: 0,
          // Extraction needs no deep reasoning; minimal thinking keeps latency inside the 8s budget.
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          abortSignal: deadline,
        },
      });
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message.slice(0, 160) : String(err)}`;
      continue;
    }
    const raw = res.text;
    if (!raw) {
      lastError = "empty response";
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      lastError = "response was not JSON";
      continue;
    }
    const parsed = profileParse.safeParse(withDefaults(json));
    if (parsed.success) return sanitizeParse(parsed.data, text, registryIds);
    lastError = `schema validation failed: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`;
    if (++validationRetries > 1) break;
  }
  throw new ParseError(lastError);
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

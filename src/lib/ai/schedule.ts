/**
 * Schedule screenshot → class rows (V3 §9.2). Provider-agnostic core so tests can inject a fake
 * model: `generate(model, image, signal)` returns the model's raw text. Same race as the profile
 * parse (first valid answer wins, losers aborted), with a 15 s budget.
 */
import { z } from "zod";
import { sanitizeSchedule, type DraftClass } from "../schedule-import";

export const SCHEDULE_TIMEOUT_MS = 15_000;

export const SCHEDULE_MODELS: { model: string; delayMs: number }[] = [
  { model: "gemini-3.5-flash", delayMs: 0 },
  { model: "gemini-3.1-flash-lite", delayMs: 0 },
  { model: "gemini-3.5-flash-lite", delayMs: 1500 },
];

export const SCHEDULE_PROMPT = `You read a university class schedule screenshot and list the classes in it.
Rules:
- Extract ONLY what is visible in the image. Never guess or invent a class, day, time or building.
- name: the course code and/or title as shown (e.g. "EECS 281 LEC").
- days: weekdays the class meets, as mon,tue,wed,thu,fri,sat,sun.
- start, end: 24-hour "HH:MM". If a time is not visible, use "".
- building: the building/room text exactly as shown (e.g. "1013 DOW"). If not visible, use "".
- One entry per class meeting pattern (lecture and discussion are separate entries).
- If the image is not a class schedule, return {"classes": []}.`;

const weekdayEnum = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
/** JSON Schema sent to the model; the answer is still sanitized (never trust the model). */
export const scheduleResponseJsonSchema = z.toJSONSchema(
  z.object({
    classes: z.array(z.object({ name: z.string(), days: z.array(weekdayEnum), start: z.string(), end: z.string(), building: z.string() })),
  }),
);

export interface ScheduleImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  /** base64, no data: prefix */
  data: string;
}

export type Generate = (model: string, image: ScheduleImage, signal: AbortSignal) => Promise<string | undefined>;

export class ScheduleParseError extends Error {
  constructor(
    message: string,
    readonly reason: "timeout" | "failed",
  ) {
    super(message);
  }
}

export async function parseScheduleImage(
  image: ScheduleImage,
  opts: { generate: Generate; timeoutMs?: number; models?: { model: string; delayMs: number }[] },
): Promise<DraftClass[]> {
  const timeoutMs = opts.timeoutMs ?? SCHEDULE_TIMEOUT_MS;
  const models = opts.models ?? SCHEDULE_MODELS;
  const done = new AbortController();
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = AbortSignal.any([timeout, done.signal]);
  const errors: string[] = [];

  async function attempt(model: string, delayMs: number): Promise<DraftClass[]> {
    if (delayMs > 0) await sleep(delayMs, signal);
    if (signal.aborted) throw new Error(`${model}: aborted`);
    const raw = await abortable(opts.generate(model, image, signal), signal).catch((err: unknown) => {
      throw new Error(`${model}: ${err instanceof Error ? err.message.slice(0, 160) : String(err)}`);
    });
    if (!raw) throw new Error(`${model}: empty response`);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(`${model}: response was not JSON`);
    }
    if (!json || typeof json !== "object" || !Array.isArray((json as { classes?: unknown }).classes)) throw new Error(`${model}: no classes array`);
    return sanitizeSchedule(json);
  }

  try {
    return await Promise.any(
      models.map(({ model, delayMs }) =>
        attempt(model, delayMs).catch((err: unknown) => {
          errors.push(err instanceof Error ? err.message : String(err));
          throw err;
        }),
      ),
    );
  } catch {
    if (timeout.aborted) throw new ScheduleParseError(`timed out after ${timeoutMs}ms`, "timeout");
    throw new ScheduleParseError(errors.join(" | ") || "no models", "failed");
  } finally {
    done.abort();
  }
}

/** Reject as soon as the signal aborts, even if the provider ignores it. */
function abortable<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const onAbort = () => reject(new Error("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => (signal.removeEventListener("abort", onAbort), resolve(v)),
      (e) => (signal.removeEventListener("abort", onAbort), reject(e)),
    );
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(new Error("aborted"))), { once: true });
  });
}

/** `data:image/png;base64,....` → ScheduleImage, or null if it isn't an allowed image. */
export function parseDataUrl(dataUrl: unknown, maxBytes: number): ScheduleImage | null {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) return null;
  const bytes = Math.floor((m[2].length * 3) / 4);
  if (bytes === 0 || bytes > maxBytes) return null;
  return { mimeType: m[1] as ScheduleImage["mimeType"], data: m[2] };
}

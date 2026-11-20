import { z } from "zod";
import { destinations } from "@/lib/data";
import { lookupCachedParse } from "@/lib/ai/cache";
import { parseProfileWithGemini } from "@/lib/ai/gemini";
import type { ParseResponse } from "@/lib/types";

const body = z.object({
  text: z.string().trim().min(1).max(2000),
  campusId: z.literal("umich"),
});

/**
 * POST /api/profile/parse  { text, campusId } → ParseResponse
 * 1. exact demo sentence → cached parse (instant, `cached: true`)
 * 2. otherwise Gemini (JSON schema + Zod validation + 1 retry, 8s budget)
 * 3. any failure → { ok: false } so the UI falls back to the manual form
 */
export async function POST(request: Request): Promise<Response> {
  let input: z.infer<typeof body>;
  try {
    input = body.parse(await request.json());
  } catch {
    return Response.json({ ok: false, error: "Invalid request" } satisfies ParseResponse, { status: 400 });
  }

  const cached = lookupCachedParse(input.text);
  if (cached) return Response.json({ ok: true, parse: cached, cached: true } satisfies ParseResponse);

  const campusDestinations = destinations.filter((d) => d.campusId === input.campusId);
  try {
    const parse = await parseProfileWithGemini(input.text, campusDestinations);
    return Response.json({ ok: true, parse, cached: false } satisfies ParseResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[profile/parse] Gemini failed:", message);
    return Response.json({ ok: false, error: "Couldn't read that automatically." } satisfies ParseResponse, { status: 502 });
  }
}

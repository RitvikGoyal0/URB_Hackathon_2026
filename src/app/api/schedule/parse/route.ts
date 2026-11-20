import { geminiScheduleGenerate } from "@/lib/ai/schedule-gemini";
import { ScheduleParseError, parseDataUrl, parseScheduleImage } from "@/lib/ai/schedule";
import { MAX_UPLOAD_BYTES, type DraftClass } from "@/lib/schedule-import";

export type ScheduleParseResponse =
  | { ok: true; classes: DraftClass[] }
  | { ok: false; reason: "bad_input" | "no_key" | "timeout" | "failed"; error: string };

const fail = (reason: Extract<ScheduleParseResponse, { ok: false }>["reason"], error: string, status: number) =>
  Response.json({ ok: false, reason, error } satisfies ScheduleParseResponse, { status });

/**
 * POST /api/schedule/parse  { image: "data:image/png;base64,..." } → ScheduleParseResponse
 * Every failure is a clean { ok: false } so the review table opens empty for manual entry.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("bad_input", "Send a JSON body with an image.", 400);
  }
  const image = parseDataUrl((body as { image?: unknown } | null)?.image, MAX_UPLOAD_BYTES);
  if (!image) return fail("bad_input", "Use a JPEG, PNG or WebP image under 8 MB.", 400);

  const generate = geminiScheduleGenerate();
  if (!generate) return fail("no_key", "Automatic reading isn't set up here. Enter your classes below.", 503);

  try {
    const classes = await parseScheduleImage(image, { generate });
    return Response.json({ ok: true, classes } satisfies ScheduleParseResponse);
  } catch (err) {
    const reason = err instanceof ScheduleParseError ? err.reason : "failed";
    console.error("[schedule/parse]", reason, err instanceof Error ? err.message : "unknown error");
    return reason === "timeout"
      ? fail("timeout", "Reading the screenshot took too long. Enter your classes below.", 504)
      : fail("failed", "Couldn't read that screenshot. Enter your classes below.", 502);
  }
}

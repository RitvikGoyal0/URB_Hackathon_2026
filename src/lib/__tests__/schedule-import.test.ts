import { describe, expect, it, vi, beforeEach } from "vitest";
import { defaultLivePersona } from "@/lib/data";
import { parseDataUrl, parseScheduleImage, ScheduleParseError } from "@/lib/ai/schedule";
import {
  applySchedule,
  classPlaceId,
  matchBuilding,
  normalizeDays,
  normalizeTime,
  rowProblem,
  sanitizeSchedule,
  suggestLocation,
  validateImageFile,
  type DraftClass,
} from "@/lib/schedule-import";

// ---------------------------------------------------------------- pure helpers

describe("validateImageFile", () => {
  it("accepts JPEG/PNG/WebP up to 8 MB", () => {
    expect(validateImageFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "image/webp", size: 8 * 1024 * 1024 })).toBeNull();
  });
  it("rejects other types, empty and oversized files with a readable message", () => {
    expect(validateImageFile({ type: "image/gif", size: 10 })).toMatch(/JPEG, PNG or WebP/);
    expect(validateImageFile({ type: "application/pdf", size: 10 })).toMatch(/JPEG/);
    expect(validateImageFile({ type: "image/jpeg", size: 0 })).toMatch(/empty/);
    expect(validateImageFile({ type: "image/jpeg", size: 8 * 1024 * 1024 + 1 })).toMatch(/8 MB/);
  });
});

describe("normalizeDays", () => {
  it.each([
    [["mon", "wed"], ["mon", "wed"]],
    ["MWF", ["mon", "wed", "fri"]],
    ["TTh", ["tue", "thu"]],
    ["TuTh", ["tue", "thu"]],
    ["TR", ["tue", "thu"]],
    ["Monday, Wednesday", ["mon", "wed"]],
    ["Thurs", ["thu"]],
    [["fri", "mon", "mon"], ["mon", "fri"]],
    ["", []],
    ["xyz", []],
    [42, []],
  ])("%j → %j", (input, want) => {
    expect(normalizeDays(input)).toEqual(want);
  });
});

describe("normalizeTime", () => {
  it.each([
    ["9:00", "09:00"],
    ["09:30", "09:30"],
    ["13:05", "13:05"],
    ["9:00 AM", "09:00"],
    ["12:00 PM", "12:00"],
    ["12:30 am", "00:30"],
    ["1:30pm", "13:30"],
    ["4 p.m.", "16:00"],
  ])("%s → %s", (input, want) => expect(normalizeTime(input)).toBe(want));
  it.each(["", "noon", "25:00", "9", "13:00 PM", "9:60", null])("%j → undefined", (input) => expect(normalizeTime(input)).toBeUndefined());
});

describe("sanitizeSchedule", () => {
  it("keeps visible fields, leaves missing ones blank, never confirms", () => {
    const rows = sanitizeSchedule({
      classes: [
        { name: " EECS  281 LEC ", days: ["mon", "wed"], start: "10:30", end: "12:00", building: "1013 DOW" },
        { name: "MATH 214", days: ["tue", "thu"], start: "", end: "", building: "" },
        { name: "", days: [], start: "", building: "" },
        "junk",
        null,
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: "EECS 281 LEC", days: ["mon", "wed"], start: "10:30", end: "12:00", building: "1013 DOW", confirmed: false });
    expect(rows[1]).toMatchObject({ start: "", end: "", building: "", confirmed: false });
  });
  it("handles non-objects and caps the number of rows", () => {
    expect(sanitizeSchedule(null)).toEqual([]);
    expect(sanitizeSchedule({ classes: "x" })).toEqual([]);
    const many = { classes: Array.from({ length: 50 }, (_, i) => ({ name: `C${i}`, days: ["mon"], start: "09:00", end: "10:00", building: "" })) };
    expect(sanitizeSchedule(many)).toHaveLength(30);
  });
});

describe("rowProblem", () => {
  const ok: DraftClass = { name: "EECS 281", days: ["mon"], start: "09:00", end: "10:00", building: "", confirmed: false };
  it("passes a complete row and names the first problem otherwise", () => {
    expect(rowProblem(ok)).toBeNull();
    expect(rowProblem({ ...ok, name: " " })).toMatch(/name/);
    expect(rowProblem({ ...ok, days: [] })).toMatch(/day/);
    expect(rowProblem({ ...ok, start: "" })).toMatch(/times/);
    expect(rowProblem({ ...ok, end: "09:00" })).toMatch(/after/);
  });
});

describe("matchBuilding", () => {
  it("matches building text with room numbers removed", () => {
    expect(matchBuilding("1800 Chemistry")?.id).toBe("chemistry");
    expect(matchBuilding("CHRYS 133")?.id).toBe("chrysler_center");
    expect(matchBuilding("Angell Hall")?.id).toBe("angell_hall");
    expect(matchBuilding("EECS 1311")?.id).toBe("eecs");
  });
  it("never matches placeholders or substrings", () => {
    expect(matchBuilding("TBA")).toBeUndefined();
    expect(matchBuilding("ONLINE")).toBeUndefined();
    expect(matchBuilding("1013")).toBeUndefined();
    expect(matchBuilding("ball")).toBeUndefined();
    expect(matchBuilding("1013 DOW")).toBeUndefined();
    expect(matchBuilding("1360 EH")).toBeUndefined();
  });
});

describe("applySchedule", () => {
  const maya = defaultLivePersona;
  const chem = suggestLocation({ building: "Chemistry" })!;
  const eecs = suggestLocation({ building: "EECS" })!;
  const row = (p: Partial<DraftClass>): DraftClass => ({ name: "X", days: ["mon"], start: "09:00", end: "10:00", building: "", confirmed: true, ...p });

  it("builds one class place per location with 2-hour-rule trips, keeps custom places", () => {
    const out = applySchedule(
      maya,
      [
        row({ name: "CHEM 130", days: ["mon", "wed", "fri"], start: "09:00", end: "10:00", building: "1800 Chem", location: chem }),
        // same day, starts 30 min after CHEM ends → not a new trip
        row({ name: "EECS 183", days: ["mon", "wed"], start: "10:30", end: "12:00", building: "EECS 1311", location: eecs }),
        // Tue/Thu first class → 2 trips
        row({ name: "EECS 203", days: ["tue", "thu"], start: "13:00", end: "14:30", location: eecs }),
      ],
      "2026-11-20T00:00:00Z",
    );
    const classPlaces = out.places!.filter((p) => p.kind === "class");
    expect(classPlaces.map((p) => [p.id, p.visitsPerWeek]).sort()).toEqual(
      [
        [classPlaceId(chem), 3],
        [classPlaceId(eecs), 2],
      ].sort(),
    );
    expect(out.places!.filter((p) => p.kind === "custom")).toEqual((maya.places ?? []).filter((p) => p.kind === "custom"));
    expect(out.schedule?.classes).toHaveLength(3);
    expect(out.schedule?.confirmedAt).toBe("2026-11-20T00:00:00Z");
  });

  it("drops incomplete rows, and unconfirmed or unlocated rows make no place", () => {
    const out = applySchedule(
      maya,
      [
        row({ name: "", location: chem }),
        row({ name: "Unconfirmed", confirmed: false, location: chem }),
        row({ name: "No location" }),
      ],
      "t",
    );
    expect(out.schedule?.classes.map((c) => c.name)).toEqual(["Unconfirmed", "No location"]);
    expect(out.places!.some((p) => p.kind === "class")).toBe(false);
  });

  it("replaces old class places on re-apply but keeps the student's importance", () => {
    const first = applySchedule(maya, [row({ location: chem })], "t1");
    const tuned = { ...first, places: first.places!.map((p) => (p.kind === "class" ? { ...p, importance: 3 as const } : p)) };
    const second = applySchedule(tuned, [row({ location: chem, days: ["mon", "tue"] })], "t2");
    const cls = second.places!.filter((p) => p.kind === "class");
    expect(cls).toHaveLength(1);
    expect(cls[0]).toMatchObject({ importance: 3, visitsPerWeek: 2 });
  });

  it("an empty schedule clears class places", () => {
    const first = applySchedule(maya, [row({ location: chem })], "t1");
    expect(applySchedule(first, [], "t2").places!.some((p) => p.kind === "class")).toBe(false);
  });
});

// ---------------------------------------------------------------- AI core (mocked model)

const png = { mimeType: "image/png" as const, data: "iVBORw0KGgo=" };
const good = JSON.stringify({ classes: [{ name: "EECS 281", days: ["mon"], start: "10:30", end: "12:00", building: "DOW 1013" }] });

describe("parseScheduleImage", () => {
  it("returns sanitized rows from the first valid model", async () => {
    const rows = await parseScheduleImage(png, { generate: async () => good, models: [{ model: "a", delayMs: 0 }] });
    expect(rows).toEqual([{ name: "EECS 281", days: ["mon"], start: "10:30", end: "12:00", building: "DOW 1013", confirmed: false }]);
  });
  it("a failing model loses to a working one", async () => {
    const generate = vi.fn(async (model: string) => {
      if (model === "bad") throw new Error("503");
      return good;
    });
    const rows = await parseScheduleImage(png, { generate, models: [{ model: "bad", delayMs: 0 }, { model: "ok", delayMs: 0 }] });
    expect(rows).toHaveLength(1);
  });
  it("times out cleanly when the model hangs", async () => {
    const hang = () => new Promise<string>(() => {});
    await expect(parseScheduleImage(png, { generate: hang, timeoutMs: 40, models: [{ model: "a", delayMs: 0 }] })).rejects.toMatchObject({ reason: "timeout" });
  });
  it("non-JSON or wrong-shape answers fail", async () => {
    await expect(parseScheduleImage(png, { generate: async () => "sorry", models: [{ model: "a", delayMs: 0 }] })).rejects.toBeInstanceOf(ScheduleParseError);
    await expect(parseScheduleImage(png, { generate: async () => "{}", models: [{ model: "a", delayMs: 0 }] })).rejects.toMatchObject({ reason: "failed" });
  });
});

describe("parseDataUrl", () => {
  it("accepts allowed image data URLs only", () => {
    expect(parseDataUrl("data:image/png;base64,iVBORw0KGgo=", 100)).toEqual(png);
    expect(parseDataUrl("data:image/gif;base64,R0lGOD==", 100)).toBeNull();
    expect(parseDataUrl("data:image/png;base64,", 100)).toBeNull();
    expect(parseDataUrl("data:image/png;base64,not base64!", 100)).toBeNull();
    expect(parseDataUrl("https://example.com/a.png", 100)).toBeNull();
    expect(parseDataUrl(123, 100)).toBeNull();
    expect(parseDataUrl("data:image/png;base64," + "A".repeat(200), 100)).toBeNull();
  });
});

// ---------------------------------------------------------------- route (mocked Gemini)

const gen = vi.hoisted(() => ({ impl: null as null | ((...a: unknown[]) => Promise<string | undefined>) }));
vi.mock("@/lib/ai/schedule-gemini", () => ({
  hasGeminiKey: () => gen.impl !== null,
  geminiScheduleGenerate: () => gen.impl,
}));
vi.mock("@/lib/ai/schedule", async (orig) => {
  const real = await orig<typeof import("@/lib/ai/schedule")>();
  return { ...real, parseScheduleImage: (img: Parameters<typeof real.parseScheduleImage>[0], o: Parameters<typeof real.parseScheduleImage>[1]) => real.parseScheduleImage(img, { ...o, timeoutMs: 60, models: real.SCHEDULE_MODELS.map((m) => ({ ...m, delayMs: 0 })) }) };
});

describe("POST /api/schedule/parse", () => {
  beforeEach(() => {
    gen.impl = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  const call = async (body: unknown) => {
    const { POST } = await import("@/app/api/schedule/parse/route");
    const res = await POST(new Request("http://x/api/schedule/parse", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
    return { status: res.status, json: await res.json() };
  };
  const image = "data:image/png;base64,iVBORw0KGgo=";

  it("success → rows", async () => {
    gen.impl = async () => good;
    const r = await call({ image });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ ok: true, classes: [{ name: "EECS 281", confirmed: false }] });
  });
  it("timeout → 504 with a manual-entry message", async () => {
    gen.impl = () => new Promise(() => {});
    const r = await call({ image });
    expect(r.status).toBe(504);
    expect(r.json).toMatchObject({ ok: false, reason: "timeout" });
  });
  it("model error → 502", async () => {
    gen.impl = async () => {
      throw new Error("quota");
    };
    const r = await call({ image });
    expect(r).toMatchObject({ status: 502, json: { ok: false, reason: "failed" } });
  });
  it("bad input → 400 (not JSON, no image, wrong type)", async () => {
    gen.impl = async () => good;
    expect((await call("not json")).json).toMatchObject({ ok: false, reason: "bad_input" });
    expect((await call({})).status).toBe(400);
    expect((await call({ image: "data:image/gif;base64,R0lGOD==" })).status).toBe(400);
  });
  it("key missing → 503 and the error never mentions the key", async () => {
    const r = await call({ image });
    expect(r.status).toBe(503);
    expect(r.json).toMatchObject({ ok: false, reason: "no_key" });
    expect(JSON.stringify(r.json)).not.toMatch(/GEMINI|API_KEY/i);
  });
});

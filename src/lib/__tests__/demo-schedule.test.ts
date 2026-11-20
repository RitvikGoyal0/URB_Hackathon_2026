/** Alex's demo schedule screenshot: the cached read and the buildings it maps to. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DEMO_SCHEDULE, DEMO_SCHEDULE_IMAGE_SHA256, demoScheduleRows } from "../demo-schedule";
import { matchBuilding, rowProblem } from "../schedule-import";
import { getBuilding } from "../data";
import { POST } from "@/app/api/schedule/parse/route";

vi.mock("server-only", () => ({}));
vi.stubEnv("GEMINI_API_KEY", "");

const png = readFileSync(join(process.cwd(), "public/demo/alex-schedule.png"));
const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
const post = (body: unknown) => POST(new Request("http://x/api/schedule/parse", { method: "POST", body: JSON.stringify(body) }));

describe("demo schedule screenshot", () => {
  it("the hash constant matches the image on disk (re-run scripts/render-demo-schedule.ts after edits)", () => {
    expect(createHash("sha256").update(png).digest("hex")).toBe(DEMO_SCHEDULE_IMAGE_SHA256);
  });

  it("every row is complete and its room maps to a known building on the right campus", () => {
    const areas = DEMO_SCHEDULE.map((c) => {
      const r = demoScheduleRows().find((x) => x.name === c.name)!;
      expect(rowProblem(r), c.name).toBeNull();
      const b = matchBuilding(c.building);
      expect(b, c.building).toBeDefined();
      return [c.name, getBuilding(b!.id)!.areaId];
    });
    expect(areas).toEqual([
      ["AEROSP 201 - 001", "north_campus"],
      ["MECHENG 211 - 002", "north_campus"],
      ["MATH 216 - 012", "central_campus"],
      ["PHYSICS 240 - 003", "central_campus"],
      ["AEROSP 201 - 011", "north_campus"],
      ["ENGR 151 - 004", "north_campus"],
    ]);
  });

  it("the API answers the demo screenshot from its known rows, without an AI key", async () => {
    const res = await post({ image: dataUrl, fileHash: DEMO_SCHEDULE_IMAGE_SHA256 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, classes: demoScheduleRows() });
  });

  it("any other image still goes to the AI (here: no key → manual entry)", async () => {
    const res = await post({ image: dataUrl, fileHash: "0".repeat(64) });
    const json = await res.json();
    expect(json.ok).toBe(false);
  });
});

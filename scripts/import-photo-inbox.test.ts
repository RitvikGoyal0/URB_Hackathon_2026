import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { INBOX, importPhotoInbox, typeFromName } from "./import-photo-inbox";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
let root = "";
const setup = (folders: Record<string, string[]>, rights?: object) => {
  root = mkdtempSync(join(tmpdir(), "inbox-"));
  mkdirSync(join(root, "src", "data"), { recursive: true });
  for (const [dir, files] of Object.entries(folders)) {
    mkdirSync(join(root, INBOX, dir), { recursive: true });
    for (const f of files) writeFileSync(join(root, INBOX, dir, f), JPEG);
  }
  if (rights) writeFileSync(join(root, INBOX, "rights.json"), JSON.stringify(rights));
};
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("photo inbox import", () => {
  it("room types come from file names", () => {
    expect(["01-exterior.webp", "02-living.webp", "03-kitchen.jpg", "04-dining.webp", "05-bedroom.png", "07-bathroom.webp", "09-gym.jpg"].map(typeFromName)).toEqual([
      "exterior",
      "interior",
      "kitchen",
      "interior",
      "bedroom",
      "bathroom",
      "amenity",
    ]);
  });

  it("imports only homes whose rights are recorded, and skips the rest", () => {
    setup(
      { "a__1-Main-St": ["01-exterior.jpg", "02-kitchen.jpg", "notes.txt"], "b__2-Elm-St": ["01-exterior.jpg"], "c__3-Oak": [], "zzz__Nowhere": ["01-x.jpg"] },
      { a: { rights: "permission", attribution: "Photo: used with permission" } },
    );
    const r = importPhotoInbox(root, ["a", "b", "c"]);
    expect(r.imported).toEqual([{ id: "a", photos: 2 }]);
    expect(r.waitingForRights).toEqual(["b"]);
    expect(r.empty).toEqual(["c"]);
    expect(r.problems.some((p) => p.includes("zzz"))).toBe(true);

    expect(readdirSync(join(root, "public/listings/a")).sort()).toEqual(["01-exterior.jpg", "02-kitchen.jpg", "credits.json"]);
    expect(existsSync(join(root, "public/listings/b"))).toBe(false);
    const manifest = JSON.parse(readFileSync(join(root, "src/data/listing-photos.json"), "utf8"));
    expect(manifest).toEqual({
      a: [
        { src: "/listings/a/01-exterior.jpg", type: "exterior", attribution: "Photo: used with permission", rights: "permission" },
        { src: "/listings/a/02-kitchen.jpg", type: "kitchen", attribution: "Photo: used with permission", rights: "permission" },
      ],
    });
  });

  it("re-running replaces a home's photos instead of piling them up", () => {
    setup({ a__x: ["01-exterior.jpg", "02-kitchen.jpg"] }, { a: { rights: "team-owned", attribution: "Photo: Sam" } });
    importPhotoInbox(root, ["a"]);
    rmSync(join(root, INBOX, "a__x", "02-kitchen.jpg"));
    importPhotoInbox(root, ["a"]);
    expect(readdirSync(join(root, "public/listings/a")).sort()).toEqual(["01-exterior.jpg", "credits.json"]);
  });

  it("a per-file caption overrides the home's caption for that file only", () => {
    setup(
      { a__x: ["01-living.jpg", "02-kitchen.jpg"] },
      { a: { rights: "permission", attribution: "Photo: used with permission", captions: { "01-living.jpg": "Photo: virtually staged, used with permission" } } },
    );
    importPhotoInbox(root, ["a"]);
    const credits = JSON.parse(readFileSync(join(root, "public/listings/a/credits.json"), "utf8"));
    expect(credits.map((c: { attribution: string }) => c.attribution)).toEqual([
      "Photo: virtually staged, used with permission",
      "Photo: used with permission",
    ]);
  });

  it("an incomplete rights entry doesn't count", () => {
    setup({ a__x: ["01-exterior.jpg"] }, { a: { rights: "found it online", attribution: "" } });
    expect(importPhotoInbox(root, ["a"]).waitingForRights).toEqual(["a"]);
  });
});

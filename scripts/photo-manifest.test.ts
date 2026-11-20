import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { MANIFEST_PATH, buildPhotoManifest } from "./photo-manifest";
import { getListingPhotos, listings } from "../src/lib/data";

const root = join(__dirname, "..");
const ids = listings.map((l) => l.id);

describe("committed photo manifest", () => {
  it("matches public/listings/*/credits.json (run `npm run photos` after adding photos)", () => {
    const onDisk = JSON.parse(readFileSync(join(root, MANIFEST_PATH), "utf8"));
    expect(onDisk).toEqual(buildPhotoManifest(root, ids).manifest);
  });
  it("every listing's images come only from the manifest", () => {
    for (const l of listings) expect(l.images).toEqual(getListingPhotos(l.id).map((p) => p.src));
  });
});

describe("buildPhotoManifest", () => {
  const tmp = mkdtempSync(join(tmpdir(), "htl-photos-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  const dir = (id: string) => {
    const d = join(tmp, "public", "listings", id);
    mkdirSync(d, { recursive: true });
    return d;
  };
  const write = (id: string, files: Record<string, string | Buffer>, credits: unknown) => {
    const d = dir(id);
    for (const [f, c] of Object.entries(files)) writeFileSync(join(d, f), c);
    if (credits !== undefined) writeFileSync(join(d, "credits.json"), typeof credits === "string" ? credits : JSON.stringify(credits));
  };

  write("good", { "01-exterior.jpg": "x", "02-kitchen.webp": "x", "03-extra.jpg": "x" }, [
    { file: "01-exterior.jpg", type: "exterior", attribution: "Photo: Maya", rights: "team-owned" },
    { file: "02-kitchen.webp", type: "kitchen", attribution: " Photo: owner, with permission ", rights: "permission" },
    { file: "missing.jpg", type: "exterior", attribution: "x", rights: "team-owned" },
    { file: "03-extra.jpg", type: "exterior", attribution: "x", rights: "scraped" },
    { file: "../../secret.jpg", type: "exterior", attribution: "x", rights: "team-owned" },
  ]);
  write("nocredits", { "01.jpg": "x" }, undefined);
  write("badjson", {}, "{nope");
  write("unknown_listing", { "01.jpg": "x" }, []);
  write("big", { "01-exterior.jpg": Buffer.alloc(2_000_001) }, [{ file: "01-exterior.jpg", type: "exterior", attribution: "x", rights: "team-owned" }]);

  const { manifest, problems } = buildPhotoManifest(tmp, ["good", "nocredits", "badjson", "big"]);

  it("keeps only listed, existing, credited, permitted files, in order", () => {
    expect(manifest).toEqual({
      good: [
        { src: "/listings/good/01-exterior.jpg", type: "exterior", attribution: "Photo: Maya", rights: "team-owned" },
        { src: "/listings/good/02-kitchen.webp", type: "kitchen", attribution: "Photo: owner, with permission", rights: "permission" },
      ],
    });
  });
  it("explains every skipped entry", () => {
    const text = problems.join("\n");
    expect(text).toMatch(/good\/missing\.jpg: file not found/);
    expect(text).toMatch(/good\/03-extra\.jpg: rights must be/);
    expect(text).toMatch(/good\/\.\.\/\.\.\/secret\.jpg: file name/);
    expect(text).toMatch(/nocredits: missing credits\.json/);
    expect(text).toMatch(/badjson: credits\.json is not valid JSON/);
    expect(text).toMatch(/unknown_listing: no listing with this id/);
    expect(text).toMatch(/big\/01-exterior\.jpg: over 2 MB/);
  });
  it("no public/listings folder → empty manifest", () => {
    expect(buildPhotoManifest(join(tmp, "nowhere"), ids)).toEqual({ manifest: {}, problems: [] });
  });
});

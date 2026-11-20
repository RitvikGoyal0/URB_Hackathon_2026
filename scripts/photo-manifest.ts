/**
 * Listing photo manifest (V3 §9.3, §11.2). Reads public/listings/<id>/credits.json for every
 * listing and writes src/data/listing-photos.json, which the app reads (the browser can't list
 * folders). A test fails if the manifest is out of date, so run this after adding photos:
 *
 *   npm run photos
 *
 * Only files listed in credits.json with rights "team-owned" or "permission" are included.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ListingPhoto {
  src: string;
  type: "exterior" | "interior" | "kitchen" | "bedroom" | "bathroom" | "amenity";
  attribution: string;
  rights: "team-owned" | "permission";
}
export type PhotoManifest = Record<string, ListingPhoto[]>;

const TYPES = new Set(["exterior", "interior", "kitchen", "bedroom", "bathroom", "amenity"]);
const RIGHTS = new Set(["team-owned", "permission"]);
const FILE = /^[a-z0-9][a-z0-9._-]*\.(jpe?g|webp|png)$/i;
const MAX_BYTES = 2_000_000;

/** Build the manifest; `problems` lists every entry that was skipped and why. */
export function buildPhotoManifest(root: string, listingIds: string[]): { manifest: PhotoManifest; problems: string[] } {
  const manifest: PhotoManifest = {};
  const problems: string[] = [];
  const base = join(root, "public", "listings");
  if (!existsSync(base)) return { manifest, problems };
  const known = new Set(listingIds);
  for (const id of readdirSync(base).sort()) {
    const dir = join(base, id);
    if (!statSync(dir).isDirectory()) continue;
    if (!known.has(id)) {
      problems.push(`${id}: no listing with this id`);
      continue;
    }
    const creditsPath = join(dir, "credits.json");
    if (!existsSync(creditsPath)) {
      problems.push(`${id}: missing credits.json, so no photos are shown`);
      continue;
    }
    let credits: unknown;
    try {
      credits = JSON.parse(readFileSync(creditsPath, "utf8"));
    } catch {
      problems.push(`${id}: credits.json is not valid JSON`);
      continue;
    }
    if (!Array.isArray(credits)) {
      problems.push(`${id}: credits.json must be a list`);
      continue;
    }
    const photos: ListingPhoto[] = [];
    for (const c of credits as Record<string, unknown>[]) {
      const file = typeof c?.file === "string" ? c.file : "";
      const where = `${id}/${file || "?"}`;
      if (!FILE.test(file)) problems.push(`${where}: file name must be like 01-exterior.jpg`);
      else if (!existsSync(join(dir, file))) problems.push(`${where}: file not found`);
      else if (statSync(join(dir, file)).size > MAX_BYTES) problems.push(`${where}: over 2 MB, please resize`);
      else if (!TYPES.has(String(c.type))) problems.push(`${where}: type must be one of ${[...TYPES].join(", ")}`);
      else if (!RIGHTS.has(String(c.rights))) problems.push(`${where}: rights must be "team-owned" or "permission"`);
      else if (typeof c.attribution !== "string" || !c.attribution.trim()) problems.push(`${where}: attribution is required`);
      else photos.push({ src: `/listings/${id}/${file}`, type: c.type as ListingPhoto["type"], attribution: c.attribution.trim(), rights: c.rights as ListingPhoto["rights"] });
    }
    if (photos.length > 0) manifest[id] = photos;
  }
  return { manifest, problems };
}

export const MANIFEST_PATH = join("src", "data", "listing-photos.json");

if (process.argv[1]?.endsWith("photo-manifest.ts")) {
  const root = join(__dirname, "..");
  const ids = (JSON.parse(readFileSync(join(root, "src/data/listings.json"), "utf8")) as { id: string }[]).map((l) => l.id);
  const { manifest, problems } = buildPhotoManifest(root, ids);
  writeFileSync(join(root, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + "\n");
  const count = Object.values(manifest).reduce((s, p) => s + p.length, 0);
  console.log(`Wrote ${MANIFEST_PATH}: ${count} photos for ${Object.keys(manifest).length} listings.`);
  for (const p of problems) console.warn(`  skipped: ${p}`);
}

/**
 * `npm run photos:import`: copy the private photo inbox into the app.
 *
 * photo-inbox/<listing id>__<address>/NN-<room>.<ext>   (git-ignored; never published)
 * photo-inbox/rights.json   { "<listing id>": { "rights": "team-owned" | "permission", "attribution": "Photo: …" } }
 *
 * A home is imported only once its rights are recorded in rights.json. Its folder in
 * public/listings/<id>/ is replaced with an exact copy of the inbox folder plus a generated
 * credits.json (room type taken from the file name), then src/data/listing-photos.json is rebuilt.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MANIFEST_PATH, buildPhotoManifest, type ListingPhoto } from "./photo-manifest";

export const INBOX = "photo-inbox";
const IMAGE = /^[a-z0-9][a-z0-9._-]*\.(jpe?g|webp|png)$/i;

/** `captions` optionally overrides the attribution for single files, e.g. a virtually staged room. */
type Rights = Record<string, { rights: ListingPhoto["rights"]; attribution: string; captions?: Record<string, string> }>;

/** Room type from a file name like "03-kitchen.webp". Living, dining and anything else → interior. */
export function typeFromName(file: string): ListingPhoto["type"] {
  const n = file.toLowerCase();
  if (/exterior|outside|front|building|street/.test(n)) return "exterior";
  if (/kitchen/.test(n)) return "kitchen";
  if (/bath/.test(n)) return "bathroom";
  if (/bed/.test(n)) return "bedroom";
  if (/amenity|gym|pool|lounge|rooftop|laundry|parking/.test(n)) return "amenity";
  return "interior";
}

export interface ImportResult {
  imported: { id: string; photos: number }[];
  waitingForRights: string[];
  empty: string[];
  problems: string[];
}

export function importPhotoInbox(root: string, listingIds: string[]): ImportResult {
  const inbox = join(root, INBOX);
  const result: ImportResult = { imported: [], waitingForRights: [], empty: [], problems: [] };
  if (!existsSync(inbox)) return result;

  const rightsPath = join(inbox, "rights.json");
  const rights: Rights = existsSync(rightsPath) ? JSON.parse(readFileSync(rightsPath, "utf8")) : {};

  for (const dir of readdirSync(inbox, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const id = dir.split("__")[0];
    if (!listingIds.includes(id)) {
      result.problems.push(`${dir}: no listing with id "${id}"`);
      continue;
    }
    const files = readdirSync(join(inbox, dir)).filter((f) => IMAGE.test(f)).sort();
    if (files.length === 0) {
      result.empty.push(id);
      continue;
    }
    const r = rights[id];
    if (!r || (r.rights !== "team-owned" && r.rights !== "permission") || !r.attribution?.trim()) {
      result.waitingForRights.push(id);
      continue;
    }
    const dest = join(root, "public", "listings", id);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    for (const f of files) copyFileSync(join(inbox, dir, f), join(dest, f));
    const credits = files.map((file) => ({
      file,
      type: typeFromName(file),
      attribution: (r.captions?.[file]?.trim() || r.attribution).trim(),
      rights: r.rights,
    }));
    writeFileSync(join(dest, "credits.json"), JSON.stringify(credits, null, 2) + "\n");
    result.imported.push({ id, photos: files.length });
  }

  const { manifest, problems } = buildPhotoManifest(root, listingIds);
  writeFileSync(join(root, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + "\n");
  result.problems.push(...problems);
  return result;
}

if (process.argv[1]?.endsWith("import-photo-inbox.ts")) {
  const root = join(__dirname, "..");
  const ids = (JSON.parse(readFileSync(join(root, "src/data/listings.json"), "utf8")) as { id: string }[]).map((l) => l.id);
  const r = importPhotoInbox(root, ids);
  for (const i of r.imported) console.log(`imported  ${i.id}: ${i.photos} photos`);
  for (const id of r.waitingForRights) console.log(`waiting   ${id}: has photos, but no rights entry in ${INBOX}/rights.json`);
  console.log(`${r.empty.length} homes have no photos yet.`);
  for (const p of r.problems) console.warn(`problem   ${p}`);
}

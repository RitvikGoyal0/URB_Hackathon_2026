# Rentezvous

**Find roommates who fit your lifestyle and homes that fit your group.**

A housing decision tool for University of Michigan students. A student describes their week in plain English, and the app turns that into a profile they confirm. They then create a housing group (a "lobby"), invite friends, and find compatible roommates. Real Ann Arbor listings are scored for every member and for the group. The app shows who is compromising and by how much, and how the ranking changes if a budget changes. Then the group votes.

Built for Hack the Lease 2026 (Nov 20, 2026). The V3 scope and rules are in [`.plans/v3-refinement-spec.md`](.plans/v3-refinement-spec.md). The original MVP spec is [`hack-the-lease-mvp-spec.md`](hack-the-lease-mvp-spec.md).

Live: https://rentezvous.vercel.app

> **The students are fictional.** Jordan, Sam, Riley and the other roommates are invented personas, and the app shows no demo tags, at the team's request. The presenter says so on stage. **Every listing is real.**

---

## Run it

Requires Node 20+ (developed on Node 26).

```bash
npm install
cp .env.example .env.local   # then add GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Demo-laptop backup. No network is needed except for live Gemini, and the demo sentence is cached:

```bash
npm run build && npm start
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest: engine, store, AI guardrails, routes, end-to-end demo path |
| `npm run check` | Typecheck + lint + tests (run before every push) |
| `npm run photos` | Validate team listing photos and regenerate `src/data/listing-photos.json` ([docs/listing-photos.md](docs/listing-photos.md)) |
| `npm run build:commute` | Rebuild the OSRM commute matrix (uses the network; not needed to run the app) |

### Environment variables

| Variable | Required | Where | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | For live parsing | Server only | Parses the free-text profile (`/api/profile/parse`) and reads schedule screenshots (`/api/schedule/parse`). Never sent to the client. Without it, the exact demo sentence still works from the cache, other text goes to the manual form, and schedules can be typed in by hand. |
| `NEXT_PUBLIC_AGENTATION_ENDPOINT` | No | Dev only | Sends [agentation](https://agentation.com) toolbar annotations to the local MCP server in `.mcp.json`. Not rendered in production. |

---

## Demo (about 5 minutes)

The full click-by-click script, with the expected home and score at every step, is in **[docs/demo-walkthrough.md](docs/demo-walkthrough.md)**. In short:

1. **Offstage:** `/demo` → **Reset demo** (or **Load demo profile** to skip onboarding).
2. **Profile as "Alex":** click the **North Campus aerospace engineer** example chip (cached, instant) → on Check it turn on **A private bedroom** and tap **Air conditioning** → Confirm all → Actively looking, Aerospace Engineering, MRacing, umich.edu email → "Where is MRacing?" Wilson Center, a few times a week, Bike, High → upload `public/demo/alex-schedule.png` (also on `/demo`; recognised without an AI call), Yes + "This is right" for all 6 classes → More space / Lower rent / A room of my own.
3. **Lobby** "Engineering House" (4) → invite **Jordan** and **Sam** → Explore: **1805 Fair St** is #1, State Street Village is blocked by Sam's budget ($35 over).
4. **Roommates:** **Riley** is a *Great match · 95* → Contact → Invite. Fair St stays #1 (Jordan is the least satisfied there).
5. **What if budgets changed?** Sam $850 → **$950**: **State Street Village** becomes #1, "because it became affordable for Sam".

The walkthrough is locked by tests on the real catalog:
- `src/lib/__tests__/demo-path.test.ts`: the exact inputs → Alex's profile → Riley as the top match → the ranking at every step → the flip (any Sam budget from $900 to $1,100).
- `src/lib/engine/__tests__/demo-flip.test.ts`: State Street Village flips to #1 with every possible 4th roommate, by bike, bus or on foot.

---

## How scoring works

All scoring is deterministic and lives in `src/lib/engine/`: pure functions, no React, no LLM. Every tunable number is in `constants.ts`. In the app, the method sits in one collapsed **"How we score"** section on the listing page, and nowhere else shows formulas.

**Who is scored.** You plus the *joined* members of the active lobby. Invited members aren't scored until they join. With no lobby you search solo.

**Which homes.** In a lobby, only homes with exactly as many bedrooms as the lobby's size. Solo shows every size.

**Rent per person (per room)**
- Whole-unit rent: rent ÷ bedrooms. A studio is the whole rent.
- Per-bed or per-person rent: used as listed, plus per-person fees.
- Unknown rent shows as "Pricing not verified", and affordability isn't scored. **Unknown rent is never $0.**

**Hard checks.** Blocked homes stay in the list, sorted below the ones that work, with a red line:
- Over a member's budget → "Over Sam's budget by $X".
- A required feature that is `false` → blocker. If it is unknown → warning. **Unknown never satisfies a requirement.**
- Too few bedrooms for someone who needs a private room → blocker.

**Subscores (0–100)**

| Dimension | Rule |
|---|---|
| Affordability | 100 at ≤ 80% of budget, linear to 50 at 100%, 0 over budget |
| Commute | 100 at ≤ 10 min, linear to 0 at ≥ 40 min. Weighted by visits/week × importance, using each place's own travel mode |
| Amenities | Share of wanted amenities the source confirms. Unknown counts as not met and is listed |
| Lifestyle | Quiet ↔ quiet building, social ↔ social spaces, heavy cooks ↔ large kitchen |
| Space | Private bedroom, baths per person (≥ 0.75 is full marks), sq ft per person |

- **Subjective features need evidence.** A quiet building, large kitchen or social spaces count only if the listing's source says so. The app shows that wording as a quote. Otherwise the feature is unknown: never scored as met, and never used in lifestyle rules.
- A subscore without data is `null`. Its weight is shared across the others.

**Travel times** (no paid APIs, no runtime calls):
- **Walk, bike and drive** to the 7 campus areas: routed ahead of time with OSRM and committed (`commute-matrix.json`).
- **Bus, and every mode to custom places, buildings and classes:** estimated from distance (`estimate.ts`), always labelled "est.":

  ```
  road_km = straight-line km × 1.35
  walk    = road_km at 4.8 km/h
  bike    = road_km at 14 km/h + 1 min
  drive   = road_km at 30 km/h + 4 min parking
  bus     = 5 min to/from stops + 5 min wait + road_km at 18 km/h
  ```

  - When walking beats the bus, the app says "Walking is faster".
  - A test checks the estimator against the routed OSRM times. For each area, the median error must be within ±35%, and at least 90% of trips must fall inside that range.
- **Average commute** = Σ(minutes × visits) ÷ Σ(visits), one way.

**Weights.** The defaults are 30 / 25 / 20 / 15 / 10 (affordability / commute / amenities / lifestyle / space).
- Each this-or-that answer moves 5 points between the two dimensions it contrasts.
- On the profile page, **Customize your priorities** sets the five weights directly. Very important / Important / Somewhat / Flexible map to 4 / 3 / 2 / 1, then the weights are normalized.

**Member score** = Σ (effective weight × subscore)

**Group score** = **0.75 × mean(member scores) + 0.25 × min(member scores)**. The 25% on the least-satisfied member keeps one person from being outvoted by the average.

**Sort order.** Eligible → eligible with unknowns → blocked. Within a tier, by group score, then by listing id, so the same input always gives the same output.

**Roommate similarity** (`compat.ts`):
- A weighted mix of budget overlap, places, lifestyle, priorities, travel, must-haves, amenities, and major and clubs.
- The two biggest contributors become the reasons, e.g. "Both in MRacing".
- Labels: Great match (≥ 80), Good match (≥ 65), Some overlap (≥ 50).
- The score is symmetric and deterministic. Nobody is hard-coded as the top match.

**Schedule trips.** A class counts as a trip from home if it's the first class of the day, or comes after a gap of **2 hours or more**. Back-to-back classes don't add trips.

**Explanations, "Why" and "What changed?"** are templates filled from the score data (`explain.ts`, `diff.ts`). No LLM writes them.

**Votes.** Interested / Maybe / Pass, separately for each lobby. Any vote saves the home; removing it from Saved clears your vote (with Undo). Explore has no filters: the group's profiles decide what fits. The listing shows "N of M interested" and "Waiting for roommates' votes". New lobbies start with no votes; no votes are simulated. Votes show interest only, never availability.

---

## AI: what Gemini does (and doesn't)

Gemini runs server-side only (`@google/genai`), for two things:

1. **Profile parse** (`POST /api/profile/parse`):
   - The output must match a JSON schema generated from Zod. It is validated and retried once, with an 8 s deadline and a fallback list of models.
   - **Guardrails** (`src/lib/ai/sanitize.ts`): a budget is kept only if that number appears in the text. Places that aren't known become follow-up questions. Every field carries its source quote.
   - The exact demo sentence is answered from `src/data/demo-parse-cache.json`.
2. **Schedule screenshot** (`POST /api/schedule/parse`):
   - Accepts JPEG, PNG or WebP up to 8 MB, and reads at most 30 classes.
   - Several models are raced, with a 15 s deadline.
   - Every row goes to a review table. The student confirms each class, and either confirms the building match or picks the building themselves.

**Nothing the AI suggests is used until the student confirms it.** The AI may suggest a building or area for a place, but **it never sets a location**: the student picks one or drops a pin, or the place isn't saved.

---

## Data sources (observed 2026-11-20)

| Data | Count | Source |
|---|---|---|
| Haven on Geddes (Hackberry Lane) | 3 | [havenongeddes.com](https://www.havenongeddes.com/ann-arbor/haven-on-geddes/student/). The 3BR per-bed prices are provider-reported. **The 4BR isn't on the live page**; its $4,396/mo comes from the team research sheet and is marked unverified. |
| U-M Off-Campus Housing listings | 19 | [offcampushousing.umich.edu](https://offcampushousing.umich.edu/listing). Reported by third parties, with a link for each listing. 15 four-bedroom homes plus studio, 1, 2, 3 and 5 BR. |
| Team research sheet | 22 | Our own price and amenity sheet (2026-11-20), checked against the listings above. Where they differ, the sheet wins unless the live listing proves it wrong: State Street Village and Landmark keep their listed prices. Sheet-only prices (Haven 4BR, 723 Packard, The Yard, 215/217 N Ashley) are marked unverified. Sheet amenities only fill in unknowns. |
| Campus areas | 7 | Coordinates from OpenStreetMap Nominatim |
| U-M buildings | 29 | Each building is checked once against OpenStreetMap. Buildings that couldn't be verified were left out. |
| Commute matrix | 22 × 7 × 3 modes | OSRM table service at routing.openstreetmap.de (walk / bike / drive), built by `scripts/build-commute-matrix.ts` |
| Resources | 7 | U-M Dean of Students and Logistics, Transportation & Parking pages, summarized in our own words with links |
| Roommates | 9 personas | Fictional (`src/data/personas.json`); see the note at the top |

**Photos.** Listing photos are never scraped or copied. Only photos the team took, or has written permission to use, go in `public/listings/<id>/`, with credits (all 22 homes, 145 photos; virtually staged rooms are captioned as such). They come in through a git-ignored `photo-inbox/` with a rights file and `npm run photos:import`. A home without photos shows "Photo coming soon". Map tiles © OpenStreetMap contributors.

---

## Privacy and fairness

- There are no demographic fields anywhere in the schema.
- Contact details (umich.edu email and/or phone) are shown to suggested roommates only when a student is actively looking and ticked the consent box. "Already found" saves no contact. Like everything else, they stay in this browser.
- Everything stays in this browser's `localStorage` (`htl:app-state:v1`, version 2, validated with Zod on load). That includes lobbies, invites, votes, places, priorities, the profile photo and the schedule. Nothing is sent to a server except the text or image you ask Gemini to parse.
- Profile photos are resized to 256 px before they're saved. **Profile → Delete my profile** clears everything.
- Haven gets no ranking boost.
- Resources are informational, not legal advice.

---

## Known limitations

- The listings are a **curated snapshot from 2026-11-20**, not live inventory or availability.
- **Bus times are estimates** from distance, not schedules. Check the Magic Bus app.
- **Single live user.** There is no auth or multi-user backend. Roommates are simulated in your browser, and their invites resolve after a short delay.
- Occupancy legality isn't verified. Scores are heuristic fit indicators, not probabilities.
- Only Michigan is live. Alabama, Miami and Virginia Tech are "coming soon".
- Not affiliated with the University of Michigan or Hackberry Lane.

---

## Project layout

```
src/
  app/                 /, /campus, /onboarding, /dashboard, /explore, /listing/[id],
                       /lobbies/[id], /roommates, /watchlist (Saved), /profile, /resources,
                       /demo (hidden), /api/profile/parse, /api/schedule/parse
  components/          UI by feature (dashboard, explore, listing, lobby, roommates, places, profile, …)
  hooks/use-group.ts   live profile + joined lobby members → ranking (with what-if budgets)
  lib/
    types.ts           data contract
    schemas.ts         Zod mirrors (seed validation, AI output, localStorage v2)
    engine/            rent, hard checks, subscores, estimator, schedule trips, similarity,
                       group score, explain, diff, consensus
    ai/                Gemini clients, prompts, sanitizer, demo cache
    onboarding/        parse → profile, follow-ups, this-or-that
    schedule-import.ts screenshot rows → review → class places
    store.ts           localStorage store (useSyncExternalStore, v1 → v2 migration)
  data/                seed JSON (listings, campus areas, buildings, personas, commute matrix, photo manifest)
scripts/               build-commute-matrix.ts, photo-manifest.ts
docs/                  listing photo checklist, judging rubric
```

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui (Base UI), Leaflet + OpenStreetMap, Zod 4, Motion, Vitest, `@google/genai`.

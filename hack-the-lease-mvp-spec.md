# Hack the Lease — MVP Build Spec (8-hour cut)

**Product:** "Find your people. Find your place." A housing decision tool for a group of 4 U-M students. It understands each member's daily life, scores Ann Arbor listings deterministically, explains trade-offs per roommate, shows what changes when budgets move, and lets the group vote.

**Written:** 2026-11-20, ~04:00 ET. **Build window:** about 8 hours, done by Claude Code subagents split by layer (§12).
**Source docs:** `Project_Case_Study.txt` (judging rubric) and `MVP_Info.txt` v2.0 (the full vision). This spec overrides MVP_Info wherever they conflict. It is a deliberate scope cut.

---

## 0. Decisions made in the interview

| Topic | Decision |
|---|---|
| Users | One live user (the presenter). Three roommates are pre-seeded. No real auth and no multi-user backend. |
| Persistence | Seed JSON in the repo plus `localStorage` for the live user's profile, edits, votes and scenarios. No database. |
| Campuses | All 4 university cards appear and look live. **Only Michigan works.** Alabama, Miami and VT go to a "Coming soon" page. |
| LLM | Gemini free tier, **used only for parsing the free-text profile**. |
| AI failure | The exact demo sentence returns a cached parse instantly. Any other text calls Gemini live. If Gemini fails, the user lands on the manual edit form with an error toast. |
| Explanations / "What changed?" | **Deterministic templates** built from structured score results. No LLM. |
| Commute | **Precomputed travel-time matrix** from public OSRM (walk / bike / drive), committed as JSON. |
| Demo identity | The typed profile **becomes Student A** and joins seeded B, C and D. |
| Haven on Geddes price | Whole unit **$4,396+/mo ÷ 4 ≈ $1,099/person**. Per-bed range $1,095–$1,335 is shown alongside. Source: `https://www.havenongeddes.com/ann-arbor/haven-on-geddes/student/`, label *Provider-reported, observed 2026-11-20*, rent basis `per_unit`. |
| Over-budget rule | The listing **stays in the ranking with a red blocker flag** ("Exceeds Sam's budget by $X"). It is not removed. |
| Group score | `0.75 × mean(individual) + 0.25 × min(individual)`. Both parts are shown. |
| What-if (must work on stage) | **Per-member budget slider**, plus "apply to all." |
| Voting | B, C and D votes are pre-seeded. The live user adds a vote and consensus recomputes. |
| Listings | **20 total.** Use real Hackberry Lane / Haven Ann Arbor properties (currently only Haven on Geddes is known), plus real listings curated from `offcampushousing.umich.edu`, plus synthetic listings only where gaps remain. Wide variety of housing types. |
| Deploy | Vercel (Gemini key in an env var) **plus** a local `npm run build && npm start` backup on the demo laptop. |
| Persona budgets | The agent picks them so a budget change visibly flips the #1 result (§7.6). |

### Cuts (not built)
Roommate discovery and invites, real auth, RLS, Supabase, realtime, invite tokens, schedule file import, live routing, LLM explanations, neighborhood boundary layers, and non-Michigan matching. Everything in MVP_Info's P2.

### Kept, kept small
Landing hero + "How it works" + campus cards · free-text onboarding + editable review · 5-question this-or-that · seeded lobby · explorer list + map · property detail · what-if · watchlist + voting · Michigan Housing Resources page · real / third-party / synthetic labels everywhere.

---

## 1. Problem statement (for the pitch and the rubric)

Listing sites filter by rent and bedroom count. They do not tell a *group* whether a place works for **each person's actual week**: one person is on North Campus 4 days a week without a car, another cooks for their club, another has a hard $700 cap, and another needs a private room to study. The tool turns each person's description into structured, confirmed preferences. It scores every listing per person and for the group, names who is compromising and by how much, and recomputes live when an input changes.

The rubric's "decision sensitivity" requirement is met by the budget slider in Scene 6.

---

## 2. Tech stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + lucide-react.
- **Leaflet + react-leaflet** with OpenStreetMap tiles. It needs no API key, so it is the lowest-risk choice. Load it with `dynamic(() => import(...), { ssr: false })`.
- Zod for every external boundary: Gemini output, seed-file validation at build or test time, and localStorage hydration.
- `@google/genai` (or REST), called **only** from the server route `/api/profile/parse`. The key lives in `GEMINI_API_KEY` and never reaches the client.
- Vitest for unit tests on the engine and rent logic.
- Framer Motion only for small transitions such as rank reordering on what-if (optional).

The visual direction is in MVP_Info §9.2: navy/charcoal, off-white, emerald/teal accents, amber for trade-offs. Large cards with rounded corners. It should not look like an admin dashboard.

---

## 3. Routes

| Route | Purpose |
|---|---|
| `/` | Landing: hero ("Find your people. Find your place."), CTAs **Find My Fit** → `/campus` and **Explore Haven Communities** → `/explore?mode=haven`, a 4-step "How it works", and the campus card strip. |
| `/campus` | "Where are you looking for your next home?" Four cards. Michigan → `/onboarding`. The others → `/campus/coming-soon?u=<slug>`. All four get identical hover and selected styles, so none looks dead before it is clicked. |
| `/campus/coming-soon` | Friendly page: "<University> is coming soon." Button back to Michigan. |
| `/onboarding` | Free-text input → parse → **Review** ("Here's what we learned about you") → 5 this-or-that questions → `/lobby`. |
| `/lobby` | Seeded group "The Packard Four" (name editable). Four avatar cards with readiness, budgets, key destinations, shared priorities, differences, and non-negotiables. CTA **Find Homes Together** → `/explore`. |
| `/explore` | Desktop: ranked cards on the left, map on the right. Mobile: list/map toggle. Mode tabs: **All Housing** (default) and **Haven**. Filters: source type, bedrooms, price/person, amenities. **What-if panel** is a drawer or right rail. |
| `/listing/[id]` | Property detail: gallery, facts, provenance, "How this home fits your group", per-member analysis, group actions (Interested / Maybe / Pass / Save / View Official Property). |
| `/watchlist` | Saved listings with group score, 4 member votes, consensus badge, last activity, and open questions. |
| `/resources` | "Your Campus Housing Guide" (Michigan): cards linking to Beyond the Diag pages and the U-M off-campus search. Disclaimer text is in MVP_Info §6.5. |
| `/profile` | The live user's editable profile (same component as the onboarding review). |

The header shows the selected campus ("University of Michigan ▾"). The switcher lists all 4, and non-Michigan entries open the coming-soon page. Nav: Dashboard (=lobby) · Explore · Watchlist · Resources · Profile.

---

## 4. Data model (`src/lib/types.ts` — **Agent 1 writes this first; everyone else imports it**)

```ts
type Id = string;
type VerificationStatus = 'verified' | 'provider_reported' | 'third_party_reported' | 'unverified' | 'stale' | 'synthetic';
type SourceType = 'haven' | 'umich_offcampus' | 'synthetic';
type RentBasis = 'per_unit' | 'per_bedroom' | 'per_person' | 'unknown';
type TravelMode = 'walk' | 'bike' | 'drive' | 'bus';

interface University { id; slug; name; shortName; city; state; lat; lng; status: 'active' | 'coming_soon';
  offcampusResourceUrl; description; havenCommunityNames: string[] }

interface CampusDestination { id; campusId; name; category: 'campus_area' | 'building' | 'neighborhood' | 'transit';
  lat; lng; source: string; verifiedAt: string }

interface Provenance { sourceUrl: string; sourceName: string; observedAt: string; status: VerificationStatus; note?: string }

interface Community { id; campusId; name; aliases: string[]; brand: 'Haven' | 'Other' | 'Synthetic';
  address; lat; lng; description; amenities: Claim<string>[]; officialUrl?; images: string[]; provenance: Provenance }

interface Claim<T> { value: T; provenance: Provenance; scope: 'community' | 'floorplan' | 'unit' }

interface Listing {               // a floor plan or rentable offering; this is what gets ranked
  id; communityId; name;          // e.g. "Haven on Geddes — 4BR Townhome"
  housingType: 'high_rise' | 'garden_apartment' | 'townhome' | 'house' | 'duplex' | 'studio' | 'co_op' | 'ranch';
  bedrooms: number; bathrooms: number; sqft?: number;
  maxOccupancy?: number;          // undefined = unknown; must NOT be inferred from bedrooms
  privateBedrooms: boolean | null;
  rent: { amount: number | null; amountMax?: number; basis: RentBasis; fees: { label; monthly: number }[];
          utilitiesIncluded: boolean | null; provenance: Provenance };
  availability: { status: 'available' | 'unknown' | 'unavailable'; date?: string; provenance: Provenance };
  features: { inUnitLaundry: boolean | null; dishwasher: boolean | null; parking: boolean | null;
              furnished: boolean | null; largeKitchen: boolean | null; socialAmenities: boolean | null;
              quietBuilding: boolean | null; petFriendly: boolean | null; ac: boolean | null };
  sourceType: SourceType; provenance: Provenance; images: string[] }

interface Destination { destinationId: Id; visitsPerWeek: number; importance: 1 | 2 | 3 }
interface MemberProfile { id; displayName; isLiveUser: boolean; program?; bio;
  budgetMax: number; budgetIsHardCap: boolean;           // over budget = blocker flag either way
  travelMode: TravelMode; hasCar: boolean;
  destinations: Destination[];
  lifestyle: { noise: 'quiet' | 'social' | 'either'; cooking: 'high' | 'medium' | 'low'; guests: 'rare' | 'sometimes' | 'often' };
  requirements: { privateBedroom: boolean; parking: boolean; inUnitLaundry: boolean };
  desiredAmenities: (keyof Listing['features'])[];
  weights: { affordability; commute; amenities; lifestyle; space };   // sum = 1
  fieldMeta: Record<string, { sourceText?: string; sourceType: 'ai' | 'user' | 'seed'; confidence?: number; confirmed: boolean }> }

interface Group { id; name; campusId: 'umich'; targetSize: 4; memberIds: Id[] }
type VoteValue = 'interested' | 'maybe' | 'pass';
interface Vote { memberId; listingId; value: VoteValue; at: string }
interface WatchItem { listingId; savedBy: Id; at: string; openQuestions: string[] }
```

Seed files live in `src/data/`: `universities.json`, `destinations.umich.json`, `communities.json`, `listings.json`, `commute-matrix.json`, `personas.json`, `votes.seed.json`, `resources.umich.json`, `demo-parse-cache.json`. A Vitest test validates every seed file against Zod schemas that mirror the types.

---

## 5. Data sourcing (Agent 1)

### 5.1 Universities
Four records. Michigan is `active`. The others are `coming_soon` and show their Haven communities as names only (Alabama: Haven on Hackberry · Miami: Haven at 9West · VT: Haven at the Farm, Haven on North Main). Each card's community count comes from `havenCommunityNames.length`, not a hardcoded number.

### 5.2 Haven on Geddes (real)
- Address: 1700 Geddes Ave, Ann Arbor, MI 48104. Geocode it and record the coordinate source.
- Sourced amenities (MVP_Info §5.1), stored as `Claim`s with the correct scope: 62 homes, groups of about 3–6, ranch and townhome layouts, full kitchens, stainless appliances, dishwashers, in-unit laundry on **some layouts only** (floor-plan scope), balconies/patios, included utilities, fitness center, media/game room, study lounge, key-fob access, next to Nichols Arboretum. "1.1 mi to Central Campus" is stored as a **provider claim** and is not used for scoring. Scoring uses the OSRM matrix.
- Listings: at least the 4BR whole-unit offering at $4,396 `per_unit` (provider-reported 2026-11-20). If the site separates ranch and townhome layouts, create one listing per layout. The per-bed range $1,095–$1,335 goes on the card as secondary info with basis `per_bedroom`.
- `maxOccupancy` stays unknown unless the site states it. The UI says "Confirm occupancy with property."
- Availability `unknown` unless the site states it.

### 5.3 Other Hackberry Lane properties in Ann Arbor
The agent must check `hackberrylane.com/locations` and `hackberrylane.com/haven` in a browser. Research on 2026-11-20 found **no Ann Arbor property other than Haven on Geddes** (the portfolio is UF, Alabama, Miami, VT). Include any Ann Arbor property found, and none that isn't.

### 5.4 Curated listings from offcampushousing.umich.edu
- The agent browses `https://offcampushousing.umich.edu/` (the U-M official off-campus search) and **hand-curates** listings into JSON. This is manual curation, not a scraper script. **Stop at ~14 listings** to leave room for synthetic gap-fillers.
- For each listing record: name, address, coordinates, bedrooms, bathrooms, rent **with its basis exactly as the site presents it** (per bed vs total), required fees, utilities, the amenities the listing actually states, available date, listing URL, and `observedAt = 2026-11-20`. Status `third_party_reported`. Housing type comes from the listing.
- Target variety (ranking needs contrast): a downtown/South U high-rise with per-bed leases · a Kerrytown or Old West Side house · a North Campus garden apartment · a duplex · a studio/1BR (fails group capacity for 4 and shows the capacity check) · a 3BR (fails the 4-bed check) · a place with parking and a place without · a place with a large kitchen or social amenities.
- Any missing field stays `null`. **Never fill in rent, occupancy or amenities by guessing.** The agent may look up a fact on the property's own website and record that URL as the claim's source.
- **Do not hotlink or copy listing photos** unless the source permits it. Use neutral placeholder imagery labeled "Representative image."

### 5.5 Synthetic gap-fillers (~4–6, to reach 20)
These are added only where real listings leave a needed contrast uncovered. They must exist so the demo flip in §7.6 happens. Names are obviously fictional (e.g. "Northside Commons (Demo)"). `sourceType: 'synthetic'`, `status: 'synthetic'`. They get a striped "DEMO LISTING — fictional" badge on every card, map pin and detail page. Real-looking addresses must not belong to actual buildings: use a block-level coordinate and the address label "Near Plymouth Rd (fictional)."

### 5.6 Destinations (Michigan)
Central Campus (Diag), North Campus (Pierpont Commons area), South Campus (athletic campus), Medical Campus, Kerrytown, the Ross School area, and the Duderstadt Center (North Campus late-night study). Coordinates come from OpenStreetMap, with source and date recorded. Onboarding can only map text to these destinations. Anything else becomes an "unmapped place" that the user must pin or drop.

### 5.7 Commute matrix (`scripts/build-commute-matrix.ts`)
- For every (listing × destination) pair, call the OSRM `table` service for **foot, bike and car** at `https://routing.openstreetmap.de/routed-{foot|bike|car}/table/v1/driving/...`, or `router.project-osrm.org` for car. Store minutes and meters along with `{ provider: 'OSRM / OpenStreetMap', computedAt }`.
- Commit the output JSON. The app never calls OSRM at runtime.
- If OSRM fails for any pair, use a fallback: haversine × 1.3 at walk 5 km/h, bike 15, drive 30, flagged `estimated: true`. The UI labels it "est. (straight-line)."
- **Bus is not routed.** For a member whose mode is `bus`, scoring uses walk time capped at a "bus-reachable" bonus: if the destination is more than 20 minutes on foot, the card notes "Bus likely; check U-M Magic Bus." Link to U-M Logistics, Transportation & Parking. Never print a bus duration.

### 5.8 Resources (Michigan)
Cards with a one-line summary written in our own words and a link: Finding Housing & Roommates, Ann Arbor Neighborhoods guide, Living on Your Own (leases, joint and several liability, deposits, subleasing), Staying Safe, U-M off-campus housing search, and U-M transit. URLs are listed in MVP_Info §6.1. Footer disclaimer text is in MVP_Info §6.5. No university logos.

---

## 6. Personas (seeded)

Neutral fictional names. No demographic attributes. Each profile is fully structured and `confirmed: true`.

| | Name | Story | Mode | Key destinations (visits/wk) | Lifestyle | Requirements |
|---|---|---|---|---|---|---|
| A (live) | *(typed in demo; default "Maya")* | Engineering, North Campus most weekdays, evening club meetings, no car, likes cooking with friends, budget under $850 | bus/walk | North Campus 4, Central 2 | quiet-ish, cooking high | none |
| B | Jordan | Club officer; hosts dinners | walk | Central 5, Kerrytown 1 | social, cooking high, guests often | — |
| C | Sam | Budget first, will commute | bike | Central 3, Medical 2 | either | **budget hard cap** |
| D | Riley | Grad-school prep, studies late | walk | Central 4, Duderstadt 2 | quiet, guests rare | **private bedroom** |

Agent 1 sets B, C and D budgets **after** the listings are final, so §7.6 holds. Starting point: B $1,000, C $700, D $1,150.

Pre-seeded votes cover 3–4 listings and show mixed states (one "Strong Interest," one "Mixed Opinions," one "Awaiting Reviews").

---

## 7. Matching engine (`src/lib/engine/` — Agent 2; pure functions, no React)

### 7.1 Inputs and outputs
`rankListings(listings, members, matrix, destinations, options) → RankedResult[]`. Each `RankedResult` holds `{ listingId, groupScore | null, mean, min, coverage: {evaluated, total}, perMember: MemberResult[], blockers: Blocker[], eligibility: 'eligible' | 'eligible_with_unknowns' | 'blocked' }`.

`MemberResult` holds `{ memberId, score, subscores: Record<Dim, {score: number | null, reason: string, evidence: string[]}>, perPersonRent | null }`.

### 7.2 Rent per person (tested exhaustively)
- `per_unit`: `(amount + Σ unit-level fees) / groupSize`. The split is equal.
- `per_bedroom` / `per_person`: `amount + per-person fees`. **Never divide by group size.**
- `unknown` or `amount === null`: per-person rent is `null`, affordability is `null` (unverified), and the badge reads "Contact for pricing." **Unknown rent is never 0.**
- If utilities are not included and there are no fee data, say so in the explanation: "excludes utilities."

### 7.3 Hard checks → blockers (the listing is still ranked; it sorts below unblocked listings with the same score)
- **Capacity:** `bedrooms < groupSize` and no private-bedroom requirement → "Shared bedrooms needed." If any member requires a private bedroom and `bedrooms < groupSize` → blocker. `maxOccupancy` unknown → "Occupancy unverified" (a warning, not a blocker).
- **Budget:** `perPersonRent > member.budgetMax` → blocker "Exceeds {name}'s budget by ${diff}/mo." For an unknown price → warning "Affordability unverified."
- **Required features:** a member's required `parking` or `inUnitLaundry` that is `false` → blocker. If `null` → warning "Unverified: {feature}." **Unknown never satisfies a requirement.**

Sort order: eligible (by group score) → eligible_with_unknowns (by group score, with a coverage badge) → blocked (by group score, dimmed, with blocker chips).

### 7.4 Subscores (0–100, deterministic)
- **Affordability:** at or below 80% of budget → 100. Linear down to 50 at 100% of budget. Over budget → 0 (and a blocker).
- **Commute:** for each destination, minutes for the member's mode (bus → walk-based rule in §5.7). The score is 100 at ≤10 min, linear to 0 at ≥40 min. Average weighted by `visitsPerWeek × importance`. This is the differentiator: A is scored on North Campus, not on Central Campus.
- **Amenities:** the share of `desiredAmenities` that are `true`. A `null` counts as not met, and the item is listed as unverified.
- **Lifestyle:** quiet members gain from `quietBuilding` and lose from a high-rise with `socialAmenities`. Social members gain from `socialAmenities`. High-cooking members gain from `largeKitchen`. Each rule contributes a reason string.
- **Space:** private bedroom available for this member, bathrooms per person (≥0.75 → full marks), and sqft per person when known.
- A subscore that cannot be computed is `null`. Its weight is redistributed proportionally across the computed subscores, and `coverage` records "4 of 5 evaluated."

### 7.5 Weights
Defaults: affordability .30, commute .25, amenities .20, lifestyle .15, space .10. The this-or-that answers shift them: each answer moves ±0.05 between the two dimensions it contrasts, then the weights are renormalized. "Either" or "skip" makes no change.

### 7.6 Group score and the demo flip
`groupScore = 0.75 × mean + 0.25 × min` over members with non-null scores. Show "Average fit 82 · Least-satisfied member 64."

**Required, asserted by a test:** with seeded budgets, the #1 listing is X. Raising **Sam's** budget slider by about $100–250 makes a blocked listing Y eligible, and Y becomes #1. Y should be the strong North Campus / kitchen option, so the explanation tells the story: "Y became affordable for Sam, and it is much closer to Maya's North Campus classes." Agent 1 tunes budgets and/or synthetic rents until `engine.test.ts › demo flip` passes.

### 7.7 Explanation templates (`explain.ts`)
- Listing summary: the top 2 strengths and the top compromise, chosen by the largest positive and negative contributions (weight × (subscore − 50)). They name the member most affected, e.g. "Main drawback: a 31-minute walk to North Campus for Maya."
- Per-member lines are built from subscore `reason` strings and evidence (e.g. "Kitchen listed as 'full kitchen' — provider-reported").
- **What changed** (`diffRankings(before, after)`): lists changed inputs; listings that became eligible or blocked; rank moves of ±2 or more; the new #1; and the single biggest subscore delta driving the change. Every sentence is built from diff data. **No hardcoded narratives.**

---

## 8. Onboarding and AI (Agent 4)

### 8.1 Flow
1. A large textarea titled "Tell us what your life looks like," with 4 example chips (MVP_Info §11). An optional budget field.
2. Submit → `POST /api/profile/parse { text, campusId }`.
3. The route normalizes the text (trim, collapse whitespace, lowercase) and hashes it. A match in `demo-parse-cache.json` returns immediately; the response includes `cached: true` for debugging, not shown in the UI. Otherwise it calls Gemini (`gemini-2.5-flash` or the current free-tier flash model) with a JSON response schema, validates with Zod, and allows 1 retry on a validation failure. On error or a timeout over 8s → `{ ok: false }` → the UI shows the manual review form pre-filled with defaults and a toast "Couldn't auto-read that — fill in the basics."
4. **Review screen:** sections for Schedule & Destinations, Budget, Getting Around, Lifestyle, Must-haves and Nice-to-haves. Each extracted field shows a "from: '…don't have a car…'" quote chip, plus Confirm, Edit and Remove controls. Only confirmed fields reach the engine. The engine treats unconfirmed fields as absent.
5. **Follow-up:** if a required field is missing (budget, travel mode, or at least one destination), ask just that question inline.
6. **This-or-that:** 5 questions, one at a time, with Either and Skip. The default set is in MVP_Info §13: closer vs space, rent vs amenities, private vs cheaper, quiet vs social, cooking vs convenience. A question is skipped if the answer is already known from text (e.g. no "private room?" if the user said they need one). Questions are chosen by rules, not an LLM.
7. Save the profile as Student A in localStorage → go to `/lobby`.

### 8.2 Gemini prompt contract
The system prompt includes the Michigan destination registry (ids and names only) and says: extract only what the text states; map places only to the given destination ids; put anything else in `unmappedPlaces`; never invent budget numbers; and return `confidence` 0–1 and a `sourceText` quote for every field. The output schema has `destinations[{destinationId, visitsPerWeek?, sourceText, confidence}]`, `budgetMax?`, `travelMode?`, `hasCar?`, `lifestyle{}`, `requirements{}`, `desiredAmenities[]`, `unmappedPlaces[]`, and `missing[]`.

### 8.3 Demo cache entry
Text: *"I'm an engineering student at Michigan. I'm on North Campus most weekdays, have evening club meetings, don't have a car, enjoy cooking with friends, and want housing under $850 a month."* Expected parse: North Campus 4/wk; Central (evening clubs) **unmapped → asks "Where do your club meetings happen?"** with suggested Central Campus; hasCar false; travelMode bus/walk (asks which); cooking high; budget 850. The presenter answers the follow-up on stage, which shows the honest-extraction behavior.

---

## 9. UI details that matter for scoring

- **Source badges** on every card and detail page: `Haven · Provider-reported Nov 20` (teal), `U-M Off-Campus listing · Third-party Nov 20` (blue), `DEMO — fictional` (striped amber). There is a source filter in Explore.
- The **Haven tab** shows only Haven on Geddes for Michigan, as a portfolio card with sourced amenities, the official link, and "How it fits your group." There is no merchandising boost in the ranking. If Haven gets visual prominence, it carries a "Featured community" label that is separate from the score.
- **Coverage badge** whenever a subscore is null: "Scored on 4 of 5 categories."
- The **"Contact for pricing"** state is real and reachable (any curated listing without a price).
- Map: pins are colored by source type, the selected pin syncs with the card, destination markers use a different icon, and pins for blocked listings are dimmed. When the routing fallback was used, the popup says "Distances: OSRM walking/biking routes" or "est."
- **What-if drawer:** four member budget sliders ($500–$1,600, step $25), "apply to all," Reset, and a "Compare" toggle. When an input changes, the ranked list animates. A **"What changed?"** card shows the before → after rank table and template sentences. The scenario is saved to localStorage.
- **Detail page:** a group score ring, a mean/min breakdown, and 4 member rows with score, the 5 subscore bars (grey "unverified" segments), and reason lines. There is an "Unverified information" box (occupancy, availability, utilities). The Interested / Maybe / Pass buttons write the live user's vote.
- **Consensus rules** (with 4 members): fewer than 2 votes → *Awaiting Reviews* · 4 × interested → *Everyone Interested* · at least 3 interested and 0 pass → *Strong Interest* · at least 2 pass, or at least 1 interested plus at least 2 pass → *Significant Disagreement* · both interested and pass present → *Mixed Opinions* · otherwise *Under Consideration*. Votes never imply availability.
- Mobile: single-column cards, list/map toggle, and a bottom-sheet detail. Check at 390px.
- No dead buttons. Anything not built is either absent or routes to a "coming soon" page.

---

## 10. Privacy and fairness (show in Q&A)
No demographic fields exist anywhere in the schema. Club names are not stored as identity (only the destination). Seeded roommates show a limited preview: other members see budget *range* buckets on the lobby card, not exact schedules. Resources are framed as informational and not legal advice. There is a "Delete my profile" button in settings that clears localStorage.

---

## 11. Five-minute demo script (from MVP_Info §27, adjusted)
1. `/` → **Find My Fit** → campus grid. Point out that 4 markets come from one registry → click Michigan.
2. Paste the demo sentence → instant parse → review with quote chips → answer the club-location follow-up → 2 quick this-or-thats.
3. Lobby: 4 cards, budgets from $700 to $1,150, "Everyone wants a full kitchen," "Riley needs a private bedroom," "Sam's $700 cap is the binding constraint."
4. Haven tab → Haven on Geddes: sourced amenities, provider-reported $4,396/unit → $1,099/person, occupancy unverified, official link.
5. All Housing: 20 ranked listings with source badges. Open #1 → per-member scores and compromises.
6. What-if: drag Sam's budget up → Y unlocks and jumps to #1 → read the "What changed?" card. Reset.
7. Watchlist: B, C and D votes visible → cast Maya's vote → consensus changes to *Strong Interest*. Close with "Housing search should understand how students actually live — and help them decide together."

---

## 12. Build plan — Claude Code subagents split by layer

**T+0:00–0:30 · Lead agent:** scaffold Next.js, Tailwind, shadcn and Vitest. Write `src/lib/types.ts` and the Zod schemas, then **freeze them**. Changes after that go through the lead only. Create stub seed files with 3 listings so everyone can work in parallel.

| Agent | Owns | Deliverable by |
|---|---|---|
| **1 · Data** | `src/data/*`, `scripts/build-commute-matrix.ts`; §5 sourcing; §6 personas; budget tuning for §7.6 | 20 listings + matrix by T+3:00; tuning by T+5:00 |
| **2 · Engine** | `src/lib/engine/*` + tests (rent basis, unknown ≠ 0, blockers, coverage, group formula, determinism, demo flip, diff text) | Working on stubs by T+2:00; green on real data by T+5:00 |
| **3 · UI** | All routes and components, map, what-if drawer, watchlist, resources, store (`useStore` over localStorage, with Zod hydration) | Clickable journey on stubs by T+3:30 |
| **4 · AI** | `/api/profile/parse`, Gemini client, cache, review/follow-up/this-or-that logic | By T+3:00; the onboarding UI is shared with Agent 3, who does the layout while Agent 4 does the logic hook |

**T+5:00–6:30:** integrate, deploy to Vercel, and check that the env var works there. **T+6:30–7:30:** run the full demo script 3 times on desktop and once on mobile, then fix blockers only. **T+7:30:** freeze, tag the release, confirm the local build works offline (except Gemini; the cache covers the demo).

**Rule:** if behind schedule at T+4:00, cut in this order: this-or-that → resources page → Haven tab polish → mobile. **Never cut** the what-if, the per-member explanations, or the source labels. Those carry most of the rubric weight.

---

## 13. Acceptance checklist
- [ ] Engine tests pass: per-bed rent is never divided by group size; unknown rent → null and never 0; unknown feature never satisfies a requirement; the same input gives the same output; the demo flip holds.
- [ ] Every listing has a source badge and an observed date. Synthetic listings are visually unmistakable.
- [ ] Geddes shows $4,396/unit → ~$1,099/person with the provider-reported label and "occupancy unverified."
- [ ] The cached demo parse is instant. Live Gemini works on Vercel. A Gemini failure lands on the manual form.
- [ ] The budget slider changes eligibility and #1, and "What changed?" text matches the actual diff.
- [ ] The live vote persists across a reload and the consensus badge updates.
- [ ] Non-Michigan cards look live and route to coming-soon. No other dead buttons.
- [ ] README has setup, env vars, data sources with dates, the scoring formula, and known limitations (single user, no bus routing, curated snapshot not live inventory, synthetic fillers).

## 14. Known limitations (say these to the judges)
Listings are a curated snapshot from 2026-11-20, not live inventory. Bus trips are not routed. Group collaboration is simulated with seeded roommates. Occupancy legality is not verified. Scores are heuristic fit indicators, not probabilities. The platform is not affiliated with U-M or Hackberry Lane.

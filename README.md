# Hack the Lease

**Find your people. Find your place.**

A housing decision tool for a group of four University of Michigan students. Each person describes their week in plain English. The app turns that into a confirmed profile, scores 20 Ann Arbor listings for every member and for the group, names who is compromising and by how much, and re-ranks live when a budget changes. Then the group votes.

Built for Hack the Lease 2026 (Nov 20, 2026). Scope and rules come from [`hack-the-lease-mvp-spec.md`](hack-the-lease-mvp-spec.md).

---

## Run it

Requires Node 20+ (developed on Node 26).

```bash
npm install
cp .env.example .env.local   # then add GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Demo-laptop backup (no network needed except for live Gemini; the demo sentence is cached):

```bash
npm run build && npm start
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest: engine, AI guardrails, end-to-end demo path |
| `npm run check` | Typecheck + lint + tests (run before every commit) |
| `npm run build:commute` | Rebuild the OSRM commute matrix (network; not needed to run the app) |

### Environment variables

| Variable | Required | Where | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | For live parsing | Server only (`/api/profile/parse`) | Parses free-text profiles. Never sent to the client. Without it, the exact demo sentence still works from the cache, and any other text lands on the manual form. |
| `NEXT_PUBLIC_AGENTATION_ENDPOINT` | No | Dev only | Sends [agentation](https://agentation.com) toolbar annotations to the local MCP server in `.mcp.json` (`http://localhost:4747`). Not rendered in production. |

---

## Demo (5 minutes)

1. `/` → **Find My Fit** → pick Michigan (Alabama, Miami and Virginia Tech go to "coming soon").
2. Click the **North Campus engineer** example → **Read my week**. The parse is instant (cached). Confirm the quote chips, answer "club meetings → Central Campus" and "Bus", then two this-or-thats.
3. **Lobby:** four roommates. "Sam's $1,000 cap is the binding constraint", "Riley needs a private bedroom".
4. **Explore → Haven tab:** Haven on Geddes with sourced amenities and the official link.
5. **All Housing:** 20 ranked homes with source badges. Open #1, **Packard Street House (Demo)**, to see per-member scores and the formula.
6. **What if…:** drag Sam's budget up $100–250. **Northside Commons (Demo)** becomes eligible and jumps to #1. "What changed?" says it *became affordable for Sam, and it is much closer to North Campus for Maya*. Reset.
7. **Watchlist:** Jordan, Sam and Riley have voted. Cast Maya's vote and the consensus updates and survives a reload.

The flip is asserted by tests (`src/lib/engine/__tests__/demo-flip.test.ts`, `src/lib/__tests__/demo-path.test.ts`), including for the profile the presenter types, across every travel-mode and this-or-that answer.

---

## How scoring works

All scoring is deterministic and lives in `src/lib/engine/` (pure functions, no React, no LLM).

**Rent per person**
- `per_unit`: (rent + unit fees) ÷ group size.
- `per_bedroom` / `per_person`: rent + per-person fees. **Never divided by group size.**
- Unknown rent or basis → `null` ("Contact for pricing"). **Unknown rent is never $0.**

**Hard checks.** Blocked homes stay in the list, sorted below the ones that work and flagged in red.
- Over a member's budget → "Exceeds Sam's budget by $X/mo".
- A required feature that is `false` → blocker. If it's unknown → warning. **Unknown never satisfies a requirement.**
- Too few bedrooms for someone who needs a private room → blocker. Unknown occupancy → warning.

**Subscores (0–100)**

| Dimension | Rule |
|---|---|
| Affordability | 100 at ≤ 80% of budget, linear to 50 at 100%, 0 over budget |
| Commute | 100 at ≤ 10 min, linear to 0 at ≥ 40 min, weighted by visits/week × importance, using the member's own mode. Bus isn't routed: walk time is used, and minutes past 20 count at 50% ("Bus likely; check U-M Magic Bus") |
| Amenities | Share of wanted amenities present. Unknown counts as not met and is listed |
| Lifestyle | Quiet ↔ quiet building, social ↔ social spaces, heavy cooks ↔ large kitchen |
| Space | Private bedroom, baths per person (≥ 0.75 is full marks), sq ft per person |

A subscore without data is `null`. Its weight is shared across the others, and the card shows "Scored on 4 of 5 categories".

**Weights.** Defaults are 30 / 25 / 20 / 15 / 10 (affordability / commute / amenities / lifestyle / space). Each this-or-that answer moves 5 points between the two dimensions it contrasts, then the weights are renormalized.

**Member score** = Σ (effective weight × subscore)

**Group score** = **0.75 × mean(member scores) + 0.25 × min(member scores)**

The 25% on the least-satisfied member keeps one person from being outvoted by the average. Both parts are shown everywhere.

**Sort order.** Eligible → eligible with unknowns → blocked. Within a tier, sort by group score, then by listing id, so the same input always gives the same output.

**Explanations and "What changed?"** come from templates filled from the score data (`explain.ts`, `diff.ts`). No narrative is hard-coded and no LLM writes them.

**Consensus** (4 members):
- Fewer than 2 votes → Awaiting Reviews
- 4 interested → Everyone Interested
- ≥ 3 interested and 0 pass → Strong Interest
- ≥ 2 pass, or ≥ 1 interested and ≥ 2 pass → Significant Disagreement
- Both interested and pass present → Mixed Opinions
- Otherwise → Under Consideration

Votes show interest only, never availability.

### Tests

There are 159 tests in `src/**/__tests__`:
- Rent basis, blockers, coverage, the group formula, explanations, diff text, consensus and weights.
- The demo flip on real data, and the full onboarding → ranking → what-if path.
- Property tests over 300 seeded random groups. They check that scores stay in range, the formulas reproduce, sorting is consistent, results are deterministic, inputs are never mutated, budgets and rent move scores in the right direction, and explanations never print NaN/undefined.
- Edge cases: empty and solo groups, studios, corrupt rent data, zero-visit destinations and more.
- AI guardrails: an invented budget is dropped, unknown places are moved to follow-up questions, and the cache normalizes the demo sentence.

---

## AI: what Gemini does (and doesn't)

Gemini is used **only** to parse the free-text profile (`POST /api/profile/parse`, server-side, `@google/genai`).
- The output is a JSON schema generated from Zod, validated, and retried once. The deadline is 8 seconds, with a model fallback list.
- **Guardrails** (`src/lib/ai/sanitize.ts`):
  - A budget is kept only if the number appears in the text.
  - Places not in the destination registry become follow-up questions.
  - Every field carries its source quote and confidence.
- **Nothing the AI suggests is used until the user confirms it.** Unconfirmed fields fall back to neutral defaults.
- The exact demo sentence is answered from `src/data/demo-parse-cache.json` (keyed by a hash of the normalized text). If Gemini fails, the user lands on the manual edit form with an error toast.

---

## Data sources (all observed 2026-11-20)

| Data | Count | Source |
|---|---|---|
| Haven on Geddes (Hackberry Lane) | 3 | [havenongeddes.com](https://www.havenongeddes.com/ann-arbor/haven-on-geddes/student/). The 3BR per-bed prices are provider-reported. **The 4BR whole-unit $4,396/mo (≈ $1,099/person) comes from the project brief and is labelled *unverified* in the app.** On re-check, the live page showed only 3BR layouts. |
| U-M Off-Campus Housing listings | 13 | [offcampushousing.umich.edu](https://offcampushousing.umich.edu/listing). Third-party reported, with a link per listing. One has no published price and shows "Contact for pricing". |
| Synthetic demo listings | 4 | Fictional gap-fillers, striped **DEMO — fictional** everywhere (Packard Street House, Northside Commons, Kerrytown Row, Stadium Townhomes) |
| Campus destinations | 7 | Coordinates from OpenStreetMap Nominatim |
| Commute matrix | 20 × 7 × 3 modes | OSRM table service at routing.openstreetmap.de (walk / bike / drive), precomputed by `scripts/build-commute-matrix.ts` and committed. The app never calls a routing API at runtime. |
| Resources | 7 | U-M Dean of Students "Beyond the Diag" and Logistics, Transportation & Parking pages, summarized in our own words with links |
| Roommates and votes | 3 + seeds | Fictional personas (`src/data/personas.json`, `votes.seed.json`) |

Listing photos are not copied; cards use representative illustrations and link to the official page. Map tiles © OpenStreetMap contributors.

---

## Privacy and fairness

- There are no demographic fields anywhere in the schema. Clubs are stored only as a destination, not as identity.
- Everything the user enters stays in this browser's `localStorage` (`htl:app-state:v1`, validated with Zod on load). **Profile → Delete my profile** clears it.
- Roommates see budget *ranges* and places, not exact schedules.
- There is no ranking boost for Haven; any visual prominence is labelled separately from the score.
- Resources are informational, not legal advice.

---

## Known limitations

- Listings are a **curated snapshot from 2026-11-20**, not live inventory or availability.
- **Bus trips are not routed.** Bus riders are scored on walking time with a 50% discount past 20 minutes.
- **Single live user.** The three roommates and their votes are seeded; there is no auth or multi-user backend.
- **Four listings are synthetic** (clearly labelled), added to fill gaps in real inventory.
- Demo budgets were rebalanced to real Ann Arbor rents ($888+/person), so that most real listings aren't blocked outright.
- Occupancy legality is not verified. Scores are heuristic fit indicators, not probabilities.
- Only Michigan is live. Alabama, Miami and Virginia Tech are "coming soon".
- Not affiliated with the University of Michigan or Hackberry Lane.

---

## Project layout

```
src/
  app/                 routes: /, /campus, /onboarding, /lobby, /explore, /listing/[id],
                       /watchlist, /resources, /profile, /api/profile/parse
  components/          UI by feature (explore, listing, onboarding, lobby, watchlist, …)
  hooks/use-group.ts   live profile + seeded roommates → ranking (with what-if budgets)
  lib/
    types.ts           frozen data contract
    schemas.ts         Zod mirrors (seed validation, AI output, localStorage)
    engine/            rent, hard checks, subscores, group score, explain, diff, consensus
    ai/                Gemini client, prompt, sanitizer, demo cache
    onboarding/        parse → profile, follow-ups, this-or-that
    store.ts           localStorage store (useSyncExternalStore)
  data/                seed JSON (listings, destinations, personas, votes, commute matrix)
scripts/               build-commute-matrix.ts
docs/                  judging rubric
```

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui (Base UI), Leaflet + OpenStreetMap, Zod 4, Motion, Vitest, `@google/genai`.

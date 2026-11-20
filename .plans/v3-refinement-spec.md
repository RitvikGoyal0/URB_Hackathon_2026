# Hack the Lease: V3 Refinement Spec

**Source:** Ritvik's "Housing Match Application, V3.0 Refinement & Improvement Specification", refined through a `/interview` session with Shaurya on 2026-11-20.
**Applies to:** the existing app in this repo (Next.js 16, localStorage store, deterministic engine in `src/lib/engine/`), live at https://hack-the-lease-seven.vercel.app.
**Time budget:** 3–5 hours. Everything in §2 must ship. Work in the order given in §14.

This spec overrides the V3 doc where they conflict. The V3 doc assumed a database, auth and Supabase. This app has none of those, and §1 records what we do instead.

---

## 1. Decisions from the interview

| Topic | Decision |
|---|---|
| Storage | **localStorage only.** Lobbies, memberships, invites, votes, places, priorities, photos and the parsed schedule all live in the browser store, validated with Zod. No Supabase, no auth, no migrations. The store moves from `version: 1` to `version: 2` with a migration (§4.1). |
| Bug source | Reproduced on **production** (`/explore`): Explore → listing → "All homes" crashes with "This page couldn't load", about half the time. The same happens after "Find Homes Together". Root cause in §3.1. |
| Formulas | Plain language everywhere. The method (group score formula, weights, assumptions) sits in **one collapsed "How we score" disclosure** on the listing page, for judges. No math anywhere else. |
| Subjective features | **Count a feature only if the source states it.** For quiet building, large kitchen, social spaces and similar, the listing must carry the source's own wording (shown as a quote). Without it the feature is unknown: never scored as met and never used in lifestyle rules. |
| Bus / transit | **Real Google transit times** come from a server route, cached for at most 30 days, with "Powered by Google" attribution. The trip assumed is arriving by **9:00 AM on a weekday** (America/Detroit), unless a place has its own arrival time. **We never use walk time as a stand-in for bus time.** If transit is unavailable, show "Bus estimate unavailable", and that place counts as missing data. |
| Google key | **Shaurya creates it.** It is billing-enabled and restricted to Places API (New), Routes / Distance Matrix and Geocoding. It goes in `.env.local` and Vercel (Production) as `GOOGLE_MAPS_API_KEY`, server-only. |
| Property photos | **No scraping.** The team supplies photos for every listing (checklist in §11). Only use photos the team took or has permission to use. Until a photo arrives, the card shows an honest "Photo coming soon" placeholder. |
| Custom places | **Google for both:** Places autocomplete finds candidates and **the student confirms the right one**. Google then computes walk, bike, transit and drive times. Nothing is invented: no confirmation, no place. |
| Demo start state | **No lobby.** After onboarding, the dashboard shows "Create your housing group". |
| Demo cast | **Friends: Jordan and Sam** (so the Sam budget flip is always possible). **Recommended: whoever scores highest** on profile similarity ("let the score decide"). Riley is expected to rank first but isn't hard-coded. 4–6 candidate cards are shown. |
| Invites | **Pending, then join:** "Invited · pending" for about 3 seconds, then "Joined". |
| Roommate votes | New lobbies start empty. Unvoted members show **"Waiting for roommates' votes"**. No simulated votes. |
| Rent | **Per room:** whole-unit rent ÷ bedrooms. Per-bed rent is used as listed. A studio (0 BR) is the whole rent. |
| Bedroom filter | **In a lobby:** show only homes with bedrooms = the lobby's target size (exact match). **Solo (no active lobby):** show any size, priced per room, assuming the other rooms get filled. |
| Card commute | **"Your average"**, e.g. "14 min avg for you". Each roommate's average is on the detail page. |
| Priorities | Onboarding keeps **this-or-that**. The **profile page** gets "Customize your priorities", where the student edits the same five weights by hand. Not in What-if. |
| Schedule | Gemini reads a schedule screenshot. **Each class's building becomes a place.** A class counts as a trip from home only if it is the first class of the day, or follows a gap of **2 hours or more**. Classes after a shorter gap (back-to-back) don't count as trips. |
| Fictional listings | **Remove all 4** (Packard, Northside, Kerrytown Row, Stadium). Replace them with real listings from offcampushousing.umich.edu: more 4BR homes, budget options and other sizes. Going down to about 18 listings is acceptable. |
| Stage flip | It must be rebuilt from real homes. Allowed: **re-tune the fictional students' budgets and places** so that raising Sam's budget makes a real, previously blocked home #1. Listing data stays 100% real. |
| Avatars | Initials and colors only. **No demo tags anywhere in the app.** The presenter tells the audience on stage that the students are fictional. The README keeps the disclosure. |
| Demo reset | A **hidden `/demo` page** (not linked anywhere) with Reset and helper controls. |
| Navigation | **Dashboard-first:** Dashboard · Explore · Roommates · Saved · Profile, plus an active-lobby switcher. The landing page stays at `/` for first-time visitors. |
| Repo | **Push the current working version to Ritvik's `main` now** (merge his 2 commits with `--allow-unrelated-histories`, keep our README, no force push). Then build V3 directly on `main`, committing each working piece. |
| Scope | All four groups are must-ship: (1) fixes + lobbies + roommates, (2) simpler UI, (3) places + Google transit, (4) uploads + photo galleries. |

---

## 2. Must-ship scope

1. **Stability:** fix the map crash. Add error boundaries to Explore and the listing page. Make "Find Homes Together" and "All homes" reliable, including after a refresh, from a direct URL and after browser back.
2. **Lobbies:** create, switch, leave and use multiple lobbies, each with its own members, saved homes, votes and what-if.
3. **Roommates:** a "Students you might get along with" page with a real similarity score, 2 reasons per person, and invite → pending → joined.
4. **Simpler UI:** a new dashboard; photo-first cards; a simpler listing page with compact per-roommate cards; formulas collapsed; vote buttons fixed; vote summary like "2 of 4 interested"; copy cleanup.
5. **Places + transit:** add, edit and remove places (MRacing etc.) using Google search and confirmation; Google transit times; an average-commute number.
6. **Uploads + galleries:** profile photo; schedule screenshot → Gemini → review → places; house photo gallery for team-supplied images.

---

## 3. Audit: what exists and what changes

### 3.1 Bug #1: map crash on returning to Explore (production)
- **Repro:** on https://hack-the-lease-seven.vercel.app/explore, open any listing, then click "All homes". The page shows "This page couldn't load · Reload / Back" and the console shows:
  - `Uncaught Error: Map container is being reused by another instance`
  - `TypeError: Cannot read properties of undefined (reading 'appendChild')`
- **Likely cause:** `next.config.ts` has Cache Components enabled. In Next 16 this keeps recently visited routes mounted in a hidden `<Activity>` and re-runs their effects when you return. react-leaflet's `MapContainer` then initializes again on a container that still carries the old map's `_leaflet_id`, so Leaflet throws. Nothing catches the error, so the whole route fails. It's intermittent because it depends on whether the previous route was kept alive or remounted.
- **Fix:**
  1. Own the Leaflet map lifecycle. Either create it in a `useEffect` and call `map.remove()` in the cleanup (also delete the container's `_leaflet_id`), or give `MapContainer` a fresh `key` each time it mounts and remove the instance on cleanup. Clicking a map marker must still sync with the card list.
  2. Wrap the map in its own error boundary. A map failure should show "Map couldn't load, list still works", never take down the page.
  3. Add `error.tsx` for `/explore` and `/listing/[id]` with a friendly retry. Add `not-found` handling for unknown listing ids (already 404s).
  4. Regression check: run 10 round trips of Explore → listing → All homes, plus Lobby → Find Homes Together → listing → back, on the production build (`npm run build && npm start`) and on Vercel. There must be zero console errors.
- **"Back to All Homes":** it must not rely on browser history. The link goes to `/explore`, carrying the current filters and source tab in the URL (`?tab=haven&…`). The active lobby comes from the store, so a deep link or refresh always works. Scroll position is restored when possible.

### 3.2 Things that exist and stay
- **Engine** (`src/lib/engine/`): rent, hard checks, subscores, group score `0.75·mean + 0.25·min`, explanations, "What changed?" diff, consensus. There are 159 tests.
- **Profile parse** (`/api/profile/parse`): Gemini call with demo cache and guardrails.
- **Onboarding:** free text → review with quote chips → follow-ups → this-or-that.
- **Store** (`src/lib/store.ts`): `useSyncExternalStore` with Zod hydration and a `HydrationGate` to avoid the server-render flash.
- **What-if panel:** per-member budget sliders.

### 3.3 Things that change
- **Removed:**
  - the single hard-coded group (`seededRoommates` always in the group)
  - the bus rule (walk time with past-20-minutes discounted)
  - the 4 fictional listings
  - the formula banner on Explore
  - the per-member prose blocks on the listing page
- **Rebuilt:**
  - group context: from the active lobby instead of seeded roommates
  - rent per room
  - bedroom filter
  - commute data model (registry places plus custom places)
  - listing cards
  - listing page layout
  - dashboard
  - navigation
  - watchlist and votes, now per lobby

---

## 4. Data model (localStorage, store v2)

### 4.1 `AppState` v2
```ts
interface AppStateV2 {
  version: 2;
  liveProfile: MemberProfile | null;     // extended, see §4.2
  lobbies: Lobby[];
  activeLobbyId: Id | null;              // null = solo mode
  commuteCache: Record<string, CachedTrip>; // key: `${originKey}|${destKey}|${mode}|${arriveBy}`
  demo: { inviteDelayMs: number };       // 3000 by default
}
interface Lobby {
  id: Id; name: string; universityId: "umich"; targetSize: number; // 2–6
  moveIn?: string;                       // e.g. "Fall 2027"
  createdAt: string;
  members: { memberId: Id; status: "invited" | "joined"; invitedAt: string; joinedAt?: string; role: "owner" | "member" }[];
  watchlist: WatchItem[];                // per lobby
  votes: Vote[];                         // per lobby; never shared across lobbies
  scenario: Scenario | null;             // what-if budgets, per lobby
}
```
- **Migration v1 → v2:** keep `liveProfile` and drop everything else. The old seeded group isn't carried over, so the demo starts with no lobby. If a v2 payload fails Zod validation, reset to defaults; this already happens today.
- **Leaving a lobby** removes your membership. If you're the only member left, the lobby is deleted after a confirmation step.
- **Joining via an invitation link** can't work across devices without a backend. Out of scope: invites only go from you to seeded students.

### 4.2 `MemberProfile` additions
```ts
major?: string;
organizations?: string[];                // e.g. ["MRacing"]
photo?: { dataUrl: string; updatedAt: string } | null;   // resized, see §9.1
schedule?: { classes: ScheduleClass[]; image?: { dataUrl: string } | null; confirmedAt?: string } | null;
places: Place[];                         // replaces `destinations` (migrated: registry ids become Places)
weights: Weights;                        // unchanged shape; edited in profile (§7.3)
```
```ts
interface Place {
  id: Id; name: string;                  // "MRacing", "North Campus"
  kind: "registry" | "custom" | "class";
  registryId?: string;                   // campus destinations already in our data
  googlePlaceId?: string; address?: string; lat: number; lng: number;
  verified: true;                        // only saved after the student confirms the place
  visitsPerWeek: number;                 // Daily=5, Several=3, Weekly=1, Occasionally=0.25, or custom
  importance: 1 | 2 | 3;                 // Low / Medium / High
  mode?: TravelMode;                     // defaults to profile.travelMode
  arriveBy?: string;                     // "09:00" by default
  days?: Weekday[];
}
interface ScheduleClass { name: string; days: Weekday[]; start: string; end: string; building?: string; placeId?: Id; confirmed: boolean }
```
Seeded students get the same fields: `major`, `organizations` and `places`.

### 4.3 Listing additions
```ts
images: ListingImage[];                  // ordered; empty means the placeholder
featureEvidence?: Partial<Record<FeatureKey, { quote: string; sourceUrl: string }>>;
interface ListingImage { src: string; type: "exterior" | "interior" | "floor_plan"; sortOrder: number;
  source: "team" | "provider_permission"; attribution: string; rights: string; alt: string }
```
**Subjective feature rule:** `quietBuilding`, `largeKitchen` and `socialAmenities` (plus any feature added later that can't be measured) count as met **only** when `featureEvidence[key]` exists. Without evidence they're treated as `null`. Measurable features (in-unit laundry, dishwasher, parking, A/C, furnished, pets) still need a source, but no quote has to be shown. The listing page shows the quote: *Provider: "chef's kitchen with island"*.

---

## 5. Engine changes (`src/lib/engine/`)

Everything stays deterministic and pure, with tests for every rule.

1. **Group context:** `members` = the live profile plus the **joined** members of the active lobby. Invited members aren't scored until they join. With no lobby, it's the live user only, i.e. "solo".
2. **Bedroom filter:** in a lobby, keep only `listing.bedrooms === lobby.targetSize`. Solo shows all. Do this as a filter before ranking, not as a blocker.
3. **Rent per room:**
   - `per_unit` → `amount / max(1, bedrooms)` (a studio is the whole amount). Per-unit fees follow the same rule.
   - `per_bedroom` / `per_person` → as listed, plus per-person fees.
   - Unknown rent → "Pricing not verified", affordability null, never $0.
   - Update `rent.ts`, the rent text and the rent tests.
4. **Commute:**
   - **Inputs:** for each member place, use the member's mode for that place. **Walk, bike and drive** for registry places come from the committed OSRM matrix. **Transit**, and every mode for custom or class places, comes from the Google commute cache (§6).
   - **Score:** the same curve (100 at ≤ 10 min, 0 at ≥ 40 min), weighted by visits/week × importance. A place without a usable time is left out and the coverage shows "based on 3 of 4 places". If nothing is usable, the subscore is null.
   - **The bus rule is removed.** Walk time is never used for a bus trip.
   - **Average commute (display):** `Σ(minutes × visitsPerWeek) / Σ(visitsPerWeek)` over places with usable times, rounded. One-way. It's not shown as a formula anywhere.
5. **Schedule trips:** for each weekday, sort the confirmed classes. A class counts as a trip from home if it's the first of the day, or if the gap since the previous class ended is **≥ 120 minutes**. A building's `visitsPerWeek` is its number of counted trips. Test MWF back-to-back blocks, a 2:00 gap exactly (counts), 1:59 (doesn't count), and single classes.
6. **Lifestyle and amenities:** apply the subjective feature rule (§4.3). Lifestyle rules fire only on evidenced features.
7. **Roommate similarity (`compat.ts`, new):** compare every field of the two profiles. Each part gives a 0–1 similarity, and the result is a weighted average shown as a 0–100 score. The two biggest contributors become the reasons.

   | Part | Measure | Weight |
   |---|---|---|
   | Budget | overlap of budget ranges (±15% bands) | 0.20 |
   | Places | overlap of campus areas, weighted by visits | 0.20 |
   | Lifestyle | noise, cooking and guests match (exact = 1, adjacent = 0.5) | 0.20 |
   | Priorities | 1 − ½·L1 distance of the weight vectors | 0.10 |
   | Travel | same mode / car situation | 0.05 |
   | Must-haves | the same private-room, parking and laundry needs | 0.10 |
   | Amenities | Jaccard similarity of desired amenities | 0.05 |
   | Major and clubs | same major, shared organizations | 0.10 |

   - **Reasons:** template sentences only, for example:
     - "Both on North Campus most weekdays"
     - "Similar budgets ($1,100–$1,250)"
     - "Both in MRacing"
   - **Labels:** ≥ 80 "Great match", 65–79 "Good match", 50–64 "Some overlap".
   - **Ties:** broken by id.
   - **Tests:** determinism, symmetry, and that the score stays in range.
8. **Weights from priorities:** the levels Very important / Important / Somewhat / Flexible map to 4/3/2/1 and are normalized to sum to 1. This-or-that still adjusts the same weights during onboarding.
9. **What-if:** per-member budget sliders for joined members only. The result card shows **Before** (old #1), **After** (new #1), and **Why**: one sentence from `diffRankings`.
10. **Stage flip (rebuilt):** after the listing swap, find a real home Y that is blocked only by Sam's budget, and that becomes #1 when Sam's budget rises by $100–$250 in a 4-person lobby (Maya + Jordan + Sam + the top candidate). Re-tune the fictional students' budgets and places until it holds. Lock it in with tests that:
    - cover **every** candidate the presenter might invite as the 4th member
    - cover bus and walk modes
    - use Google transit **from a test fixture** (no network in tests)

---

## 6. Google integration (server-only)

- **Key:** `GOOGLE_MAPS_API_KEY` in `.env.local` and on Vercel (Production). Restrict it to the APIs below. It is never sent to the browser.
- **Routes:**
  - `POST /api/places/search` `{query}` → up to 5 candidates (name, address, lat, lng, placeId) from **Places API (New) Text Search / Autocomplete**, biased to Ann Arbor.
  - `POST /api/commute` `{origins: listingIds[], destination: {lat,lng}, modes[], arriveBy}` → minutes per listing and mode, from the **Routes API `computeRouteMatrix`** (TRANSIT with `arrivalTime` = next weekday 9:00 America/Detroit; WALK, BICYCLE and DRIVE for custom places).
- **Caching (at most 30 days):**
  - **Server:** Next `"use cache"` with `cacheLife` of 30 days or less, keyed by request.
  - **Client:** `commuteCache` in the store with `fetchedAt`; anything older than 30 days is refetched.
  - Nothing from Google is committed to the repo.
- **Attribution:** wherever a Google-derived time or place appears, show "Powered by Google" in small text, on the detail commute block and in place search.
- **Failure:** on a timeout (8 s) or error → "Bus estimate unavailable", or "Couldn't find travel times for this place". The place stays saved and is retried later. No made-up numbers.
- **Demo safety:** `/demo` gets a "Warm travel times" button that pre-fetches transit for the demo profile's places to every listing, so stage clicks hit the cache.

---

## 7. UI and UX

### 7.1 Navigation and routes
- **Top nav:** Dashboard (`/dashboard`) · Explore (`/explore`) · Roommates (`/roommates`) · Saved (`/watchlist`, labeled "Saved") · Profile (`/profile`).
- **Active-lobby switcher:** a pill in the nav. It lists your lobbies, "Solo search", and "+ Create a Lobby".
- **Other routes:**
  - `/lobbies/[id]`: the lobby page
  - `/demo`: hidden presenter page
  - `/`: the landing page, which stays as is
- Onboarding finishes on `/dashboard`. The old `/lobby` route redirects to the active lobby, or to `/dashboard`.

### 7.2 Dashboard (`/dashboard`)
- **Header:** "Welcome back, {name}" with the subtitle "Find a home that fits your life."
- **Your housing group:**
  - **If you have an active lobby:** its name, member avatars, "3 of 4 joined", **View lobby**, and **Find Homes Together**.
  - **If you don't:** "Create your housing group" with a **+ Create a Lobby** button.
- **Your profile:** completion %, budget, main campus, top 2 priorities, and **Edit profile**.
- **Suggested roommates:** 3 compact cards (§7.5) and **Discover roommates**.
- **Recommended homes:** the top 3 cards for the active lobby, or solo, and **Explore all homes**.
- **Saved homes:** the count, plus the most recent one with its vote summary.

### 7.3 Lobbies
- **Create Lobby** is a modal:
  - Group name (placeholder "Fall 2027 Roommates")
  - University (pre-filled with Michigan; other schools say "coming soon")
  - Group size (stepper 2–6, default 4)
  - Move-in (optional)
  - **Create Lobby** button
  - It's reachable from the dashboard, the lobby switcher, the Roommates page and Explore's group pill.
- **Lobby page:**
  - name, university, avatars, "3 of 4 joined"
  - **Invite friends**: a list of seeded friends (Jordan, Sam) with Invite buttons
  - **Discover roommates**
  - **Shared priorities**: a short summary such as "Budget matters most to the group · Most of you are on Central Campus"
  - **Find Homes Together**
  - **Leave lobby**
- **Invite flow:** Invite → "Invited · pending" (about 3 s, set in the store) → "Joined". Rankings recompute when someone joins. A full lobby disables further invites and says "Lobby is full".
- **Find Homes Together:** sets the active lobby, then goes to `/explore`. If the lobby has no joined members besides you, it still works and explains "Ranking for you alone until friends join". There's always a destination, so it never fails silently.

### 7.4 Explore
- The header shows the active group ("Ranked for Engineering House · 4 people") or "Solo search · any size, priced per room".
- **Card order, top to bottom:**
  1. large photo, or the placeholder
  2. name
  3. rent per person per month (with "Pricing not verified" when unknown)
  4. beds and baths
  5. "14 min avg for you"
  6. group match: a ring plus a label ("Great fit")
  7. **View details**

  No paragraphs on cards. Blockers show as a single red line ("Over Sam's budget by $150").
- **Removed:** the formula banner. Kept: filters, the Haven tab, map/list toggle, the What-if button, and the source badge (small).

### 7.5 Roommates (`/roommates`)
- **Heading:** "Students you might get along with". The first card has a "Similar to your profile" badge.
- **Cards (4–6):** avatar (initials and color), name, major, a label plus a small number ("Great match · 86"), **2 reasons**, and **Invite to lobby**. If there's no lobby, the button opens Create Lobby first.
- No schedules and no detailed breakdowns. Friends already in the active lobby are left out.

### 7.6 Listing page
1. **Top:** gallery (§9.3), name, rent per person per month, beds, baths, address, group match ring with a one-line summary ("Strong fit for your group's budgets and commutes").
2. **Each roommate:** a compact card per member:
   - Name, then: Match 82 · Commute 14 min avg (Bus · 4 places) · Rent $1,040/mo · Within budget / Over by $40
   - One short note: the strongest fit or the main compromise.
   - Missing data shows as "Bus estimate unavailable" or "based on 3 of 4 places".
   - A "Details" expander lists each place's time.
3. **Key amenities:** verified items as chips; subjective items with their quote; unknowns listed as "Not listed".
4. **Pros and trade-offs:** at most 2 of each, from `explainListing`.
5. **Group vote:** §7.7.
6. **Sources & resources:** the official listing link, observed date, and verification notes (e.g. "occupancy unverified").
7. **"How we score"**, collapsed: the group formula, weights, curves and assumptions. This is the only place math appears.

### 7.7 Voting and saved homes
- **Vote buttons:** three equal-width buttons (icon + label) on desktop that wrap to stacked full-width buttons below about 360px. Use `min-width: max-content` on labels, no fixed widths, and no truncation. The selected state uses a filled color.
- **Summary:** "**2 of 4 interested**", an avatar row, then "2 Interested · 0 Maybe · 0 Pass · 2 waiting". The consensus label stays: Strong interest, Mixed, and so on. Members who haven't voted show "Waiting for roommates' votes".
- **Scope:** votes and saved homes belong to one lobby only. The match score and votes are always shown separately.

### 7.8 Profile
Sections:
- **About you:** name, photo, major, organizations
- **Places you go often:** with **+ Add location**
- **Schedule:** upload or manual
- **Budget & getting around**
- **Must-haves & nice-to-haves**
- **Customize your priorities:** five rows with four levels each; the numeric weights appear under "Advanced"
- **Settings:** Delete my profile

**Add location form:**
- Name
- Search box: Google candidates, and the student taps the correct one, with a small map pin preview
- How often: Daily / Several times a week / Weekly / Occasionally / Custom per week
- Transportation: Walk / Bus / Bike / Drive
- Importance: High / Medium / Low
- Optional: arrival time and days

Edit and remove are inline.

### 7.9 Copy
- No "algorithm", "weighted" or "mean/min" anywhere outside "How we score".
- Use the V3 doc's replacements: "Your group match", "How well it fits everyone", "Commute for each roommate", "Things your group may need to compromise on" and "Find Homes Together".

---

## 8. Onboarding (updated flow)
1. **Free text:** stays as is. Gemini parse, then review.
2. **New step "About you":** major, organizations (chips) and an optional photo. If an organization like "MRacing" is entered, suggest adding it as a place (goes through the Google confirm flow).
3. **Places:** parsed places, plus **+ Add location**.
4. **Optional "Upload your schedule"** (§9.2).
5. **This-or-that:** stays as is. Then go to `/dashboard`.

---

## 9. Uploads and images

### 9.1 Profile photo
- **Formats:** JPEG, PNG or WebP, up to 8 MB.
- **Processing:** resized in the browser to 256×256 and stored as a JPEG/WebP data URL of about 100 KB or less in the store.
- **Controls:** preview, Change, Remove. The fallback is the initials avatar.
- Invalid files get an inline error.

### 9.2 Schedule screenshot
- **Formats:** JPEG, PNG or WebP, up to 8 MB. Downscaled to a long edge of 1600 px or less before upload.
- **Route:** `POST /api/schedule/parse` (server, Gemini vision, same model race as the profile parse, 15 s budget) returns `ScheduleClass[]`. The prompt rule is that only what's visible gets extracted. A missing building or time stays empty; nothing is guessed.
- **Review table:** class, days, start and end, building. All fields are editable, and the student confirms each row.
- **Buildings:** each confirmed building goes through the Google confirm flow to become a `class` place. Trips are counted with the 2-hour rule (§5.5).
- **Fallback:** if parsing fails, the same table opens empty for manual entry.
- **Image storage:** a thumbnail of about 300 KB or less is kept for preview, Replace and Remove.

### 9.3 House photo gallery
- **Viewer:**
  - large main image with a thumbnail strip
  - next/prev buttons and arrow keys
  - full-screen dialog
  - swipe on touch devices
  - a skeleton while loading
  - an error fallback
- **Placeholder:** with no images, show a neutral "Photo coming soon" block (no fake house illustration on real addresses).
- **Credit line:** every image shows a small caption with its source.

---

## 10. Hidden `/demo` page
Not linked anywhere. Controls:
- **Reset demo:** clears lobbies, votes, saved homes, scenarios, the commute cache and onboarding. This is only the browser store; no real data exists elsewhere.
- **Load demo profile:** skips onboarding by applying the cached demo parse plus MRacing as a confirmed place.
- **Warm travel times:** see §6.
- **Invite delay:** 0 / 3 / 5 seconds.
- **Status:** whether Google and Gemini keys are present (yes/no only, never the values) and the cache size.

---

## 11. Listings and photos

### 11.1 Catalog changes
- Remove `stub_packard_house`, `stub_northside_4br`, `syn_kerrytown_row` and `syn_stadium_townhomes`.
- Add real listings from offcampushousing.umich.edu (observed date and link for each):
  - **more 4-bedroom homes**, varied by area and price
  - **budget options** near Sam's range
  - **some 1–3 bedroom homes** for solo searches
- The target is about 18–20 total.
- For each listing, record only facts the page states. Subjective features get a quote or are left unknown.

### 11.2 Photo checklist for the team
- **Folder:** put files in `public/listings/<listing id>/`, named `01-exterior.jpg`, `02-interior.jpg`, … (JPEG or WebP, long edge ≤ 2000 px).
- **Manifest:** for each file, add a line to `public/listings/<listing id>/credits.json`: `{ "file": "01-exterior.jpg", "type": "exterior", "attribution": "Photo: <team member>", "rights": "team-owned" }`.
- **Rights:** only photos the team took, or has written permission to use.

| Listing id | Name | Address | BR |
|---|---|---|---|
| `geddes_4br` | Haven on Geddes, 4BR Home | 1700 Geddes Avenue, Ann Arbor, MI 48104 | 4 |
| `geddes_3br_bilevel` | Haven on Geddes, 3BR Bi-Level | 1700 Geddes Avenue, Ann Arbor, MI 48104 | 3 |
| `geddes_3br_ranch` | Haven on Geddes, 3BR Ranch | 1700 Geddes Avenue, Ann Arbor, MI 48104 | 3 |
| `um_landmark_4br` | Landmark, 4BR | 1300 South University Ave, Ann Arbor, MI 48104 | 4 |
| `um_foundry_4br` | Foundry Lofts, 4BR/4BA | 413 E Huron St, Ann Arbor, MI 48104 | 4 |
| `um_yard_4br` | The Yard, 4BR | 615 South Main Street, Ann Arbor, MI 48104 | 4 |
| `um_trails_4br` | University Trails, 4BR Townhome | 2327 Erie Drive, Ann Arbor, MI 48105 | 4 |
| `um_courtyards_4br` | The Courtyards, 4x4 | 1780 Broadway Street, Ann Arbor, MI 48105 | 4 |
| `um_depot_4br` | 106 Depot St, 4BR House | 106 Depot St, Ann Arbor, MI 48104 | 4 |
| `um_miller_4br` | 209 Miller Ave, 4BR House | 209 Miller Ave, Ann Arbor, MI 48104 | 4 |
| `um_smain_4br` | 720 S Main St, 4BR House | 720 S Main St, Ann Arbor, MI 48104 | 4 |
| `um_mary_4br` | 602 Mary Ct, 4BR House | 602 Mary Ct, Ann Arbor, MI 48104 | 4 |
| `um_ashley_3br` | 217 N Ashley St, 3BR Duplex | 215/217 N Ashley St, Ann Arbor, MI 48103 | 3 |
| `um_oldwest_1br` | 443 3rd St, 1BR Duplex | 443 3rd St, Ann Arbor, MI 48103 | 1 |
| `um_hub_studio` | Hub Ann Arbor State, Studio | 723 Packard Street, Ann Arbor, MI 48104 | 0 |
| `um_forest_4br` | 727 S Forest Ave, 4BR Apartment | 727 S Forest Ave, Ann Arbor, MI 48104 | 4 |
| *(new)* | Added during the catalog step (§11.1) | listed in `docs/listing-photos.md` once chosen | |

**Open item:** the Haven 4BR whole-unit price of $4,396 isn't on Haven's live page (it shows only 3BR layouts). Either verify it with Haven, or relabel it "Pricing not verified" and drop it from affordability. Under §5.3 it would show as $1,099 per room.

---

## 12. Demo script (about 5 min)
1. `/demo` → Reset (done offstage). Open `/`, click **Find My Fit**, then **Michigan**.
2. **Profile:** type the demo sentence → review → About you (Engineering, MRacing → add as a place; confirm the Google result) → optional schedule screenshot → this-or-that → Dashboard.
3. **+ Create a Lobby:** "Engineering House", size 4.
4. **Invite friends:** Jordan and Sam → pending → joined.
5. **Roommates:** "Students you might get along with". Invite the top "Similar to your profile" card → joined.
6. **Find Homes Together:** Explore ranks for the 4 people, showing only 4-bedroom homes, with photo cards and "avg for you" times.
7. Open the top home (e.g. 720 S Main): photos, per-room price, group match, roommate cards with average commutes, trade-offs, and the source link. Back to all homes: no crash.
8. **Save** it and vote **Interested**. The summary reads "1 of 4 interested · 3 waiting".
9. **What-if:** raise Sam's budget → Before/After/Why shows a real home becoming #1. Reset.
10. Close: "Find roommates who fit your lifestyle and homes that fit your group."

---

## 13. Tests and checks
- **Engine (Vitest):**
  - rent per room, including studios and per-bed listings
  - the bedroom filter
  - the subjective feature rule
  - average commute, with partial coverage
  - transit missing → null, never a walk substitute
  - schedule trip counting (the 2-hour boundary)
  - similarity: range, symmetry, determinism, reasons
  - weights from priorities
  - the rebuilt flip for every candidate as the 4th member
  - existing property tests updated
- **Store:**
  - v1 → v2 migration
  - per-lobby votes and saved homes stay separate
  - leaving a lobby
  - invite → joined
- **Routes:**
  - `/api/places/search`, `/api/commute` and `/api/schedule/parse` with mocked providers: success, timeout, bad input, key missing
- **Browser checks (production build and Vercel), zero console errors:**
  - 10× Explore ↔ listing round trips
  - Find Homes Together from the dashboard and from the lobby page
  - refresh on `/explore` and on a listing
  - a direct listing URL
  - browser back
  - vote buttons at 320 / 390 / 768 / 1280 px with no clipping
  - no horizontal scroll at 390 px
- `npm run check` and `npm run build` are green before every push.

---

## 14. Build order
0. **Push** the current version to `RitvikGoyal0/URB_Hackathon_2026` `main`: merge his 2 commits with `--allow-unrelated-histories`, keep our README, no force push. Then work on `main`.
1. **Fix the map crash** and add error boundaries. Run the round-trip check on Vercel.
2. **Store v2** with lobbies, then the engine group context, bedroom filter and rent per room (with tests).
3. Lobby UI, invites, the dashboard and the nav switcher.
4. `compat.ts` with the Roommates page.
5. **Catalog swap:** remove the fictional listings, add real ones, add the feature evidence. Rebuild the flip and re-tune personas (with tests).
6. **Google routes,** then places add/edit/remove, transit, average commute, and the `/demo` warm-up. *(Shaurya provides `GOOGLE_MAPS_API_KEY` before this step.)*
7. Simpler cards, listing page, voting and the collapsed "How we score".
8. Uploads (profile photo, then the schedule parse) and the gallery for whatever team photos have arrived.
9. **Polish and full demo run:** desktop plus 390 px. Push and deploy.

**If time runs out, cut in this order:**
1. schedule screenshot parsing (manual entry stays)
2. full-screen gallery and swipe
3. lobby "Shared priorities" summary
4. dashboard "Suggested roommates" strip

---

## 15. Risks and notes
- **Scope vs. time:** all four groups in 3–5 hours is aggressive. The build order puts demo-critical work first.
- **Google dependency on stage:** use the `/demo` warm-up. If Google fails, the app shows "Bus estimate unavailable" instead of failing, but Maya's commute numbers would then be partial.
- **The Google key and team photos must arrive before steps 6 and 8.**
- **Honesty:** no demo tags in the app, at the team's request, so the presenter must say the students are fictional. All listings will be real.

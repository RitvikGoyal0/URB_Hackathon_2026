# Roommate contact, invite link and voting refinements: spec

Status: agreed in interview, 2026-11-20. Not implemented yet.
Builds on [v3-refinement-spec.md](v3-refinement-spec.md). Where this spec is silent, V3 still applies.

## 0. Ground rules

- **No backend.** The app stays localStorage-only (`htl:app-state:v1`, store version 2). The invite link is cosmetic (§4). Contact info for the fictional roommates is seed data (§3.4).
- **Don't change anything about multiple lobbies.** Creating, switching, leaving lobbies and the per-lobby saved/votes/what-if buckets stay exactly as they are.
- **Keep the current invite behaviour.** Inviting Jordan and Sam ("Invited · pending" → "Joined") and inviting a suggested roommate stay unchanged.
- Run `npm run check` (typecheck + lint + tests) before every push. Update tests that encode removed behaviour; don't delete coverage.

## 1. Remove the "How will you usually get to campus?" follow-up

**Why.** Most housing is close to campus, so students walk or bike to Central and take the bus to North. The question adds friction at the top of the Check it step.

**Change.**
- `buildFollowUps` (`src/lib/onboarding/index.ts` ~L265–268) no longer emits a `travelMode` follow-up, whether the parse is ambiguous (`travelModeOptions`) or the mode is missing (`missing` includes `"travelMode"`).
- Default when the text doesn't settle the mode:
  - The parse has a definite `travelMode` → use it, as today. This includes an explicit bus or drive.
  - The parse is ambiguous (`travelModeOptions`) and the options include `"bike"` → bike.
  - Otherwise → walk (`NEUTRAL_TRAVEL_MODE`).
  - The student's rule was "walk unless they mention bike". Keeping an explicitly stated bus or drive is my reading of it, and the conservative one.
  - A defaulted mode from an ambiguous parse is stored as a user/seed default, not an unconfirmed AI field, so it doesn't add to the "N unconfirmed" count.
- **Keep** the "Getting Around" section in the profile editor ("Usual way to campus" segmented control and "Car"). Per-place modes stay too. Only the follow-up question goes.
- The `FollowUpCard` `travelMode` branch and the `FollowUp` `travelMode` variant can be removed if nothing else uses them.

**Demo impact.** The cached demo sentence parses as `travelModeOptions: ["bus","walk"]`, so it now defaults to **walk**. `demo-flip.test.ts` already covers on-foot, so the What-if flip still holds.

**Tests.**
- `src/lib/__tests__/demo-path.test.ts` L80 expects `["place","travelMode"]` → change it to `["place"]`.
- The loop at L45–47 that answers the travel-mode follow-up becomes a check that the defaulted mode is walk. Keep the across-modes coverage by setting the mode directly with `setTravelMode`.
- Add unit tests for the default rule: ambiguous without bike → walk, ambiguous with bike → bike, explicit bus → bus.

## 2. Onboarding: new "Roommate search" step (public profile)

### 2.1 Step order

`Your week → Check it → Roommate search (new) → About you → Quick picks`

Add `"public"` to `Step` and `STEPS` in `onboarding-flow.tsx`, with the label "Roommate search". It must fit the progress bar at 320 px; non-current labels are already `sr-only` below 380 px. Back from About you goes to Roommate search; Back from Roommate search goes to Check it.

### 2.2 Status question

The first card asks: **"Are you looking for a roommate?"** It has two big choices:
- **Actively looking for a roommate.** Hint: "Other students can find you and reach out."
- **Already found my roommates.** Hint: "You can still browse students and reach out."

This is not a private/public switch. It's a status.

### 2.3 Public profile fields

Both statuses get these fields, moved here from About you:
- Photo (`PhotoField`)
- Major
- Clubs, teams and organizations (chips)

Only **Actively looking** also gets:
- **Email.** Must end in `@umich.edu` (case-insensitive, trimmed).
- **Phone.** US, exactly 10 digits after removing formatting. Stored as digits and shown as `(734) 555-0123`.
- **At least one** of email or phone is required.
- A **required checkbox**: "I understand my email and phone number will be shown to any student the app suggests as a possible roommate."
- Continue stays disabled until there's one valid contact and the box is ticked. Inline errors show for an invalid email or phone.

If the student switches from Looking to Found in this step, keep any typed contact in the form state but don't save it on the profile.

### 2.4 About you after the move

About you keeps **Places you go often** and **Upload your schedule** (§5).

**Club → place hand-off.** Today `AboutFields` asks "Do you go regularly? Where is it?" when a club is added, and passes it to `PlacesSection` via `onAskPlace`. That prompt now moves to About you:
- Each club added in Roommate search that has no matching place (same name, case-insensitive) shows at the top of About you as a "Where is <club>?" card.
- The card opens the places picker prefilled with the club name. This is the same path as `start` / `PlaceSuggestion` today.
- Dismissing a card ("I don't go regularly") hides it for the session.
- The demo path must still work: MRacing → "Where is it?" → Wilson Center → 3×/wk → Bus → High.

The `/profile` editor can keep showing photo, major and clubs in its own About section. Only the onboarding split changes.

### 2.5 Data model

These additions are all optional, so existing v2 payloads still validate and **no store version bump** is needed:

```ts
// MemberProfile (types.ts) + Zod mirror (schemas.ts memberProfile)
roommateStatus?: "looking" | "found";        // undefined ⇒ treat as "found" for the live user
contact?: {
  email?: string;        // lowercase, @umich.edu
  phone?: string;        // 10 digits, no formatting
  consentAt: string;     // ISO time the checkbox was ticked
} | null;
```

- Save `contact` only when `roommateStatus === "looking"`. On "found", clear it (`null`).
- The Zod schema enforces the umich.edu and 10-digit rules for stored values, so bad data fails validation on load.
- Put the email/phone validators and the phone formatter in `src/lib/contact.ts` (new) and unit test them.

### 2.6 Editing later (low priority)

Add a "Roommate search" section on `/profile` with the status toggle, contact fields and consent checkbox, using the same rules. It isn't shown in the demo, so keep it plain: at the end of the page, collapsed by default. It's fine to ship last.

## 3. "Students you might get along with": contact

### 3.1 Who appears

- Only students with `roommateStatus === "looking"` appear. All 9 personas are seeded as looking. Friends (`FRIEND_IDS`) stay excluded as today.
- The live user's own status doesn't hide the list. A student who has already found roommates can still browse and reach out.
- Ranking (`rankRoommates` / `compat.ts`) doesn't change.

### 3.2 Contact button

- Each card gets a **Contact** button next to "Invite to lobby", or next to the Joined/Invited status.
- It opens a small popover (Base UI popover/dropdown, as used elsewhere) with:
  - Email as a `mailto:` link, with a copy button.
  - Phone, shown formatted, with `tel:` (Call) and `sms:` (Text) links and a copy button.
  - Only the methods the student provided.
- Copy shows the toast "Copied". The popover must fit at 320 px.

### 3.3 Compact cards

The dashboard's compact `SuggestedRoommates` gets the same Contact button, icon-sized if space is tight.

### 3.4 Seed data

Add realistic `@umich.edu` emails and 10-digit phone numbers to all 9 personas in `src/data/personas.json`, with `roommateStatus: "looking"` and a fixed `consentAt`.

> ⚠️ Risk: this was the team's choice. Realistic-looking addresses and numbers may belong to real people. Pick uniqnames and numbers that are unlikely to be in use (phones from the 555-01xx range are reserved and still look real). The presenter already says on stage that the students are fictional.

### 3.5 Copy

The `/roommates` page intro still says "You only see ranges, never exact schedules". Add: "Students here are looking for roommates and chose to share how to reach them."

## 4. Invite link (cosmetic)

- On the lobby page (`lobby-page-view.tsx`), in the **Invite friends** section, **above the Jordan and Sam rows**, add an invite-link box:
  - A read-only input with a fake URL.
  - A **Copy link** button. It copies the URL and shows the toast "Invite link copied".
- The URL is fake but stable per lobby, and long enough to overflow the input so the end is cut off. For example: `https://hack-the-lease-seven.vercel.app/join/<lobby-name-slug>-<lobby id>?ref=<12–16 char token>`.
  - Derive the token deterministically from the lobby id, so it doesn't change on re-render or reload.
  - The input scrolls horizontally on focus but never widens the page. There must be no page overflow at 320/390 px.
- **It's always shown and always works**, even when the lobby is full. There's no `/join` route; opening the URL does nothing special.
- Nothing else about inviting changes (§0).

## 5. Schedule prompt: Wolverine Access with locations

- About you → "Upload your schedule" stays **optional**.
- Replace the copy with one sentence: "Upload a screenshot of your class schedule from Wolverine Access, in a view that shows each class's room or building."
- Then a link-style button: **"How do I get this?"** It opens a **dialog** (the existing `ui/dialog`) with detailed steps:
  1. Sign in to Wolverine Access.
  2. Go to Student Business → View My Class Schedule.
  3. Switch to **List View** so the **Room** column shows (for example "1013 DOW").
  4. Pick the term, then take a screenshot that includes the class names, days, times and rooms.
  5. Upload it here. You'll check each class and confirm its building before it counts.

  Verify the menu names against the current Wolverine Access before shipping. If they differ, use the real names. Don't guess.
- Apply the same copy and dialog to the `/profile` Schedule section hint.
- The parser (`src/lib/ai/schedule.ts`) already extracts `building` exactly as shown. No change there.

## 6. Voting saves the home

- **Any vote saves it.** Interested, Maybe or Pass adds the home to the active context's Saved list, if it isn't there already, with `openQuestions` from `defaultOpenQuestions`.
- **Clearing your vote leaves it saved.**
- **Removing from Saved also clears your vote** on that home.
  - The toast reads "Removed <name> and cleared your vote", with **Undo**.
  - Undo restores both the watch item, with its original `at` and `openQuestions`, and the vote, with its original value and `at`.
  - If there was no vote, it's the same toast without the vote wording.
- Implement in the reducers so it holds everywhere: listing page `VotePanel`, Saved page vote buttons, and the listing-card/detail Save buttons.
  - `castVote` ensures the watch item exists.
  - Removal goes through a new `unsave(listingId)` reducer that drops both. It returns what it removed, for Undo, and has a matching `restore` action.
  - `toggleWatch` on a saved home calls the same path.
- Votes stay per lobby / solo (§0).
- Saved/Watchlist names and page title stay as they are.
- **Tests** (`store.test.ts`): a vote creates the watch item; clearing the vote keeps it; unsave removes both; restore brings both back exactly; a Pass vote also saves.

## 7. Per-person votes are icon-only

**Where.** The Saved page's per-person Votes grid (`watchlist-view.tsx`) and the listing page's Group vote avatar row (`vote-panel.tsx`).

**What each person's vote shows:**
- Interested → thumbs up, teal (`bg-teal-soft text-teal`)
- Pass → thumbs down, red (`bg-blocker-soft text-blocker`)
- Maybe → dash (`Minus`), grey (`bg-secondary text-charcoal`)
- No vote → an empty dotted circle (`border border-dashed`), no text
- Each icon has an accessible name, e.g. `aria-label="Sam: Interested"` or `"Sam: No vote yet"`, and a `title` tooltip with the same text.

**What doesn't change:**
- The live user's own **Your vote** buttons keep their labels (Interested / Maybe / Pass) on both pages.
- Tallies and consensus text keep their words ("1 of 4 interested · 3 waiting", "Waiting for roommates' votes", `ConsensusBadge`).

## 8. Explore: remove Filters

**Remove:**
- The **Filters** button and the `FilterBar` panel from `explore-view.tsx`.
- The "No homes match these filters / Clear filters" empty state.
- The `passes()` filtering, so every ranked row shows.

**Why.** The profiles are the filters. Blocked homes still show in red and sort below the rest, as today.

**Keep:**
- The All / Haven tabs.
- The What-if button.
- Lobby bedroom matching (a lobby shows only homes with exactly as many bedrooms as its size; solo shows every size).

**URL.**
- `explore-query.ts` keeps parsing `tab` but ignores and drops the old filter params.
- Old links with filter params still load. "Back to all homes" still keeps the tab and scroll position.
- Delete `filters.tsx` if nothing else imports it. Update or remove the filter cases in `explore-query.test.ts`.

**Copy.** "Showing N of M homes" becomes "Showing N homes", or "N Haven floor plans" on the Haven tab.

## 9. What-if button shows its full text

- Button label: **"What if budgets changed?"**, keeping the Sparkles icon and the amber "on" pill when a scenario is active.
- Full text **at every width**. On narrow screens the toolbar wraps so the button gets its own row; it's never truncated or cut off. Check at 320 and 390 px.
- The panel heading already reads "What if budgets changed?" and stays as it is.

## 10. Listing pricing and photos

The team will provide pricing and photos for every house. The format isn't decided, so this is **out of scope for this spec**.
- For now, the existing photo pipeline (`public/listings/<id>/` + `credits.json` + `npm run photos`, see `docs/listing-photos.md`) and "Pricing not verified" for unknown rent stay as they are.
- Handle the data when it arrives.

## 11. Demo and docs

**`/demo` "Load demo profile"** (`src/lib/demo-profile.ts`):
- Set `roommateStatus: "looking"`.
- Add a placeholder `@umich.edu` email and phone, with `consentAt` set.
- Update `demo-profile.test.ts`.

**README demo script:**
- Step 2: add Roommate search (Actively looking → email or phone → tick the box); photo, major and clubs now go here.
- Step 2: the MRacing "Where is it?" prompt now happens on About you.
- Step 4: mention the invite link box.
- Step 5: mention the Contact button.
- Step 8: voting now saves the home.
- Remove any Filters mention.

**README "Privacy and fairness":**
- Contact info is shown to suggested matches only when the student is actively looking and ticked the consent box.
- It's still stored only in this browser.

## 12. Acceptance checklist

- [ ] Check it never asks "How will you usually get to campus?". The demo sentence defaults to walk; ambiguous-with-bike defaults to bike.
- [ ] Onboarding has 5 steps; Roommate search comes before About you.
- [ ] Looking requires a valid umich.edu email or 10-digit phone, plus the ticked box. Found shows no contact fields.
- [ ] MRacing added in Roommate search shows "Where is MRacing?" on About you.
- [ ] The roommate list shows only "looking" students, each with a Contact popover (mailto / tel / sms / copy).
- [ ] The lobby page shows a long, cut-off fake invite URL above Jordan and Sam; Copy works, even when the lobby is full.
- [ ] The schedule card has the one-sentence Wolverine Access prompt and a "How do I get this?" dialog. Upload stays optional.
- [ ] Any vote adds the home to Saved. Unsave clears the vote, and Undo restores both.
- [ ] Per-person votes on Saved and on the listing page are colored icons only, with a dotted circle for no vote and accessible labels.
- [ ] Explore has no Filters button. The What-if button reads "What if budgets changed?" in full at 320 px.
- [ ] Multiple-lobby behaviour is unchanged. `npm run check` passes, and there's no horizontal overflow at 320/390 px.

# Demo walkthrough (repeatable)

Every number below comes from the real engine and the team's final prices. `src/lib/__tests__/demo-path.test.ts` locks each one, so if anything changes (a price, a persona, the scoring), `npm test` fails before the demo does. To reprint the numbers after a change, run `npx tsx scripts/demo-dump.ts` and update this page.

## The four people

| | Who | Why they're in the demo |
|---|---|---|
| **Alex** (you, typed on stage) | Aerospace Engineering. North Campus 4×/wk, Central 2×/wk, MRacing at the Wilson Center 3×/wk, six classes from a Wolverine Access screenshot. Bikes everywhere, no car. Cooks a lot, wants a quiet home, a big kitchen, a dishwasher and in-unit laundry. On Check it, adds a **private bedroom** (must-have) and **A/C** by hand. **$1,100**/month. | Shows the AI reading a week, quoting its sources, and the student correcting and adding to it. |
| **Riley** (matched roommate) | Alex's near-twin and classmate: Aerospace Engineering, the same six classes, MRacing, North + Central by bike, quiet, cooks a lot, the same must-haves (private bedroom), A/C and priorities. **$1,150**. | Top suggestion: **Great match · 95**, "Both on North Campus most weeks · Both want a quiet home". Next best is Dana at 61. |
| **Jordan** (friend) | Political Science. Central Campus 5×/wk, Kerrytown 1×/wk. Walks. Social, has people over often. **$1,200**. | Disagrees with Alex on location: the least-satisfied member at Fair St (39-minute walk to Central). |
| **Sam** (friend) | Public Health. Central 3×/wk, Medical Campus 2×/wk. Bikes. **$850, hard cap.** | The budget that blocks better homes. Raising it flips the #1 home. |

The other five suggested roommates (Priya, Dana, Theo, Elena, Marcus) are there for contrast.

## Before you start

1. Open `/demo` (hidden page) → **Reset demo**. Set the invite delay (3 s is good on stage).
2. Use a normal window. A private window works too, but it forgets everything when closed.
3. Download **Alex's schedule screenshot** from `/demo` (or use `public/demo/alex-schedule.png` from the repo) and keep it somewhere easy to find, such as the Desktop. Don't edit, crop or re-save it: the app recognizes this exact file.
4. If short on time: `/demo` → **Load demo profile** creates exactly the same Alex as steps 1–5 below, schedule included. Then start at step 6.

## Script

### 1. Your week (`/` → **Find My Fit** → **Michigan**)
- **Your first name:** `Alex` (it's prefilled, so leave it).
- Click the first example chip, **North Campus aerospace engineer**. It fills in:

  > I'm an aerospace engineering student. I'm on North Campus four days a week and Central Campus twice a week. I bike everywhere and don't have a car. I cook a lot, so I want a big kitchen, a dishwasher and in-unit laundry. I need a quiet place to live, and my budget is $1,100 a month.

- Leave **Monthly budget** empty. Click **Read my week**. The answer is instant: it comes from the cache, with no AI call.

> **Always use the chip, or that exact sentence.** Upper/lower case and extra spaces don't matter, but any other change in wording misses the cache. A missed sentence goes to the live AI (or to the manual form if there's no API key), and its result can differ.

### 2. Check it
- There are no follow-up questions, and the banner says **10 details still need your OK**.
- Point out the quotes under each detail, e.g. *from: "…on North Campus four days a week…"*.
- **Add what the sentence didn't say** (this is the editing moment):
  1. **Must-haves → A private bedroom:** turn the switch on ("Required").
  2. **Nice-to-haves → Air conditioning:** tap the chip so it shows a ✓.

  Both count straight away as the student's own details, with no quote, because nothing was guessed. A home with shared bedrooms now gets a red blocker for Alex, and an unknown bedroom setup gets a warning.
- Click **Confirm all** (the 10 AI details) → **Continue**.

### 3. Roommate search
- **Actively looking for a roommate**.
- **Major:** `Aerospace Engineering`. **Clubs:** type `MRacing` → **Add**.
- **U-M email:** `alexhtl@umich.edu`. Tick the consent box.
- *Optional:* first type `alex@gmail.com` and click Continue to show the validation errors.
- Click **Continue**.

### 4. About you
- The card **Where is MRacing?** → **Where is it?** → **Wilson Student Team Project Center** (suggested) → **A few times a week** → **Bike** (already selected) → **High**.
- **Upload your schedule:** you can open **How do I get this?** first to show the Wolverine Access instructions. Then click **Upload a screenshot** and pick `alex-schedule.png`.
  - It's read instantly from its known rows: **Found 6 classes. Check each one, then confirm it.** No AI call is made, so this works without a key or a network connection.
  - For each of the six rows: **Is this ___? → Yes**, then tick **This is right**. The six buildings are Chrysler, G.G. Brown, Mason Hall, Weiser Hall, Ford Robotics and EECS.
  - Click **Save schedule (6 confirmed)**. The summary shows the classes that add trips from home: Chrysler 2, Mason Hall 2, Ford Robotics 1, EECS 1. G.G. Brown and Weiser Hall add none, because they come straight after another class.
- Click **Continue**.

### 5. Quick picks (3 questions; the quiet and cooking questions are skipped because the sentence answered them)
1. Which matters more day to day? → **More space at home**
2. If you had to pick one… → **Lower rent**
3. Your bedroom situation → **A room of my own**

This lands on the dashboard. Alex's weights are now affordability 30, commute 20, amenities 15, lifestyle 15, space 20.

### 6. Dashboard (solo)
"Recommended for you": **1417 Broadway, 4BR Duplex (North Campus) (72)**, 217 N Ashley St (81), State Street Village (80). Alone, Alex sees every size, priced per room. Broadway leads despite the lower score because everything Alex asked for can be checked there: private bedrooms are confirmed, and it has A/C and a quiet building. Homes with unknowns rank below it. That's the Check it edit at work: 217 N Ashley St was #1 (87) before Alex required a private bedroom, but its listing doesn't say whether bedrooms are private, so it drops into the "unknowns" group. State Street Village is there too, because its listing doesn't say whether it's quiet or has a big kitchen.

### 7. Create a lobby
**Create a Lobby** → Group name `Engineering House`, **4 people** (default) → **Create Lobby**.
- Point out the **invite link** box (copy it to show the toast).
- **Invite** Jordan and Sam. They show "Invited · pending", then "Joined".

### 8. Explore with three people
**Find Homes Together**. Only 4-bedroom homes appear:
1. **1805 Fair St** — $699/person, **67**
2. **State Street Village** — $885/person, 60, red: **Over Sam's budget by $35**
3. Foundry Lofts — $1,149/person, 58, over Sam's (and Alex's) budget

### 9. Roommates
**Roommates** (top nav): **Riley — Great match · 95** (next best: Dana 61), "Both on North Campus most weeks · Both want a quiet home".
- Click **Contact** to show Riley's email and phone.
- **Invite to lobby**. Riley joins after the delay.

### 10. Explore with all four
1. **1805 Fair St — 68** · $699/person. The cheapest home; Jordan is the least happy there (51: a 39-minute walk to Central).
2. **State Street Village — 63** · over Sam's budget by $35
3. **720 S Main St — 61** · over Sam's budget by $38

Open **1805 Fair St**. It shows "Main drawback: a 39-minute walk to Central Campus for Jordan", and each roommate's card scores the home separately: Alex 76, Jordan 51, Sam 90, Riley 76. Alex and Riley lose some points here because Fair St has no A/C.

Optional: vote **Interested**. The home is saved automatically, and **Saved** shows it with a 👍 icon for Alex and empty circles for the others.

### 11. What if budgets changed?
Back on Explore → **What if budgets changed?** → drag **Sam** from $850 to **$950** (+$100).
On a laptop: click Sam's slider handle, then press **→** four times ($25 per press).

- **#1 State Street Village — 75** (was #2, blocked)
- #2 720 S Main St — 71 (has A/C) · #3 602 Mary Ct — 70 · Fair St drops to #4 (68)
- **What changed? → Why:** "State Street Village, 4BR Apartment became affordable for Sam, and it fits Jordan better on amenities (67 vs 33)."

Any value from **$900 to $1,100** gives the same #1, so the slider doesn't need to be exact. $875 is not enough. **Reset** puts Fair St back on top.

## Talking points
- **Separate scores:** the same home scores 51 for Jordan and 90 for Sam. The group score is 75% the average plus 25% the least-satisfied person, so nobody gets outvoted.
- **Blocked homes stay visible**, marked in red with the exact dollar gap, so the group sees what one budget change would unlock.
- **The matched roommate is explained**, not just ranked. Riley's card says why.

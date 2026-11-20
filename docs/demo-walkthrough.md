# Demo walkthrough (repeatable)

Every number below comes from the real engine and the team's final prices. `src/lib/__tests__/demo-path.test.ts` locks each one, so if anything changes (a price, a persona, the scoring), `npm test` fails before the demo does. To reprint the numbers after a change, run `npx tsx scripts/demo-dump.ts` and update this page.

## The four people

| | Who | Why they're in the demo |
|---|---|---|
| **Alex** (you, typed on stage) | Aerospace Engineering. North Campus 4×/wk, Central 2×/wk, MRacing at the Wilson Center 3×/wk. Bikes everywhere, no car. Cooks a lot, wants a quiet home, a big kitchen, a dishwasher and in-unit laundry. **$1,100**/month. | Shows the AI reading a week, quoting its sources, and turning it into a profile. |
| **Riley** (matched roommate) | Alex's near-twin: Aerospace Engineering, MRacing, North + Central by bike, quiet, cooks a lot, the same must-haves and priorities. **$1,150**. | Top suggestion: **Great match · 95**, "Both on North Campus most weeks · Both want a quiet home". Next best is Priya at 66. |
| **Jordan** (friend) | Political Science. Central Campus 5×/wk, Kerrytown 1×/wk. Walks. Social, has people over often. **$1,200**. | Disagrees with Alex on location: the least-satisfied member at Fair St (39-minute walk to Central). |
| **Sam** (friend) | Public Health. Central 3×/wk, Medical Campus 2×/wk. Bikes. **$850, hard cap.** | The budget that blocks better homes. Raising it flips the #1 home. |

The other five suggested roommates (Priya, Dana, Theo, Elena, Marcus) are there for contrast.

## Before you start

1. Open `/demo` (hidden page) → **Reset demo**. Set the invite delay (3 s is good on stage).
2. Use a normal window. A private window works too, but it forgets everything when closed.
3. If short on time: `/demo` → **Load demo profile** creates exactly the same Alex as steps 1–5 below. Then start at step 6.

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
- Click **Confirm all** → **Continue**.

### 3. Roommate search
- **Actively looking for a roommate**.
- **Major:** `Aerospace Engineering`. **Clubs:** type `MRacing` → **Add**.
- **U-M email:** `alexhtl@umich.edu`. Tick the consent box.
- *Optional:* first type `alex@gmail.com` and click Continue to show the validation errors.
- Click **Continue**.

### 4. About you
- The card **Where is MRacing?** → **Where is it?** → **Wilson Student Team Project Center** (suggested) → **A few times a week** → **Bike** (already selected) → **High**.
- *Optional:* open **How do I get this?** to show the Wolverine Access instructions. Don't upload a schedule.
- Click **Continue**.

### 5. Quick picks (3 questions; the quiet and cooking questions are skipped because the sentence answered them)
1. Which matters more day to day? → **More space at home**
2. If you had to pick one… → **Lower rent**
3. Your bedroom situation → **A room of my own**

This lands on the dashboard. Alex's weights are now affordability 30, commute 20, amenities 15, lifestyle 15, space 20.

### 6. Dashboard (solo)
"Recommended for you": **217 N Ashley St — 3BR Duplex (87)**, 1417 Broadway (70), State Street Village (82). Alone, Alex sees every size, priced per room.

### 7. Create a lobby
**Create a Lobby** → Group name `Engineering House`, **4 people** (default) → **Create Lobby**.
- Point out the **invite link** box (copy it to show the toast).
- **Invite** Jordan and Sam. They show "Invited · pending", then "Joined".

### 8. Explore with three people
**Find Homes Together**. Only 4-bedroom homes appear:
1. **1805 Fair St** — $699/person, **68**
2. **State Street Village** — $885/person, 61, red: **Over Sam's budget by $35**
3. Foundry Lofts — $1,149/person, 58, over Sam's (and Alex's) budget

### 9. Roommates
**Roommates** (top nav): **Riley — Great match · 95**, "Both on North Campus most weeks · Both want a quiet home".
- Click **Contact** to show Riley's email and phone.
- **Invite to lobby**. Riley joins after the delay.

### 10. Explore with all four
1. **1805 Fair St — 69** · $699/person. The cheapest home; Jordan is the least happy there (51: a 39-minute walk to Central).
2. **State Street Village — 64** · over Sam's budget by $35
3. **720 S Main St — 60** · over Sam's budget by $38

Open **1805 Fair St**. It shows "Main drawback: a 39-minute walk to Central Campus for Jordan", and each roommate's card scores the home separately: Alex 79, Jordan 51, Sam 90, Riley 79.

Optional: vote **Interested**. The home is saved automatically, and **Saved** shows it with a 👍 icon for Alex and empty circles for the others.

### 11. What if budgets changed?
Back on Explore → **What if budgets changed?** → drag **Sam** from $850 to **$950** (+$100).
On a laptop: click Sam's slider handle, then press **→** four times ($25 per press).

- **#1 State Street Village — 76** (was #2, blocked)
- #2 602 Mary Ct — 71 · #3 720 S Main St — 70 · Fair St drops to #4 (69)
- **What changed? → Why:** "State Street Village, 4BR Apartment became affordable for Sam, and it fits Jordan better on amenities (67 vs 33)."

Any value from **$900 to $1,100** gives the same #1, so the slider doesn't need to be exact. $875 is not enough. **Reset** puts Fair St back on top.

## Talking points
- **Separate scores:** the same home scores 51 for Jordan and 90 for Sam. The group score is 75% the average plus 25% the least-satisfied person, so nobody gets outvoted.
- **Blocked homes stay visible**, marked in red with the exact dollar gap, so the group sees what one budget change would unlock.
- **The matched roommate is explained**, not just ranked. Riley's card says why.

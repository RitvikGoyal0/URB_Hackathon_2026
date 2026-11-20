// Prints every stage of the stage walkthrough (docs/demo-walkthrough.md) from the real engine.
// Run: npx tsx scripts/demo-dump.ts
import { buildDemoProfile } from "../src/lib/demo-profile";
import { destinations, FRIEND_IDS, getDestination, getListing, listings, students } from "../src/lib/data";
import { diffRankings, explainListing, filterForLobby, rankRoommates } from "../src/lib/engine";
import { rankFor } from "../src/hooks/use-group";
import type { Lobby, MemberProfile, RankedResult } from "../src/lib/types";

const alex = buildDemoProfile();
const [jordan, sam] = FRIEND_IDS.map((id) => students.find((s) => s.id === id)!);
const cands = students.filter((s) => s.roommateStatus === "looking" && !FRIEND_IDS.includes(s.id));
const rr = rankRoommates(alex, cands, (id) => getDestination(id)?.shortName);
console.log("SUGGESTED ROOMMATES");
for (const r of rr) console.log(`  ${r.member.displayName.padEnd(7)} ${r.compat.score} ${r.compat.label.padEnd(15)} ${r.compat.reasons.join(" · ")}`);
const riley = rr[0].member;

const lobby = { targetSize: 4 } as Lobby;
const name = (ms: MemberProfile[], id: string) => ms.find((m) => m.id === id)!.displayName;
function show(label: string, ranked: RankedResult[], ms: MemberProfile[], n = 6) {
  console.log(`\n${label}`);
  for (const r of ranked.slice(0, n)) {
    const l = getListing(r.listingId)!;
    console.log(
      `  #${r.rank} ${l.name.slice(0, 44).padEnd(44)} group ${r.groupScore} ${r.eligibility}` +
        `\n      ${r.perMember.map((m) => `${name(ms, m.memberId)} ${m.score} ($${m.perPersonRent})`).join(" · ")}` +
        (r.blockers.length ? `\n      BLOCKED: ${r.blockers.map((b) => b.message).join(" | ")}` : ""),
    );
  }
}
show("SOLO (Alex only, all sizes)", rankFor(listings, [alex], null), [alex], 5);
const pool = filterForLobby(listings, 4);
const three = [alex, jordan, sam];
show("LOBBY: Alex + Jordan + Sam (4BR homes)", rankFor(pool, three, lobby), three, 5);
const four = [alex, jordan, sam, riley];
const before = rankFor(pool, four, lobby);
show("LOBBY: + Riley", before, four, 16);
const top = before[0];
const e = explainListing(top, getListing(top.listingId)!, four, destinations);
console.log("\nEXPLAIN #1:", JSON.stringify(e, null, 1));
for (const bump of [25, 50, 75, 100, 125, 150]) {
  const after4 = four.map((m) => (m.id === sam.id ? { ...m, budgetMax: sam.budgetMax + bump } : m));
  const after = rankFor(pool, after4, lobby);
  const d = diffRankings(before, after, { changedInputs: [`Sam's budget $${sam.budgetMax} → $${sam.budgetMax + bump}`], listings, members: after4 });
  console.log(`\nSAM +$${bump}: #1 ${after[0].listingId} (${after[0].groupScore}) #2 ${after[1].listingId} (${after[1].groupScore})`);
  if (bump === 100) {
    show("AFTER SAM +100", after, after4, 4);
    console.log("  WHY:", d.sentences.join(" "));
  }
}

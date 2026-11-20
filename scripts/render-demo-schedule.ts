// Renders Alex's example schedule (src/lib/demo-schedule.ts) as a Wolverine Access-style weekly
// grid → public/demo/alex-schedule.png, using headless Chrome. Then updates the cached hash.
// Run: npx tsx scripts/render-demo-schedule.ts
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEMO_SCHEDULE } from "../src/lib/demo-schedule";
import type { Weekday } from "../src/lib/types";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = join(process.cwd(), "public/demo/alex-schedule.png");

const DAYS: { key: Weekday; name: string; date: string }[] = [
  { key: "mon", name: "Monday", date: "Aug 31" },
  { key: "tue", name: "Tuesday", date: "Sep 1" },
  { key: "wed", name: "Wednesday", date: "Sep 2" },
  { key: "thu", name: "Thursday", date: "Sep 3" },
  { key: "fri", name: "Friday", date: "Sep 4" },
  { key: "sat", name: "Saturday", date: "Sep 5" },
  { key: "sun", name: "Sunday", date: "Sep 6" },
];
const FIRST = 7; // 7:00AM
const LAST = 18; // 6:00PM row
const HOUR = 104; // px per hour (tall enough for a 1-hour class, like the real grid)
const HEAD = 52;
const TIMEW = 110;
const COLW = 160;

const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h < 12 ? "AM" : "PM"}`;
};
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00${h < 12 ? "AM" : "PM"}`;

const width = TIMEW + COLW * DAYS.length;
const height = HEAD + HOUR * (LAST - FIRST + 1);
let body = "";
DAYS.forEach((d, i) => {
  body += `<div class="head" style="left:${TIMEW + i * COLW}px">${d.name}<br>${d.date}</div>`;
});
body += `<div class="head" style="left:0;width:${TIMEW}px">Time</div>`;
for (let h = FIRST; h <= LAST; h++) {
  const top = HEAD + (h - FIRST) * HOUR;
  body += `<div class="hour" style="top:${top}px"></div><div class="half" style="top:${top + HOUR / 2}px"></div>`;
  body += `<div class="tlabel" style="top:${top}px">${hourLabel(h)}</div>`;
}
for (let i = 0; i <= DAYS.length; i++) body += `<div class="vline" style="left:${TIMEW + i * COLW}px"></div>`;
for (const c of DEMO_SCHEDULE) {
  for (const day of c.days) {
    const col = DAYS.findIndex((d) => d.key === day);
    const top = HEAD + ((mins(c.start) - FIRST * 60) / 60) * HOUR;
    const h = ((mins(c.end) - mins(c.start)) / 60) * HOUR;
    body += `<div class="ev" style="left:${TIMEW + col * COLW + 1}px;top:${top + 1}px;height:${h - 1}px"><div>${c.name}<br>${c.kind}<br>${clock(c.start)} - ${clock(c.end)}<br>${c.building}</div></div>`;
  }
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#fff}
  #g{position:relative;width:${width}px;height:${height}px;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif;color:#111;overflow:hidden}
  .head{position:absolute;top:0;width:${COLW}px;height:${HEAD}px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:17px;line-height:1.25;border-bottom:1px solid #c9ccd6;background:#f7f7f7}
  .hour{position:absolute;left:0;right:0;border-top:1px solid #c9ccd6}
  .half{position:absolute;left:${TIMEW}px;right:0;border-top:1px solid #dfe1e8}
  .tlabel{position:absolute;left:4px;width:${TIMEW - 8}px;height:${HOUR}px;display:flex;align-items:center;font-size:17px}
  .vline{position:absolute;top:0;bottom:0;border-left:1px solid #c9ccd6}
  .ev{position:absolute;width:${COLW - 1}px;background:#c4d79b;display:flex;align-items:center;justify-content:center;text-align:center;font-size:16.5px;line-height:1.38;overflow:hidden;box-shadow:inset 0 0 0 1px #aebf86}
  .ev div{padding:0 4px}
</style></head><body><div id="g">${body}</div></body></html>`;

const dir = mkdtempSync(join(tmpdir(), "htl-schedule-"));
const page = join(dir, "schedule.html");
writeFileSync(page, html);
mkdirSync(join(process.cwd(), "public/demo"), { recursive: true });
execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${width},${height}`, `--screenshot=${OUT}`, `file://${page}`], { stdio: "ignore" });
const hash = createHash("sha256").update(readFileSync(OUT)).digest("hex");
const constFile = join(process.cwd(), "src/lib/demo-schedule.ts");
writeFileSync(constFile, readFileSync(constFile, "utf8").replace(/DEMO_SCHEDULE_IMAGE_SHA256 = "[^"]*"/, `DEMO_SCHEDULE_IMAGE_SHA256 = "${hash}"`));
console.log(`wrote ${OUT} (${width}×${height}) sha256=${hash}, updated src/lib/demo-schedule.ts`);

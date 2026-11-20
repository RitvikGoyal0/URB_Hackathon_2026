/**
 * Alex's example class schedule: the rows in the Wolverine Access-style screenshot at
 * public/demo/alex-schedule.png, written exactly as the screenshot shows them. Aerospace classes
 * are on North Campus (Mon/Wed/Fri, plus a Thursday lab); math and physics are on Central
 * (Tue/Thu), matching "North Campus four days a week and Central Campus twice a week".
 * Every building is one the app knows, so each row gets a suggested location.
 */
import type { DraftClass } from "./schedule-import";
import type { Weekday } from "./types";

export interface DemoClass {
  name: string;
  /** e.g. "Lecture", shown in the screenshot only */
  kind: string;
  days: Weekday[];
  start: string;
  end: string;
  building: string;
}

export const DEMO_SCHEDULE: DemoClass[] = [
  { name: "AEROSP 201 - 001", kind: "Lecture", days: ["mon", "wed"], start: "09:00", end: "10:30", building: "CHRYSLER CENTER 133" },
  { name: "MECHENG 211 - 002", kind: "Lecture", days: ["mon", "wed"], start: "10:30", end: "12:00", building: "G.G. BROWN LABORATORY 1504" },
  { name: "MATH 216 - 012", kind: "Lecture", days: ["tue", "thu"], start: "10:00", end: "11:30", building: "MASON HALL 1400" },
  { name: "PHYSICS 240 - 003", kind: "Discussion", days: ["tue"], start: "12:00", end: "13:00", building: "WEISER HALL 260" },
  { name: "AEROSP 201 - 011", kind: "Laboratory", days: ["thu"], start: "14:30", end: "16:30", building: "FORD MOTOR COMPANY ROBOTICS BUILDING 1010" },
  { name: "ENGR 151 - 004", kind: "Laboratory", days: ["fri"], start: "10:30", end: "12:30", building: "EECS 1311" },
];

/** SHA-256 of public/demo/alex-schedule.png (written by scripts/render-demo-schedule.ts). */
export const DEMO_SCHEDULE_IMAGE_SHA256 = "494158175b300a5fe230b34294f49f7ef538609df37487fab3dd5296380bd48c";

/** What reading the demo screenshot returns: the rows exactly as shown, nothing confirmed or located yet. */
export function demoScheduleRows(): DraftClass[] {
  return DEMO_SCHEDULE.map(({ name, days, start, end, building }) => ({ name, days: [...days], start, end, building, confirmed: false }));
}

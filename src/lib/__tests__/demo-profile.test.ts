import { describe, expect, it } from "vitest";
import { memberProfile, appState } from "@/lib/schemas";
import { DEFAULT_STATE } from "@/lib/store";
import { DEMO_CONTACT, buildDemoProfile, mracingPlace } from "@/lib/demo-profile";
import { unconfirmedCount } from "@/lib/onboarding";

describe("/demo → Load demo profile", () => {
  const p = buildDemoProfile();

  it("is a valid stored profile (the store would reset on an invalid one)", () => {
    expect(memberProfile.safeParse(p).success).toBe(true);
    expect(appState.safeParse({ ...DEFAULT_STATE, liveProfile: { ...p, id: "member_a", isLiveUser: true } }).success).toBe(true);
  });

  it("is fully confirmed, with MRacing at the Wilson Center as a place", () => {
    expect(unconfirmedCount(p)).toBe(0);
    expect(p.places).toEqual([mracingPlace()]);
    expect(p.places?.[0].location).toMatchObject({ source: "building", refId: "wilson_center" });
    expect(p.major).toBe("Engineering");
    expect(p.organizations).toEqual(["MRacing"]);
  });

  it("comes from the cached parse: budget from the sentence, North Campus, no car", () => {
    expect(p.budgetMax).toBe(1150);
    expect(p.destinations.some((d) => d.destinationId === "north_campus")).toBe(true);
    expect(p.hasCar).toBe(false);
  });

  it("is actively looking, with placeholder umich.edu contact and consent", () => {
    expect(p.roommateStatus).toBe("looking");
    expect(p.contact).toEqual(DEMO_CONTACT);
  });

  it("defaults to walking (no travel-mode question); a mode can still be passed", () => {
    expect(p.travelMode).toBe("walk");
    expect(buildDemoProfile("bus").travelMode).toBe("bus");
  });

  it("is deterministic", () => {
    expect(buildDemoProfile()).toEqual(p);
  });
});

import { describe, expect, it } from "vitest";
import { formatPhone, isValidEmail, isValidPhone, normalizePhone, validateContact, visibleContact } from "../contact";
import { contactInfo, memberProfile } from "../schemas";
import { students } from "../data";
import { applyRoommateSearch } from "@/components/profile/roommate-search-fields";
import { defaultLivePersona } from "../data";
import { defaultTravelMode } from "../onboarding";
import type { ProfileParse } from "../types";

describe("contact validation", () => {
  it("accepts only @umich.edu emails", () => {
    expect(isValidEmail("Riley@UMich.edu ")).toBe(true);
    expect(isValidEmail("riley@gmail.com")).toBe(false);
    expect(isValidEmail("riley@umich.edu.evil.com")).toBe(false);
    expect(isValidEmail("@umich.edu")).toBe(false);
  });
  it("accepts 10-digit US phones and formats them", () => {
    expect(isValidPhone("(734) 555-0123")).toBe(true);
    expect(isValidPhone("+1 734 555 0123")).toBe(true);
    expect(normalizePhone("+1 734 555 0123")).toBe("7345550123");
    expect(isValidPhone("555-0123")).toBe(false);
    expect(formatPhone("7345550123")).toBe("(734) 555-0123");
  });
  it("needs one valid method plus the consent box", () => {
    expect(validateContact({ email: "", phone: "", consent: true }).contact).toBeTruthy();
    expect(validateContact({ email: "a@umich.edu", phone: "", consent: false }).consent).toBeTruthy();
    expect(validateContact({ email: "a@gmail.com", phone: "", consent: true }).email).toBeTruthy();
    expect(validateContact({ email: "", phone: "7345550123", consent: true })).toEqual({});
  });
  it("stored contact must be valid and non-empty", () => {
    expect(contactInfo.safeParse({ email: "a@umich.edu", consentAt: "x" }).success).toBe(true);
    expect(contactInfo.safeParse({ email: "a@gmail.com", consentAt: "x" }).success).toBe(false);
    expect(contactInfo.safeParse({ consentAt: "x" }).success).toBe(false);
  });
});

describe("roommate search on a profile", () => {
  it("looking saves normalized contact; found clears it", () => {
    const looking = applyRoommateSearch(defaultLivePersona, "looking", { email: " Maya@UMICH.edu", phone: "(734) 555-0100", consent: true }, "T");
    expect(looking.roommateStatus).toBe("looking");
    expect(looking.contact).toEqual({ email: "maya@umich.edu", phone: "7345550100", consentAt: "T" });
    expect(memberProfile.safeParse(looking).success).toBe(true);
    expect(visibleContact(looking)).toEqual({ email: "maya@umich.edu", phone: "7345550100" });
    const found = applyRoommateSearch(looking, "found", { email: "maya@umich.edu", phone: "", consent: true });
    expect(found.contact).toBeNull();
    expect(visibleContact(found)).toBeNull();
  });
  it("every seeded student is looking, with valid contact", () => {
    for (const s of students) {
      expect(s.roommateStatus).toBe("looking");
      expect(memberProfile.safeParse(s).success).toBe(true);
      expect(visibleContact(s)).not.toBeNull();
    }
  });
});

describe("travel mode default (no follow-up question)", () => {
  const base = { destinations: [], lifestyle: {}, requirements: {}, desiredAmenities: [], unmappedPlaces: [], missing: [] } as ProfileParse;
  it("ambiguous → walk, unless bike was mentioned; an explicit mode wins", () => {
    expect(defaultTravelMode({ ...base, travelModeOptions: ["bus", "walk"] })).toBe("walk");
    expect(defaultTravelMode({ ...base, travelModeOptions: ["bus", "bike"] })).toBe("bike");
    expect(defaultTravelMode({ ...base, missing: ["travelMode"] })).toBe("walk");
    expect(defaultTravelMode({ ...base, travelMode: { value: "bus", sourceText: "bus", confidence: 0.9 } })).toBe("bus");
  });
});

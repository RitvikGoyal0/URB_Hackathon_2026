import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = { title: "Tell us about your week" };

export default function OnboardingPage() {
  return (
    <main className="w-full px-4 py-10 sm:px-6 sm:py-14">
      <OnboardingFlow />
    </main>
  );
}

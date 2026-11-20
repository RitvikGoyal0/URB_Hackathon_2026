"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Check, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { defaultLivePersona, destinations as allDestinations, getDestination } from "@/lib/data";
import {
  EXAMPLE_PROMPTS,
  addDestination,
  applyThisOrThatAnswer,
  buildFollowUps,
  neutralProfile,
  parseToProfile,
  selectThisOrThat,
  setBudget,
  unconfirmedCount,
  type FollowUp,
  type ThisOrThatAnswer,
} from "@/lib/onboarding";
import { actions } from "@/lib/store";
import type { MemberProfile, ParseResponse, ProfileParse, RoommateStatus } from "@/lib/types";
import { AboutFields, ProfileEditor, WeightBars } from "@/components/profile/profile-editor";
import { ContactFields, StatusChoice, applyRoommateSearch, validateContact } from "@/components/profile/roommate-search-fields";
import type { ContactDraft } from "@/lib/contact";
import { searchBuildings } from "@/lib/places";
import { ScheduleSection } from "@/components/profile/schedule-section";
import { PlacesSection, type PlaceSuggestion } from "@/components/places/place-wizard";

type Step = "write" | "review" | "public" | "about" | "questions";

async function requestParse(text: string): Promise<ParseResponse> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch("/api/profile/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, campusId: "umich" }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json = (await res.json()) as ParseResponse;
    if (!json || typeof json !== "object" || !("ok" in json)) return { ok: false, error: "Malformed response" };
    return json;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

const STEPS: { id: Step; label: string }[] = [
  { id: "write", label: "Your week" },
  { id: "review", label: "Check it" },
  { id: "public", label: "Roommate search" },
  { id: "about", label: "About you" },
  { id: "questions", label: "Quick picks" },
];

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStepRaw] = useState<Step>("write");
  const setStep = (s: Step) => {
    setStepRaw(s);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [text, setText] = useState("");
  const [name, setName] = useState(defaultLivePersona.displayName);
  const [budgetInput, setBudgetInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parse, setParse] = useState<ProfileParse | null>(null);
  const [profile, setProfile] = useState<MemberProfile>(() => neutralProfile(defaultLivePersona));
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [answered, setAnswered] = useState<Record<string, string>>({});
  const [qIndex, setQIndex] = useState(0);
  const [qLog, setQLog] = useState<string[]>([]);
  const [status, setStatus] = useState<RoommateStatus | null>(null);
  const [contactDraft, setContactDraft] = useState<ContactDraft>({ email: "", phone: "", consent: false });
  const [showContactErrors, setShowContactErrors] = useState(false);
  const contactErrors = validateContact(contactDraft);
  const contactOk = Object.keys(contactErrors).length === 0;

  function continueFromPublic() {
    if (!status) return;
    if (status === "looking" && !contactOk) {
      setShowContactErrors(true);
      return;
    }
    setProfile((p) => applyRoommateSearch(p, status, contactDraft));
    setStep("about");
  }

  const thisOrThat = selectThisOrThat(parse);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) {
      toast("Write a sentence or two first, or pick an example.");
      return;
    }
    setLoading(true);
    const typedBudget = Number(budgetInput.replace(/[^0-9.]/g, ""));
    const hasTypedBudget = Number.isFinite(typedBudget) && typedBudget > 0;
    let base = neutralProfile(defaultLivePersona, name);
    base = { ...base, bio: trimmed.slice(0, 280) };
    const res = await requestParse(trimmed);
    setLoading(false);
    let next: MemberProfile;
    if (res.ok) {
      next = parseToProfile(res.parse, base);
      setParse(res.parse);
      setFollowUps(buildFollowUps(res.parse, { budgetProvided: hasTypedBudget }));
    } else {
      next = base;
      setParse(null);
      setFollowUps([]);
      toast.error("Couldn't auto-read that — fill in the basics.");
    }
    if (hasTypedBudget) next = setBudget(next, typedBudget, "budget field");
    setAnswered({});
    setProfile(next);
    setStep("review");
  }

  function answerFollowUp(f: FollowUp, label: string, apply: (p: MemberProfile) => MemberProfile) {
    setProfile((p) => apply(p));
    setAnswered((a) => ({ ...a, [f.id]: label }));
  }

  function answerQuestion(answer: ThisOrThatAnswer) {
    const q = thisOrThat.ask[qIndex];
    if (!q) return;
    setProfile((p) => applyThisOrThatAnswer(p, q, answer));
    const said = answer === "a" ? q.a.label : answer === "b" ? q.b.label : answer === "either" ? "Either" : "Skipped";
    setQLog((l) => [...l, `${q.prompt} ${said}`]);
    if (qIndex + 1 >= thisOrThat.ask.length) finish(applyThisOrThatAnswer(profile, q, answer));
    else setQIndex((i) => i + 1);
  }

  function finish(p: MemberProfile = profile) {
    const clean = { ...p, displayName: p.displayName.trim() || defaultLivePersona.displayName };
    actions.setLiveProfile(clean);
    const pending = unconfirmedCount(clean);
    toast.success(
      pending > 0
        ? `Profile saved. ${pending} unconfirmed detail${pending === 1 ? "" : "s"} won't count until you confirm them in Profile.`
        : "Profile saved. Meet your group.",
    );
    router.push("/dashboard");
  }

  const openFollowUps = followUps.filter((f) => !answered[f.id]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => {
          const idx = STEPS.findIndex((x) => x.id === step);
          const state = i < idx ? "done" : i === idx ? "current" : "todo";
          return (
            <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold",
                  state === "done" && "bg-teal text-white",
                  state === "current" && "bg-ink text-paper",
                  state === "todo" && "bg-secondary text-muted-foreground",
                )}
                aria-current={state === "current" ? "step" : undefined}
              >
                {state === "done" ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={cn("min-w-0 truncate text-[13px] font-medium", state === "todo" ? "text-muted-foreground" : "text-ink", state !== "current" && "max-[379px]:sr-only")}>{s.label}</span>
              {i < STEPS.length - 1 && <span className="mx-1 hidden h-px flex-1 bg-line sm:block" aria-hidden />}
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        {step === "write" && (
          <motion.section
            key="write"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-[2.2rem] leading-[1.05] font-semibold text-ink sm:text-[2.8rem]">Tell us what your life looks like</h1>
            <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">
              Where you go during the week, how you get around, how you like to live, and what you can spend. We&apos;ll turn it into
              details you can check, and we only map places to known campus spots.
            </p>
            <div className="mt-7 rounded-[28px] border border-line bg-white p-3 shadow-[0_24px_60px_-48px_rgba(20,33,61,0.6)]">
              <label htmlFor="ob-text" className="sr-only">
                Describe your week
              </label>
              <Textarea
                id="ob-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={2000}
                placeholder="I'm on North Campus most weekdays, I don't have a car…"
                className="min-h-40 resize-y rounded-[20px] border-0 bg-transparent px-3 py-3 text-[16px] leading-relaxed shadow-none focus-visible:ring-0"
              />
              <div className="flex flex-wrap gap-2 border-t border-line px-2 pt-3">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => setText(ex.text)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none",
                      text === ex.text ? "border-teal bg-teal-soft text-teal" : "border-line bg-paper text-charcoal hover:border-ink/30",
                    )}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ob-name" className="text-[13px] font-medium text-charcoal">
                  Your first name
                </label>
                <Input id="ob-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11 rounded-xl bg-white" />
              </div>
              <div>
                <label htmlFor="ob-budget" className="text-[13px] font-medium text-charcoal">
                  Monthly budget <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="ob-budget"
                    inputMode="numeric"
                    placeholder="1,150"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    className="h-11 rounded-xl bg-white pl-7"
                  />
                </div>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button className="h-12 rounded-full px-6 text-[15px]" onClick={submit} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                {loading ? "Reading your week…" : "Read my week"}
              </Button>
              <Button
                variant="ghost"
                className="h-12 rounded-full px-4"
                onClick={() => {
                  setParse(null);
                  setFollowUps([]);
                  setProfile(neutralProfile(defaultLivePersona, name));
                  setStep("review");
                }}
              >
                Fill it in myself
              </Button>
            </div>
            <p className="mt-4 text-[12.5px] text-muted-foreground">
              Your text is sent once to our parser and isn&apos;t stored on a server. Your profile lives in this browser only.
            </p>
          </motion.section>
        )}

        {step === "review" && (
          <motion.section
            key="review"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-[2.1rem] leading-[1.05] font-semibold text-ink sm:text-[2.6rem]">Here&apos;s what we learned about you</h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              {parse
                ? "Each detail shows the words it came from. Confirm what's right, fix what isn't. Only confirmed details are used to score homes."
                : "Fill in the basics. You can change any of this later from your profile."}
            </p>

            {openFollowUps.length > 0 && (
              <div className="mt-6 grid gap-3">
                {openFollowUps.map((f) => (
                  <FollowUpCard key={f.id} f={f} onAnswer={(label, apply) => answerFollowUp(f, label, apply)} />
                ))}
              </div>
            )}
            {Object.keys(answered).length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {followUps
                  .filter((f) => answered[f.id])
                  .map((f) => (
                    <li key={f.id} className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft px-3 py-1 text-[12.5px] text-teal">
                      <Check className="size-3.5" aria-hidden /> {f.question} {answered[f.id]}
                    </li>
                  ))}
              </ul>
            )}

            <div className="mt-6">
              <ProfileEditor profile={profile} onChange={setProfile} showName={false} showPlaces={false} />
            </div>

            <div className="sticky bottom-3 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-full border border-line bg-white/95 p-2 pl-4 shadow-lg backdrop-blur">
              <Button variant="ghost" className="rounded-full" onClick={() => setStep("write")}>
                <ArrowLeft aria-hidden /> Back
              </Button>
              <div className="flex items-center gap-2">
                <span className="hidden text-[12.5px] text-muted-foreground sm:inline">
                  {unconfirmedCount(profile) > 0 ? `${unconfirmedCount(profile)} unconfirmed` : "All details confirmed"}
                </span>
                <Button className="h-10 rounded-full px-5" onClick={() => setStep("public")}>
                  Continue <ArrowRight aria-hidden />
                </Button>
              </div>
            </div>
          </motion.section>
        )}

        {step === "public" && (
          <motion.section
            key="public"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-[2.1rem] leading-[1.05] font-semibold text-ink sm:text-[2.6rem]">Are you looking for a roommate?</h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Students who are looking show up in each other&apos;s roommate suggestions. Either way, you can browse students and reach out.
            </p>
            <div className="mt-6">
              <StatusChoice value={status} onChange={setStatus} />
            </div>
            {status && (
              <div className="mt-6 grid gap-4">
                <div>
                  <h2 className="text-[19px] font-semibold text-ink">Your public profile</h2>
                  <p className="mt-1 text-[13.5px] text-muted-foreground">
                    {status === "looking"
                      ? "What other students see on your card. Your major and clubs also help us suggest roommates with similar weeks."
                      : "Your major and clubs help us suggest students with similar weeks."}
                  </p>
                </div>
                <AboutFields profile={profile} onChange={setProfile} />
                {status === "looking" && (
                  <ContactFields draft={contactDraft} onChange={setContactDraft} errors={contactErrors} showErrors={showContactErrors} />
                )}
              </div>
            )}
            <div className="sticky bottom-3 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-full border border-line bg-white/95 p-2 pl-4 shadow-lg backdrop-blur">
              <Button variant="ghost" className="rounded-full" onClick={() => setStep("review")}>
                <ArrowLeft aria-hidden /> Back
              </Button>
              <Button className="h-10 rounded-full px-5" onClick={continueFromPublic} disabled={!status || (status === "looking" && showContactErrors && !contactOk)}>
                Continue <ArrowRight aria-hidden />
              </Button>
            </div>
          </motion.section>
        )}

        {step === "about" && (
          <motion.section
            key="about"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-[2.1rem] leading-[1.05] font-semibold text-ink sm:text-[2.6rem]">About you</h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Add the places you go often so commutes count them.
            </p>
            <div className="mt-6">
              <AboutAndPlaces profile={profile} onChange={setProfile} />
            </div>
            <div className="sticky bottom-3 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-full border border-line bg-white/95 p-2 pl-4 shadow-lg backdrop-blur">
              <Button variant="ghost" className="rounded-full" onClick={() => setStep("public")}>
                <ArrowLeft aria-hidden /> Back
              </Button>
              <Button
                className="h-10 rounded-full px-5"
                onClick={() => {
                  setQIndex(0);
                  setQLog([]);
                  if (thisOrThat.ask.length === 0) finish();
                  else setStep("questions");
                }}
              >
                Continue <ArrowRight aria-hidden />
              </Button>
            </div>
          </motion.section>
        )}

        {step === "questions" && (
          <motion.section
            key="questions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ThisOrThatStep
              index={qIndex}
              total={thisOrThat.ask.length}
              question={thisOrThat.ask[qIndex]}
              skipped={thisOrThat.skipped}
              onAnswer={answerQuestion}
              onFinishEarly={() => finish()}
              onBack={() => setStep("review")}
              weights={profile.weights}
              log={qLog}
            />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function FollowUpCard({ f, onAnswer }: { f: FollowUp; onAnswer: (label: string, apply: (p: MemberProfile) => MemberProfile) => void }) {
  const [budget, setBudgetValue] = useState("");
  const [other, setOther] = useState("");
  return (
    <div className="rounded-[22px] border-2 border-ink bg-white p-4 sm:p-5">
      <p className="text-[12.5px] font-medium text-teal">Quick question</p>
      <h2 className="mt-1 text-[19px] font-semibold text-ink">{f.question}</h2>
      {f.kind === "place" && (
        <>
          <p className="mt-1 text-[13px] text-muted-foreground">
            You mentioned &ldquo;{f.placeText}&rdquo;. We only store the place, not the club or activity.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {f.suggestedDestinationId && getDestination(f.suggestedDestinationId) && (
              <Button
                className="rounded-full"
                onClick={() =>
                  onAnswer(getDestination(f.suggestedDestinationId!)!.shortName, (p) => addDestination(p, f.suggestedDestinationId!, 2, f.placeText))
                }
              >
                {getDestination(f.suggestedDestinationId)!.shortName}
              </Button>
            )}
            <select
              aria-label="Pick another place"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              className="h-8 rounded-full border border-line bg-white px-3 text-[13px]"
            >
              <option value="">Somewhere else…</option>
              {allDestinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {other && (
              <Button variant="outline" className="rounded-full" onClick={() => onAnswer(getDestination(other)!.shortName, (p) => addDestination(p, other, 2, f.placeText))}>
                Use {getDestination(other)?.shortName}
              </Button>
            )}
            <Button variant="ghost" className="rounded-full text-muted-foreground" onClick={() => onAnswer("Left out", (p) => p)}>
              Leave it out
            </Button>
          </div>
        </>
      )}
      {f.kind === "budget" && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(budget.replace(/[^0-9.]/g, ""));
            if (v > 0) onAnswer(`$${Math.round(v).toLocaleString()}`, (p) => setBudget(p, v));
          }}
        >
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
            <Input aria-label="Monthly budget" inputMode="numeric" value={budget} onChange={(e) => setBudgetValue(e.target.value)} className="h-9 w-32 rounded-full bg-white pl-7" />
          </div>
          <Button type="submit" className="rounded-full">
            Save budget
          </Button>
        </form>
      )}
      {f.kind === "destinations" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {allDestinations.slice(0, 5).map((d) => (
            <Button
              key={d.id}
              variant="outline"
              className="rounded-full"
              onClick={() => onAnswer(d.shortName, (p) => addDestination(p, d.id, 4))}
            >
              {d.shortName}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThisOrThatStep({
  index,
  total,
  question,
  skipped,
  onAnswer,
  onFinishEarly,
  onBack,
  weights,
  log,
}: {
  index: number;
  total: number;
  question: ReturnType<typeof selectThisOrThat>["ask"][number] | undefined;
  skipped: ReturnType<typeof selectThisOrThat>["skipped"];
  onAnswer: (a: ThisOrThatAnswer) => void;
  onFinishEarly: () => void;
  onBack: () => void;
  weights: MemberProfile["weights"];
  log: string[];
}) {
  if (!question) return null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">
          Question {index + 1} of {total}
        </p>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onFinishEarly}>
          Finish and meet my group
        </Button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-teal transition-[width] duration-300" style={{ width: `${(index / total) * 100}%` }} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={question.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
          <h1 className="mt-8 text-[2rem] leading-tight font-semibold text-ink sm:text-[2.4rem]">{question.prompt}</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
            {(["a", "b"] as const).map((side, i) => {
              const o = question[side];
              return (
                <div key={side} className={cn("contents")}>
                  {i === 1 && (
                    <span className="flex items-center justify-center font-display text-[15px] font-semibold text-muted-foreground" aria-hidden>
                      or
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onAnswer(side)}
                    className="group rounded-[26px] border border-line bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-ink focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none"
                  >
                    <span className="block font-display text-[22px] leading-tight font-semibold text-ink">{o.label}</span>
                    <span className="mt-2 block text-[14px] text-muted-foreground">{o.hint}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full px-5" onClick={() => onAnswer("either")}>
              Either is fine
            </Button>
            <Button variant="ghost" className="rounded-full px-4" onClick={() => onAnswer("skip")}>
              Skip
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[13px] font-medium text-charcoal">Your weights so far</p>
          <WeightBars weights={weights} />
        </div>
        <div className="text-[13px] text-muted-foreground">
          {skipped.length > 0 && (
            <>
              <p className="mb-2 font-medium text-charcoal">Already answered by what you wrote</p>
              <ul className="grid gap-1.5">
                {skipped.map((s) => (
                  <li key={s.q.id} className="rounded-xl bg-white px-3 py-2">
                    {s.q.prompt.replace(/…$/, "")}: &ldquo;{s.because}&rdquo;
                  </li>
                ))}
              </ul>
            </>
          )}
          {log.length > 0 && (
            <ul className="mt-3 grid gap-1">
              {log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Button variant="ghost" className="mt-6 rounded-full" onClick={onBack}>
        <ArrowLeft aria-hidden /> Back to details
      </Button>
    </div>
  );
}

/** Onboarding "About you": "Where is <club>?" for clubs from Roommate search, then places + schedule. */
function AboutAndPlaces({ profile, onChange }: { profile: MemberProfile; onChange: (p: MemberProfile) => void }) {
  const [start, setStart] = useState<{ name: string; suggestion?: PlaceSuggestion } | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const placeNames = new Set((profile.places ?? []).map((p) => p.name.toLowerCase()));
  const askClubs = (profile.organizations ?? []).filter((o) => !placeNames.has(o.toLowerCase()) && !dismissed.includes(o));
  return (
    <div className="grid gap-4">
      {askClubs.length > 0 && (
        <ul className="grid gap-3">
          {askClubs.map((club) => (
            <li key={club} className="rounded-[22px] border-2 border-ink bg-white p-4 sm:p-5">
              <p className="text-[12.5px] font-medium text-teal">From your clubs</p>
              <h2 className="mt-1 text-[19px] font-semibold text-ink">Where is {club}?</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">If you go regularly, add where it meets so your commute counts it.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  className="rounded-full"
                  onClick={() => {
                    const b = searchBuildings(club, 1)[0];
                    setStart({ name: club, suggestion: b ? { buildingId: b.id } : undefined });
                    setDismissed((d) => [...d, club]);
                  }}
                >
                  <MapPin aria-hidden /> Where is it?
                </Button>
                <Button variant="ghost" className="rounded-full text-muted-foreground" onClick={() => setDismissed((d) => [...d, club])}>
                  I don&apos;t go regularly
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <section className="rounded-[26px] border border-line bg-paper/60 p-4 sm:p-5">
        <h3 className="text-[17px] font-semibold text-ink">Places you go often</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">A club, a job, a gym. Pick where it is yourself; we never guess a location.</p>
        <div className="mt-3.5">
          <PlacesSection profile={profile} onChange={onChange} start={start} />
        </div>
      </section>
      <section className="rounded-[26px] border border-line bg-paper/60 p-4 sm:p-5">
        <h3 className="text-[17px] font-semibold text-ink">
          Upload your schedule <span className="text-[13px] font-normal text-muted-foreground">(optional)</span>
        </h3>
        <div className="mt-3.5">
          <ScheduleSection profile={profile} onChange={onChange} />
        </div>
      </section>
    </div>
  );
}

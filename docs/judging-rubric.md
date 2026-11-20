# Hack the Lease 2026 — Judging rubric

Transcribed from the printed case study (section 08), 2026-11-20.

> Judges will evaluate what your team demonstrates, not projected features. The rubric rewards technical substance, thoughtful product strategy, credible decision support, and effective design.

| Dimension | Weight | What judges evaluate |
|---|---|---|
| Technical execution | 35% | Does the solution work? Is there substantive engineering or analytical implementation? Are the technical methods appropriate and explainable? |
| Student value & product strategy | 30% | How well does the team define the apartment-decision problem, address meaningful student needs, and make deliberate choices about scope, features, and trade-offs? No single student archetype is required. |
| Decision quality & evidence | 20% | Can the team explain how outcomes are produced, support important claims with appropriate data or explicit assumptions, and acknowledge uncertainty? |
| Product experience & creativity | 15% | Can a student understand and use the solution? Is the experience coherent, thoughtful, and inventive in ways that serve the housing decision? |

## How the MVP spec maps to it

| Dimension | Spec features that earn it | Implication |
|---|---|---|
| Technical execution (35%) | Deterministic scoring engine (§7), rent-basis logic, OSRM commute matrix, Zod-validated Gemini parse, Vitest suite incl. demo-flip test | Everything shown must work live; engine must be explainable (no black box). Tests are evidence. |
| Student value & strategy (30%) | Group-of-4 problem framing (§1), explicit cuts list (§0), per-member trade-offs | Pitch the *why* of scope cuts; ground the problem in research (`reports/Student housing search pain points.md`). |
| Decision quality & evidence (20%) | Source/provenance badges, "unknown ≠ 0", coverage badges, mean/min breakdown, "What changed?" diff, known-limitations list (§14) | Show the formula on screen; label every assumption; say the limitations out loud. |
| Experience & creativity (15%) | Free-text onboarding, this-or-that, what-if slider, voting/consensus | Coherent single journey; no dead buttons. |

# Onboarding GeneralFlow Slice 1 (AU individual) Design

**Date:** 2026-06-15
**Status:** Approved (pending written-spec review)
**Sub-project:** Onboarding 2b, slice 2 — the GeneralFlow runner + appropriateness scoring + the AU individual (CFD) jurisdiction

## Context

Portal 3.0 onboarding (sub-project 2b) was started in slice 1: a config-driven step
engine (`StepField` + pure step machine with `shouldDisplay`/`beforeSubmit` hooks),
a Zustand working-application store, the onboarding API/queries, and the **SimplifiedFlow**
wired at `/onboarding` for an authenticated user. That is complete and on `main`.

The legacy `GeneralFlow` is the richer onboarding path: per-jurisdiction step lists
for ~11 entities (AU, UK, TMCY/EU, TMJP, TFSA, …), backend-driven dynamic questions,
**appropriateness scoring** (PASS/FAIL, with REFER bands for some entities), conditional
steps, corporate and Cash-Equities variants, failure/refer pages, and an
appropriateness retake flow. The engine built in slice 1 already supports the hooks
GeneralFlow needs.

GeneralFlow is too large for one slice. **This spec covers GeneralFlow slice 1:**
the GeneralFlow runner, the appropriateness-scoring engine, the new shared steps, and
the **AU individual (CFD)** jurisdiction end to end. Additional jurisdictions,
corporate/CE variants, and the retake flow are later slices.

## Goal

For an authenticated AU individual applicant, run the full GeneralFlow at `/onboarding`:
resume an incomplete application, collect personal/contact/financial details, complete
the appropriateness assessment (KOQ + dynamic backend questions), compute PASS/FAIL from
the answer scores, and either submit to completion (→ `PENDING_KYC` hand-off stub) or
render the AU failure page on FAIL. The runner and scoring engine are built so further
jurisdictions are added as configuration in later slices.

## Scope

**In scope:**

- A `GeneralFlow` runner: single jurisdiction step-list, dynamic-question appending,
  `beforeSubmit` hook execution, incremental submit per step, and failure detection.
- A pure appropriateness-**scoring** engine (`getUserAnswers`, `scoreAssessment`).
- New shared steps: employment status, employer info (conditional), source of funds,
  annual income, savings, appropriateness intro.
- The **AU individual CFD** jurisdiction config (KOQ + dynamic questions, PASS/FAIL at
  score ≥ 8) and its failure page.
- Flow selection: `selectFlow(app)` chooses SimplifiedFlow vs GeneralFlow(AU) by the
  application's jurisdiction/domain.

**Out of scope (deferred):**

- Other jurisdictions (UK, TMCY/EU, TMJP, TFSA, TMNZ, TMSY, TMLC) — later slices.
- REFER bands (AU is binary PASS/FAIL).
- Corporate and Cash-Equities (ASX) variants.
- The appropriateness retake flow (`PENDING_APPROPRIATENESS_TEST` second attempt,
  answer-stripping, cooldown).
- The legacy tile-grid assessment UI (the radio `QuestionStep` is reused; tile UI is a
  cosmetic follow-up).
- Registration, KYC document upload (2c), address lookup.

## Decisions (confirmed)

| Area                      | Decision                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| First jurisdiction        | AU individual (CFD): binary PASS/FAIL at score ≥ 8, no REFER band                                                                                |
| Corporate / Cash-Equities | Deferred                                                                                                                                         |
| Retake flow               | Deferred                                                                                                                                         |
| Runner                    | `GeneralFlow` reuses the engine; one step list; `incrementalSubmit` per step (`completed: true` on the last); failure detection on submit result |
| Scoring                   | Pure `engine/scoring.ts`; the last assessment step's `beforeSubmit` sets `appropriatenessLevel`                                                  |
| Assessment UI             | Reuse the existing radio `QuestionStep` (score lives on the answer)                                                                              |
| Flow selection            | `selectFlow(app)` by jurisdiction/domain on the loaded application                                                                               |
| Forms                     | React Hook Form + Zod, Foundation primitives                                                                                                     |
| Folder                    | `src/features/onboarding/flows/general/` + new `steps/`                                                                                          |

## Architecture

### File structure

```
src/features/onboarding/
  engine/
    scoring.ts                 (getUserAnswers, scoreAssessment — pure)
    scoring.test.ts
  flows/
    general/
      GeneralFlow.tsx          (the runner)
      GeneralFlow.test.tsx
      jurisdictions/au.ts      (buildAuSteps(questions) -> StepField[])
      AppFailed.tsx            (AU failure page)
  steps/
    EmploymentStatusStep.tsx, EmployerInfoStep.tsx, SourceOfFundsStep.tsx,
    AnnualIncomeStep.tsx, SavingsStep.tsx, AppropriatenessIntroStep.tsx   (+ tests where logic warrants)
  flowSelection.ts             (selectFlow(app))
  OnboardingScreen.tsx         (modified: use selectFlow)
```

The slice-1 engine, store, API/queries, SimplifiedFlow, and shared L1/L2 steps are
unchanged. The new shared steps extend the existing `steps/` directory.

### Scoring engine (`engine/scoring.ts`, pure)

- `getUserAnswers(questions, details)` returns, per answered question label,
  `{ answerId, answerLabel, score }` by matching `details[].answer` to the question's
  `answers[].id` and reading that answer's `score`.
- `scoreAssessment(questions, details, labels)` sums the scores for the given assessment
  question labels.
  These are pure (no React/network) and unit-tested. The AU config's final assessment step
  uses them in a `beforeSubmit` hook:
  `draft.appropriatenessLevel = scoreAssessment(...) >= AU_PASS_THRESHOLD ? 'PASS' : 'FAIL'`
  (`AU_PASS_THRESHOLD = 8`).

### GeneralFlow runner (`flows/general/GeneralFlow.tsx`)

Takes a built `StepField[]` (from the jurisdiction config). Drives the engine
(`getStartingStep`/`getNextStep`/`getPreviousStep`) over the single list. On `advance`:

1. If the step has `beforeSubmit`, run it and merge the result into the draft.
2. Submit via `incrementalSubmit` (`application_submit`), adding `completed: true` when
   the step `isLast`.
3. **Failure detection:** if the response status is not in the continue-set
   (`INCOMPLETE`, `PENDING_APPROPRIATENESS_TEST`) **or** `draft.appropriatenessLevel === 'FAIL'`,
   render the jurisdiction's `isFailure` step component (the AU failure page).
4. On the last step's successful completion, invalidate `['application']` so
   `OnboardingScreen` re-reads status and routes to the `PENDING_KYC` hand-off stub.
5. Otherwise advance to the next step.
   Errors surface via `notificationStore` (no silent data loss), consistent with SimplifiedFlow.

### New shared steps

RHF + Zod forms following the slice-1 step pattern (read/write the Zustand draft, call
`onNext`):

- **EmploymentStatusStep** — `accountHolderEmploymentStatus` / `employmentStatus` (select).
- **EmployerInfoStep** — `occupation`, `industry`, `employerName`; `shouldDisplay` only
  when employment is Employed or Self-employed.
- **SourceOfFundsStep** — `sourceOfFunds` (AU multi-choice).
- **AnnualIncomeStep** — `approximateIncomeValue` (select).
- **SavingsStep** — `estimatedNetWorth` (select).
- **AppropriatenessIntroStep** — intro copy plus the KOQ-hardship gate question.
- **Assessment questions** reuse the existing `QuestionStep` (radio); the answer carries
  its score, so scoring is entirely in the `beforeSubmit` hook.

### AU jurisdiction config (`flows/general/jurisdictions/au.ts`)

`buildAuSteps(questions: Question[]): StepField[]` returns the ordered list:
personal → phone → platform → address → employment → employer (conditional) →
source of funds → annual income → savings → appropriateness intro (KOQ-hardship) →
the 7 mandatory KOQ assessment questions → the backend's non-mandatory (additional)
questions appended as `QuestionStep`s (the **last** carrying the scoring `beforeSubmit`
over all assessment labels) → terms (`isLast`) → failure (`isFailure`). The AU question
label constants come from the legacy `questions.ts` AU enum (extracted at planning).

### Flow selection (`flowSelection.ts`)

`selectFlow(app)` returns the flow to render from the application's jurisdiction/domain
(legacy `portalAccountDomain` / `isSimplifyOnboarding`): simplified domains →
`SimplifiedFlow`; AU → `GeneralFlow` with `buildAuSteps`. Unsupported jurisdictions render
a clear "not yet available" message. `OnboardingScreen` calls `selectFlow` instead of
always rendering Simplified. The exact domain field name is confirmed at planning.

## Error handling

- Per-step submit failure → notification, stay on step (draft preserved).
- Appropriateness FAIL or a terminal backend status → the jurisdiction failure page.
- Envelope-level non-OK status is thrown by the API layer (`unwrap`) and surfaced as a
  notification (consistent with slice 1's M-4 fix).

## Testing

- **Unit:** the scoring engine (`getUserAnswers`, `scoreAssessment`, PASS at ≥8, FAIL
  below); `selectFlow`; conditional `shouldDisplay` for employer info.
- **Component:** the new step forms (validation + draft writes).
- **Integration:** the GeneralFlow runner over the AU config — a PASS answer set reaches
  the terminal submit; a FAIL answer set renders the failure page; the conditional
  employer step is skipped when not employed.
- **E2E (Playwright):** the AU flow happy path (login → onboarding → GeneralFlow → PASS →
  `PENDING_KYC` stub) and a FAIL path (→ failure page), with intercepted endpoints.

## Compliance

The appropriateness scoring is regulatory logic. The score→PASS/FAIL computation is pure
and unit-tested. Per the slice-1 follow-up, whether the backend re-derives appropriateness
from the submitted answers (vs trusting the client `appropriatenessLevel`) is a
**backend-confirmation item**. The security/compliance review gate applies before sign-off
(more financial/KYC data plus the appropriateness decision).

## Definition of done

- An AU individual applicant completes the full GeneralFlow at `/onboarding`: resume,
  personal/contact/financial steps, employment (with conditional employer step), the
  appropriateness assessment (KOQ + dynamic questions), and terms.
- The score computes PASS/FAIL at the threshold; FAIL renders the AU failure page; PASS
  completes and routes to the `PENDING_KYC` hand-off stub.
- `selectFlow` routes AU → GeneralFlow and keeps simplified domains on SimplifiedFlow;
  unsupported jurisdictions show a clear message.
- Scoring engine + selection are unit-tested; the runner has an integration test
  (PASS, FAIL, conditional-skip); a Playwright e2e covers PASS and FAIL.
- Lint, unit/component/integration tests, and the e2e pass under Node 20.
- Security/compliance review completed.

## Risks and notes

- **Exact AU question labels, the employment/income/source-of-funds option sets, the
  domain field name, and the AU pass threshold** are confirmed against the legacy
  `questions.ts`/`TMAU.tsx`/`utils.tsx` during planning, not invented.
- **Dynamic question appending:** the AU config is a function of the loaded questions; the
  scoring `beforeSubmit` must sum over BOTH the mandatory KOQ and the appended additional
  questions (matching the legacy reduce over the assessment set).
- **Engine generality:** the runner and scoring are written so UK/TMCY (REFER bands) and
  corporate (no scoring) slot in later without re-architecting; only AU's binary scoring is
  implemented now.
- **Appropriateness retake, REFER, corporate/CE** are explicit, tracked deferrals.

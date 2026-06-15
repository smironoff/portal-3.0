# Onboarding GeneralFlow Slice 2 (TMCY / EU individual) Design

**Date:** 2026-06-15
**Status:** Approved (pending written-spec review)
**Sub-project:** Onboarding 2b — the second GeneralFlow jurisdiction (TMCY / Cyprus-EU individual), introducing the REFER band

## Context

The Portal 3.0 onboarding GeneralFlow runner + appropriateness-scoring engine and the
first jurisdiction (AU individual, binary PASS/FAIL) are built and on `main`. The
config-driven engine supports `shouldDisplay`/`beforeSubmit`/`isFailure` and a per-step
component, and assessment questions reuse the radio `QuestionStep`.

This slice adds the **TMCY (Cyprus / EU) individual** jurisdiction, whose distinguishing
feature is a **three-band appropriateness outcome**: PASS / REFER / FAIL. REFER is a
visible step where the user explicitly confirms (proceed as REFER) or cancels (becomes
FAIL). TMCY also adds a tax-information step and scores over **all** answered questions
(not just the additional ones, as AU did).

Legacy TMCY and TMEU share one config parameterised by an `isTMCY` flag (TMCY excludes
the PEP and financial-services-role steps; TMEU includes them). This slice targets
**TMCY (`isTMCY = true`)**; the TMEU additions are a deferred follow-up.

## Goal

For an authenticated TMCY individual applicant, run the TMCY GeneralFlow at `/onboarding`:
personal/contact/tax/financial steps, the assessment questions, a score computed over all
answers, and a three-band outcome — PASS proceeds to terms and completion, REFER shows a
confirm/cancel screen (confirm → terms; cancel → failure), FAIL shows the failure page.

## Scope

**In scope:**

- The TMCY jurisdiction config (`buildTmcySteps`, `isTMCY = true`).
- The REFER band: `scoreAll` + band thresholds (PASS ≥ 21 / REFER 11–20 / FAIL < 11), and a
  `ReferStep` (confirm → REFER, cancel → FAIL).
- A tax-information step (tax ID + nationality, nationality simplified for now).
- An engine extension: `onNext` accepts an optional payload so a step can pass a chosen
  value (the REFER outcome) to the runner.
- `selectFlow` + `OnboardingScreen` routing TMCY → GeneralFlow with the TMCY config.

**Out of scope (deferred):**

- TMEU's PEP (politically-exposed) and financial-services-role (FinRole) steps.
- FundCountry (incoming/outgoing fund-country) and FieldsOfStudy detail steps, and any
  'other' free-text add-ons.
- France/Spain country-specific consent screens (FranceConsent / CNMV).
- A full nationality country-dropdown (the tax step uses a simplified input for now).
- The legacy custom tile / yes-no / ExecutedTrades question UIs — the radio `QuestionStep`
  is reused for all TMCY assessment/income questions.
- Other jurisdictions, corporate/CE, retake, registration, KYC docs.

## Decisions (confirmed)

| Area           | Decision                                                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jurisdiction   | TMCY (`isTMCY = true`); TMEU PEP + FinRole deferred                                                                                                                                                                                    |
| Outcome        | Three-band PASS / REFER / FAIL (21 / 11)                                                                                                                                                                                               |
| REFER          | A visible `ReferStep`: confirm → `appropriatenessLevel: 'REFER'` → terms; cancel → `'FAIL'` → failure page                                                                                                                             |
| Scoring        | `scoreAll(questions, details)` sums every answered question's score (TMCY behaviour)                                                                                                                                                   |
| Engine change  | `StepComponentProps.onNext` becomes `(patch?: Partial<AppInfo>) => void`; runner merges the payload and uses `patch?.appropriatenessLevel ?? computedLevel` for the failure check (never the stale draft — keeps the prior HIGH-1 fix) |
| Assessment UI  | Reuse the radio `QuestionStep` for all TMCY questions                                                                                                                                                                                  |
| Tax step       | `taxIdentificationNumber` (required) + `accountHolderNationality` (simplified input; full country dropdown deferred)                                                                                                                   |
| Flow selection | `selectFlow` returns `jurisdiction: 'AU' \| 'TMCY'`; OnboardingScreen maps jurisdiction → builder                                                                                                                                      |

## Architecture

### File structure

```
src/features/onboarding/
  engine/
    scoring.ts                 (+ scoreAll)
    scoring.test.ts            (+ scoreAll/band tests)
    stepConfig.ts              (onNext payload signature)
  flows/general/
    GeneralFlow.tsx            (advance accepts an optional payload)
    GeneralFlow.test.tsx       (+ payload/REFER-path test)
    jurisdictions/tmcy.ts      (buildTmcySteps(questions))
    jurisdictions/tmcy.test.ts
    ReferStep.tsx
    ReferStep.test.tsx
  steps/
    TaxInformationStep.tsx
    TaxInformationStep.test.tsx
  flowSelection.ts / flowSelection.test.ts   (+ TMCY)
  OnboardingScreen.tsx                         (jurisdiction -> builder)
  api/types.ts                                 (+ tax fields)
  flows/general/constants.ts                   (+ TMCY question labels, thresholds)
```

The AU config, runner core, store, API, and slice-1/AU steps remain; the runner gains the
payload parameter and the scoring file gains `scoreAll`.

### Engine extensions

- **`onNext` payload.** `StepComponentProps.onNext: (patch?: Partial<AppInfo>) => void`. In
  the GeneralFlow runner, `advance(patch?)` merges `patch` into the working app, runs the
  step's `beforeSubmit` (capturing `computedLevel`), submits, and the failure check is
  `!CONTINUE_STATUSES.includes(status) || (patch?.appropriatenessLevel ?? computedLevel) === 'FAIL'`.
  Existing steps call `onNext()` (no arg) and are unaffected.
- **`scoreAll(questions, details)`** sums the score of every answered question (via
  `getUserAnswers`). Used by the TMCY scoring `beforeSubmit`.

### TMCY config (`jurisdictions/tmcy.ts`)

`buildTmcySteps(questions: Question[]): StepField[]` returns, in order:
personal → phone → address → **TaxInformation** → platform → employment →
employer (conditional `shouldDisplay` = employed) → annual income → savings →
scored `QuestionStep`s for `sourceWealth`, `turnover`, `incomingFunds`, `education`,
`describeTradingStrategy`, `futuresOptionsExperience`, `executedMoreThan10CFDTrades`,
`personalProfit`, `useLeverage`, `unwantedMarketMovements`,
`appleStocknearMinimumRequiredBalance`, `describeHighVolatility` → **Refer**
(`shouldDisplay: draft.appropriatenessLevel === 'REFER'`) → terms (`isLast`) →
failure (`isFailure`). The `describeHighVolatility` step carries the scoring `beforeSubmit`:

```
const score = scoreAll(questions, draft.accountApplicationQuestionDetails ?? [])
appropriatenessLevel = score >= 21 ? 'PASS' : score >= 11 ? 'REFER' : 'FAIL'
```

The exact TMCY question labels come from the legacy `TMCY_Questions` enum (extracted at
planning). Only labels present in the loaded `questions` render as steps; missing ones are
treated as already-complete by the engine (so the config is resilient to the backend's
question set).

### New steps

- **TaxInformationStep** — RHF + Zod; `taxIdentificationNumber` (required text) and
  `accountHolderNationality` (a simplified select/number input; the full country dropdown is
  deferred). Writes both to the draft.
- **ReferStep** — renders the REFER risk acknowledgement with two actions:
  Confirm → `onNext({ appropriatenessLevel: 'REFER' })`; Cancel →
  `onNext({ appropriatenessLevel: 'FAIL' })`. (No form; it is the user's explicit choice.)

### Outcome routing

- The scoring step sets the band and the runner persists it to the draft.
- **PASS:** the Refer step's `shouldDisplay` is false, so the engine skips it → terms → complete.
- **REFER:** the Refer step shows. Confirm keeps REFER and advances to terms (completes with
  REFER); Cancel sets FAIL, which the runner detects on the next submit → failure page.
- **FAIL** (at scoring): the runner detects FAIL immediately → failure page (the Refer step is
  never reached).

### Flow selection

`selectFlow(app)` returns `{ kind: 'general', jurisdiction: 'AU' | 'TMCY' }`. TMCY and TMEU
domains map to `'TMCY'` for this slice. `OnboardingScreen` maps the jurisdiction to its
builder (`buildAuSteps` / `buildTmcySteps`) and renders `GeneralFlow` with the built steps
and the loaded questions. AU behaviour is unchanged.

## Error handling

- Per-step submit failure → notification, stay on step (draft preserved).
- FAIL (scored or via Refer cancel) → the failure page.
- Envelope-level non-OK status thrown by the API layer and surfaced as a notification
  (consistent with prior slices).

## Testing

- **Unit:** `scoreAll`; the TMCY band assignment (PASS ≥ 21, REFER 11–20, FAIL < 11);
  `selectFlow` TMCY routing; `buildTmcySteps` structure (Refer present with REFER
  `shouldDisplay`, terms `isLast`, failure `isFailure`).
- **Component:** `TaxInformationStep` (validation + draft writes); `ReferStep`
  (confirm sets REFER + calls `onNext` with it; cancel sets FAIL).
- **Integration:** the runner with a payload-passing step — REFER confirm proceeds, cancel
  routes to the failure page.
- **E2E (Playwright):** TMCY wiring (TMCY application → GeneralFlow → tax step renders →
  progresses), modelled on the AU e2e.

## Compliance

The three-band REFER decision is regulatory. `scoreAll` + the band thresholds are pure and
unit-tested. The REFER confirm/cancel is an explicit user acknowledgement of the risk
notice. Whether the backend re-derives `appropriatenessLevel` from the submitted answers
(vs trusting the client value) remains a backend-confirmation follow-up. The
security/compliance review gate applies before sign-off.

## Definition of done

- A TMCY individual applicant completes the TMCY GeneralFlow at `/onboarding`: personal,
  tax, financial, and assessment steps.
- The score (over all answered questions) yields PASS / REFER / FAIL at 21 / 11; PASS
  completes (→ `PENDING_KYC` stub), REFER shows the confirm/cancel screen (confirm → terms;
  cancel → failure), FAIL → failure page.
- `selectFlow` routes TMCY/TMEU domains to the TMCY GeneralFlow; AU unchanged.
- `scoreAll` + band assignment + `selectFlow` + `buildTmcySteps` unit-tested; `ReferStep`
  and `TaxInformationStep` component-tested; runner payload/REFER integration-tested; a
  Playwright e2e covers TMCY wiring.
- Lint, unit/component/integration tests, and the e2e pass under Node 20.
- Security/compliance review completed.

## Risks and notes

- **Exact TMCY question labels, the scored-question set, and the thresholds** are confirmed
  against the legacy `TMCY.tsx`/`questions.ts` during planning (PASS 21 / REFER 11 verified).
- **Scoring sums all answered questions** (TMCY behaviour), unlike AU (additional only) —
  hence the separate `scoreAll`.
- **REFER outcome** depends on the `onNext` payload extension; the failure check must use the
  freshly-passed/computed level, never the hydrated draft (prior HIGH-1 fix preserved).
- **Deferrals** (TMEU PEP/FinRole, FundCountry, FieldsOfStudy detail, France/Spain consent,
  full nationality dropdown, 'other' free-text) are explicit and tracked.

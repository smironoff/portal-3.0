# Onboarding Vertical (2b) Design — Engine + Simplified Flow

**Date:** 2026-06-15
**Status:** Approved (pending written-spec review)
**Sub-project:** 2b — Onboarding (first slice: the config-driven engine + the SimplifiedFlow)

## Context

Portal 3.0 is the modern rebuild of the legacy `portal-2.0` CFD brokerage portal.
The Foundation (app shell) and the Auth vertical (2a: login, 2FA, password reset,
session) are complete and on `main`. Sentry DSN/wiring/filters have been ported
from the legacy code.

The legacy onboarding has two paths: a **deprecated** per-screen flow under
`/account/*` (personal-information, contact-and-address, financial-details, etc.),
and the **current** unified flow at `/create-account`
(`src/components/Container/Onboarding/`) that selects **GeneralFlow** (per-jurisdiction
step lists for ~11 entities with appropriateness scoring) or **SimplifiedFlow**
(a two-level streamlined flow), driven by backend-provided dynamic questions, with
incremental submit and multi-session resume.

**Direction set for this work:**

- Onboarding is the priority.
- Live onboarding (except IB) uses a single upper-level **`/onboarding`** route with
  the General/Simplified flow + steps.
- The deprecated `/account/*` onboarding flow is **not ported**.
- IB onboarding is out of scope (the IB/partner vertical owns it).

Onboarding is large, so it is built in slices. **This spec covers the first slice:
the reusable onboarding engine plus the SimplifiedFlow.** GeneralFlow jurisdictions
are later slices. Registration is a separate, deferred sub-project.

## Goal

A working unified `/onboarding` route that, for an **already-authenticated user**,
runs the **SimplifiedFlow** end to end on top of a reusable, config-driven step
**engine**: resume an incomplete application, complete Level 1, show a pending-approval
interstitial, complete Level 2, and hand off at `PENDING_KYC`. The engine is designed
so GeneralFlow jurisdictions can be added later without re-architecting.

## Scope

**In scope:**

- A config-driven onboarding **engine**: `StepField` step descriptors + a pure step
  state machine (completion, resume, conditional-skip navigation).
- The **SimplifiedFlow** (Level 1 and Level 2) wired on the engine.
- Working-application state (Zustand store hydrated from a load query), the
  backend dynamic-questions mechanism, and incremental + level-boundary submit.
- Step forms (RHF + Zod): personal info, phone, platform, terms, address (manual),
  dynamic question.
- `/onboarding` routing; update the Auth `resolveLandingRoute` seam to route an
  authenticated user with an incomplete application to `/onboarding`.

**Out of scope (deferred):**

- Registration / social login / email verification (separate sub-project; onboarding
  is developed against an authenticated user).
- GeneralFlow jurisdictions and the appropriateness-test scoring (later slices).
- IB onboarding (IB/partner vertical).
- KYC document upload (2c) — `PENDING_KYC` hands off to a stub here.
- GBG/Google **address lookup** — a manual address form is used; lookup is a follow-up.
- The deprecated `/account/*` onboarding screens.

## Decisions (confirmed)

| Area                 | Decision                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| First slice          | Onboarding engine + SimplifiedFlow only                                                               |
| User precondition    | Authenticated user (from 2a); registration deferred                                                   |
| Route                | Unified `/onboarding` (guarded); deprecated `/account/*` flow not ported                              |
| Engine model         | Config-driven `StepField[]` + pure step state machine (ported from legacy approach)                   |
| Working state        | Zustand `onboardingStore` (draft `AppInfo` + `currentStep`), hydrated from a load query               |
| Server data          | TanStack Query: `useApplication` (load/resume), `useQuestions` (dynamic questionnaire)                |
| Submit               | Per-step `incrementalSubmit`; level boundaries `submitLevelOne`/`submitLevelTwo`                      |
| Forms                | React Hook Form + Zod (replacing Formik), Foundation primitives                                       |
| Address              | Manual form this slice; GBG/Google lookup deferred                                                    |
| L1 → L2              | A "Level 1 submitted, pending approval" interstitial when status is `LEVEL1_APPROVED` and L2 not done |
| Appropriateness test | Not applicable to SimplifiedFlow (keeps this slice's regulatory logic simple)                         |
| Folder               | `src/features/onboarding/`                                                                            |

## Architecture

### File structure

```
src/features/onboarding/
  engine/
    stepConfig.ts          (StepField type + helpers)
    stepMachine.ts         (isStepCompleted, getStartingStep, getNextStep, getPreviousStep — pure)
    stepMachine.test.ts
  state/
    onboardingStore.ts     (Zustand: draft AppInfo + currentStep + patch())
    onboardingStore.test.ts
  api/
    types.ts               (AppInfo subset, Question, Answer, ApplicationStatus)
    onboardingApi.ts        (loadApplication, getQuestions, incrementalSubmit, submitLevelOne, submitLevelTwo)
    onboardingApi.test.ts
    onboardingQueries.ts   (useApplication, useQuestions, useIncrementalSubmit, useSubmitLevelOne/Two)
  flows/
    simplified/
      flowConfig.ts        (LEVEL_ONE_STEPS, LEVEL_TWO_STEPS as StepField[])
      SimplifiedFlow.tsx
  steps/
    PersonalInfoStep.tsx, PhoneStep.tsx, PlatformStep.tsx, TermsStep.tsx,
    AddressStep.tsx, QuestionStep.tsx   (+ .test.tsx)
  components/
    StepLayout.tsx, ProgressHeader.tsx
  OnboardingScreen.tsx     (selects the flow; this slice always SimplifiedFlow)
  routes/onboarding.tsx
```

The Foundation (`src/api/*`, `src/state/*`, `src/components/*`) and the Auth feature
remain as-is. `src/features/auth/landing.ts` `resolveLandingRoute` is updated to point
incomplete-application users at `/onboarding`.

### Engine

A `StepField` describes one step:

- `fields`: the `AppInfo` keys this step collects (used for completion checks).
- `requiredQuestions`: backend question labels that must be answered.
- `component`: the step React component.
- `category`: grouping for the progress header (e.g. personal, address, experience).
- `shouldDisplay?(draft)`: conditional inclusion (skip when false).
- `beforeSubmit?(draft, questions)`: a hook to derive values before submitting.
- `isLast?`, `canGoBack?`.

The **step machine** is pure functions over `(steps, draft, questions)`:

- `isStepCompleted(step, draft, questions)` — all `fields` filled and all
  `requiredQuestions` answered (or the step is skipped via `shouldDisplay`).
- `getStartingStep(steps, draft, questions)` — first incomplete step (resume).
- `getNextStep`/`getPreviousStep` — move forward/back, skipping non-displayed steps.

These have no React or network dependencies and are unit-tested directly.

### State and data

- **`onboardingStore` (Zustand):** holds the working `AppInfo` draft and
  `currentStep`, with `patch(partial)` (shallow merge, the legacy `updateUserAppInfo`
  behaviour) and `reset()`.
- **`useApplication()`** loads the last/incomplete application from the backend and
  hydrates the store on mount; `getStartingStep` then resumes at the first incomplete
  step. **`useQuestions()`** loads the backend questionnaire (used by Level 2's
  experience questions).
- **Submit:** each step persists via `useIncrementalSubmit` (the legacy
  `incrementalSubmit`/`application_submit`); the end of each level calls
  `useSubmitLevelOne`/`useSubmitLevelTwo`.

### SimplifiedFlow

Driven by two `StepField[]` configs (ported from legacy `flowConfigs.tsx`):

- **Level 1** (`INCOMPLETE`): `personalInfo` → `phone` → `platform` → `terms`
  → `submitLevelOne` → status `LEVEL1_APPROVED`.
- **Interstitial:** when status is `LEVEL1_APPROVED` and Level 2 is not complete,
  show a "Level 1 submitted, pending approval" screen. Real approval is backend-side;
  in development the status is driven via mocks.
- **Level 2** (`LEVEL1_APPROVED`): `address` → forex-experience question →
  securities/bonds-experience question → `submitLevelTwo` → status `PENDING_KYC`.
- **`PENDING_KYC`** hands off to a stub (KYC document upload is sub-project 2c).

`SimplifiedFlow` chooses the active level's steps from the application status, then
delegates progression to the engine.

### Steps and forms

Each step is a React Hook Form + Zod form using the Foundation primitives, reading and
writing the `onboardingStore` draft. `QuestionStep` renders a dynamic backend question
(multiple choice from `useQuestions`) and records the answer in
`draft.accountApplicationQuestionDetails`. The address step is a manual form (no lookup
integration in this slice).

### Routing

`/onboarding` is a guarded route (authenticated). `OnboardingScreen` reads the
application status/flow selection and renders `SimplifiedFlow` (this slice always
selects Simplified). `resolveLandingRoute` (Auth feature) is updated so an authenticated
user whose application is incomplete lands on `/onboarding`; the throwaway `/hello`
placeholder is removed once `/onboarding` is the real landing for incomplete users.

## Error handling

- Per-step submit failures surface a notification (`notificationStore`) and keep the
  user on the step (no data loss; the draft persists in the store).
- Backend status values that indicate failure/denial route to a failure screen with
  the backend-provided reason (SimplifiedFlow has limited failure states; no
  appropriateness FAIL).
- Network/non-JSON errors are handled by the Foundation httpClient and surfaced via the
  mutation `onError`.

## Testing

- **Unit (Vitest):** the step machine (`isStepCompleted`, `getStartingStep`,
  `getNextStep`/`getPreviousStep`, conditional skip, resume), and the `onboardingStore`
  (patch/merge/reset).
- **Component:** each step form (RHF validation, draft writes), `QuestionStep` dynamic
  rendering, mocking queries/mutations.
- **Integration:** a SimplifiedFlow test driving Level 1 → interstitial → Level 2 →
  `PENDING_KYC` with mocked queries/mutations.
- **E2E (Playwright):** the Simplified happy path with intercepted load/questions/submit
  endpoints (same same-origin `.env.test` approach as the Auth e2e).

## Compliance

This flow captures KYC-relevant personal and financial data for a regulated broker, so
the **security/compliance review gate applies before sign-off**: confirm no PII or
answers are logged (console/Sentry), the draft and submissions persist correctly with no
silent data loss, the reset token / sensitive params remain scrubbed, and no secret is
committed. SimplifiedFlow has no appropriateness test, so no scoring logic is at risk in
this slice.

## Definition of done

- `/onboarding` runs the SimplifiedFlow for an authenticated user: resume an incomplete
  application, complete Level 1, see the pending-approval interstitial, complete Level 2,
  and reach the `PENDING_KYC` hand-off stub.
- The engine's step machine and the store are unit-tested; steps and the flow have
  component/integration tests; a Playwright e2e covers the happy path.
- `resolveLandingRoute` routes incomplete-application users to `/onboarding`.
- Dynamic backend questions render and persist answers; incremental and level-boundary
  submits work.
- Lint, unit/component/integration tests, and the e2e pass under Node 20.
- Security/compliance review completed.

## Risks and notes

- **Exact endpoints/payloads** (`incremental_submit`/`application_submit`,
  `simplified_submit_level_one`/`_two`, `get_user`/application load, `getQuestions`,
  the `AppInfo` field names and `ApplicationStatus` values) are confirmed against the
  legacy `api.ts`/`types.ts` during planning, not invented.
- **Engine generality:** the `StepField`/step-machine design must support GeneralFlow's
  needs (conditional steps, `beforeSubmit` scoring hooks) even though this slice only
  exercises SimplifiedFlow, so those hooks exist in the model from the start.
- **Address lookup** and **registration** are explicit, tracked deferrals.
- **L1→L2 approval** is backend-driven; the interstitial plus mock-driven status is how
  the slice exercises both levels without a live backend.

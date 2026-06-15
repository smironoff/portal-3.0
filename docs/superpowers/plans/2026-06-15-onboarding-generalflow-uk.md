# Onboarding GeneralFlow Slice 3 (UK individual) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the UK individual GeneralFlow at `/onboarding` with the correct multi-path PASS/REFER/FAIL outcome (forex-experience auto-pass, no-forex scored path with shares-experience modulation, deposit-loss attitude gate), reusing the existing runner, `ReferStep`, `makeAppFailed`, `TaxInformationStep`, and `QuestionStep`.

**Architecture:** Config + a pure scoring module + reuse. New: `ukScoring.ts` (pure), `buildUkSteps`, UK constants, and `selectFlow`/OnboardingScreen routing. No engine change.

**Tech Stack:** React 19, TS 6 strict, TanStack Router/Query, Zustand, MUI v9, RHF + Zod, Vitest, Playwright. **Node 20** (`source "$HOME/.nvm/nvm.sh" && nvm use`). **Arrow functions only.** Commit with `git add <specific files>` (never `git add -A`). Do NOT create worktrees.

**Spec:** `docs/superpowers/specs/2026-06-15-onboarding-generalflow-uk-design.md`
**Legacy reference:** `/Volumes/WORK/ThinkMarkets/portal-2.0/src`.

**Verified legacy contracts:**

- `UK_Questions` labels (all values == keys): `forexExperience`, `sharesFundsExperience`, `futuresOptionsExperience`, `personalProfit`, `useLeverage`, `unwantedMarketMovements`, `appleUseLeverage`, `UKDepositLoss`.
- Auto-pass answers: `['moreThan60Trades','between11and60Trades','between1and10Trades']` → PASS.
- Shares-experience answers: `['moreThan60Trades','between11and60Trades','lessThan10Trades']`.
- Deposit-loss PASS answers: `['UKDepositLoss1','UKDepositLoss2']`.
- Thresholds: with-shares `> 0` → REFER (else FAIL); without-shares `> 1` → REFER (else FAIL).
- Deposit-loss gate: if PASS and the `UKDepositLoss` answer is not a PASS answer → REFER (worst-of; never upgrades).
- `forexExperience` step: PASS-via-gate if auto-pass answer, else `undefined` (NOT FAIL). `appleUseLeverage` step (shown only when `forexExperience === 'never'`): computes REFER/FAIL then applies the gate.
- Domain `UK` → the UK config. Submit: same `application_submit`; level carried in the app.

---

## Task 1: UK constants + pure scoring (`ukScoring`)

The crux. Pure functions, exhaustively unit-tested.

**Files:** Modify `src/features/onboarding/flows/general/constants.ts`. Create `src/features/onboarding/flows/general/jurisdictions/ukScoring.ts`, `jurisdictions/ukScoring.test.ts`.

- [ ] **Step 1: Add to `constants.ts`:**

```ts
export const UK = {
  forexExperience: 'forexExperience',
  sharesFundsExperience: 'sharesFundsExperience',
  futuresOptionsExperience: 'futuresOptionsExperience',
  personalProfit: 'personalProfit',
  useLeverage: 'useLeverage',
  unwantedMarketMovements: 'unwantedMarketMovements',
  appleUseLeverage: 'appleUseLeverage',
  UKDepositLoss: 'UKDepositLoss',
} as const

export const UK_FOREX_PASS_ANSWERS = [
  'moreThan60Trades',
  'between11and60Trades',
  'between1and10Trades',
]
export const UK_SHARES_EXPERIENCE_ANSWERS = [
  'moreThan60Trades',
  'between11and60Trades',
  'lessThan10Trades',
]
export const UK_DEPOSIT_LOSS_PASS_ANSWERS = ['UKDepositLoss1', 'UKDepositLoss2']
export const UK_REFER_THRESHOLD_WITH_SHARES = 0
export const UK_REFER_THRESHOLD_WITHOUT_SHARES = 1
export const UK_CONTACT_US_LINK = 'https://www.thinkmarkets.com/en/support/contact-us/' // TODO confirm exact UK support URL with compliance
```

- [ ] **Step 2: Write the failing test** `jurisdictions/ukScoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyDepositLossGate, computeUkLevel, forexAutoPass } from './ukScoring'

type A = Record<string, { answer?: string; score: number }>
const a = (entries: A): A => entries

describe('applyDepositLossGate', () => {
  it('downgrades PASS to REFER for a non-pass deposit-loss answer', () => {
    expect(applyDepositLossGate('PASS', 'UKDepositLoss3')).toBe('REFER')
  })
  it('leaves PASS for a pass deposit-loss answer or no answer', () => {
    expect(applyDepositLossGate('PASS', 'UKDepositLoss1')).toBe('PASS')
    expect(applyDepositLossGate('PASS', undefined)).toBe('PASS')
  })
  it('never upgrades REFER/FAIL', () => {
    expect(applyDepositLossGate('REFER', 'UKDepositLoss1')).toBe('REFER')
    expect(applyDepositLossGate('FAIL', 'UKDepositLoss1')).toBe('FAIL')
  })
})

describe('forexAutoPass', () => {
  it('returns PASS (gated) for an auto-pass forex answer', () => {
    expect(forexAutoPass(a({ forexExperience: { answer: 'between1and10Trades', score: 0 } }))).toBe(
      'PASS'
    )
  })
  it('returns REFER when auto-pass forex but a non-pass deposit-loss answer', () => {
    expect(
      forexAutoPass(
        a({
          forexExperience: { answer: 'moreThan60Trades', score: 0 },
          UKDepositLoss: { answer: 'UKDepositLoss4', score: 0 },
        })
      )
    ).toBe('REFER')
  })
  it('returns undefined when not an auto-pass forex answer', () => {
    expect(forexAutoPass(a({ forexExperience: { answer: 'never', score: 0 } }))).toBeUndefined()
    expect(forexAutoPass(a({}))).toBeUndefined()
  })
})

describe('computeUkLevel (no-forex scored path)', () => {
  it('with shares experience: REFER when personalProfit+useLeverage > 0, else FAIL', () => {
    const base = {
      forexExperience: { answer: 'never', score: 0 },
      sharesFundsExperience: { answer: 'lessThan10Trades', score: 0 },
    }
    expect(
      computeUkLevel(
        a({
          ...base,
          personalProfit: { answer: 'x', score: 1 },
          useLeverage: { answer: 'y', score: 0 },
        })
      )
    ).toBe('REFER')
    expect(
      computeUkLevel(
        a({
          ...base,
          personalProfit: { answer: 'x', score: 0 },
          useLeverage: { answer: 'y', score: 0 },
        })
      )
    ).toBe('FAIL')
  })
  it('without shares experience: REFER when the 4-question sum > 1, else FAIL', () => {
    const base = {
      forexExperience: { answer: 'never', score: 0 },
      sharesFundsExperience: { answer: 'none', score: 0 },
    }
    expect(
      computeUkLevel(
        a({
          ...base,
          personalProfit: { answer: 'x', score: 1 },
          useLeverage: { answer: 'y', score: 1 },
        })
      )
    ).toBe('REFER') // 2 > 1
    expect(
      computeUkLevel(
        a({
          ...base,
          personalProfit: { answer: 'x', score: 1 },
          useLeverage: { answer: 'y', score: 0 },
        })
      )
    ).toBe('FAIL') // 1, not > 1
  })
  it('auto-pass forex answer returns PASS (gated)', () => {
    expect(computeUkLevel(a({ forexExperience: { answer: 'moreThan60Trades', score: 0 } }))).toBe(
      'PASS'
    )
    expect(
      computeUkLevel(
        a({
          forexExperience: { answer: 'moreThan60Trades', score: 0 },
          UKDepositLoss: { answer: 'UKDepositLoss5', score: 0 },
        })
      )
    ).toBe('REFER')
  })
  it('defaults to FAIL on missing/unknown forex answer', () => {
    expect(computeUkLevel(a({}))).toBe('FAIL')
  })
})
```

- [ ] **Step 3: Run, verify FAIL.**

- [ ] **Step 4: Implement** `jurisdictions/ukScoring.ts`:

```ts
import {
  UK,
  UK_FOREX_PASS_ANSWERS,
  UK_SHARES_EXPERIENCE_ANSWERS,
  UK_DEPOSIT_LOSS_PASS_ANSWERS,
  UK_REFER_THRESHOLD_WITH_SHARES,
  UK_REFER_THRESHOLD_WITHOUT_SHARES,
} from '../constants'
import type { UserAnswer } from '../../../engine/scoring'

type Level = 'PASS' | 'REFER' | 'FAIL'
type Answers = Record<string, UserAnswer>

export const applyDepositLossGate = (level: Level, depositLossAnswer?: string): Level =>
  level === 'PASS' && depositLossAnswer && !UK_DEPOSIT_LOSS_PASS_ANSWERS.includes(depositLossAnswer)
    ? 'REFER'
    : level

// forexExperience step: auto-pass (gated) for a qualifying forex history, else undefined
// (NOT FAIL — the level is finalised at the scored step once the assessment is answered).
export const forexAutoPass = (answers: Answers): Level | undefined => {
  const forex = answers[UK.forexExperience]?.answerLabel
  return forex && UK_FOREX_PASS_ANSWERS.includes(forex)
    ? applyDepositLossGate('PASS', answers[UK.UKDepositLoss]?.answerLabel)
    : undefined
}

// appleUseLeverage step (shown only when forexExperience === 'never'): scored path + gate.
export const computeUkLevel = (answers: Answers): Level => {
  const forex = answers[UK.forexExperience]?.answerLabel
  let level: Level = 'FAIL'
  if (forex && UK_FOREX_PASS_ANSWERS.includes(forex)) {
    level = 'PASS'
  } else if (forex === 'never') {
    const hasShares = UK_SHARES_EXPERIENCE_ANSWERS.includes(
      answers[UK.sharesFundsExperience]?.answerLabel ?? ''
    )
    const score = hasShares
      ? (answers[UK.personalProfit]?.score ?? 0) + (answers[UK.useLeverage]?.score ?? 0)
      : (answers[UK.personalProfit]?.score ?? 0) +
        (answers[UK.useLeverage]?.score ?? 0) +
        (answers[UK.unwantedMarketMovements]?.score ?? 0) +
        (answers[UK.appleUseLeverage]?.score ?? 0)
    const threshold = hasShares ? UK_REFER_THRESHOLD_WITH_SHARES : UK_REFER_THRESHOLD_WITHOUT_SHARES
    if (score > threshold) level = 'REFER'
  }
  return applyDepositLossGate(level, answers[UK.UKDepositLoss]?.answerLabel)
}
```

NOTE: `getUserAnswers` (engine/scoring) returns `Record<label, UserAnswer>` where `UserAnswer` has `answerLabel` and `score`. Confirm the field name — the test uses `answer`; align the test and code to the real `UserAnswer` shape (the engine's `UserAnswer` is `{ answerId?, answerLabel?, others?, score }`). **Use `answerLabel`** in the implementation and make the test fixtures use `answerLabel` too (update the `A` type + fixtures to `{ answerLabel?: string; score: number }`). Keep the assertions identical.

- [ ] **Step 5: Run, verify PASS.**

- [ ] **Step 6: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/flows/general/constants.ts src/features/onboarding/flows/general/jurisdictions/ukScoring.ts src/features/onboarding/flows/general/jurisdictions/ukScoring.test.ts
git commit -m "feat(onboarding): UK constants + pure multi-path scoring (auto-pass, shares modulation, deposit-loss gate)"
```

---

## Task 2: UK jurisdiction config (`buildUkSteps`)

**Files:** Create `src/features/onboarding/flows/general/jurisdictions/uk.ts`, `jurisdictions/uk.test.ts`.

- [ ] **Step 1: Write the failing test** `jurisdictions/uk.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildUkSteps } from './uk'
import type { Question } from '../../../api/types'

const q = (id: number, label: string, isMandatory = true): Question => ({
  id,
  question: label,
  label,
  isMandatory,
  answers: [
    { id: id * 10 + 1, answer: 'never', label: 'never', score: 0 },
    { id: id * 10 + 2, answer: 'lots', label: 'moreThan60Trades', score: 3 },
  ],
})
const questions: Question[] = [
  q(1, 'forexExperience'),
  q(2, 'sharesFundsExperience'),
  q(3, 'personalProfit'),
  q(4, 'useLeverage'),
  q(5, 'unwantedMarketMovements'),
  q(6, 'appleUseLeverage'),
  q(7, 'UKDepositLoss'),
]

describe('buildUkSteps', () => {
  it('has the forexExperience step with a beforeSubmit, a Refer step, terms (isLast), failure (isFailure)', () => {
    const steps = buildUkSteps(questions)
    const forex = steps.find((s) => s.requiredQuestions?.includes('forexExperience'))!
    expect(typeof forex.beforeSubmit).toBe('function')
    expect(
      steps.find((s) => s.category === 'refer')?.shouldDisplay?.({ appropriatenessLevel: 'REFER' })
    ).toBe(true)
    expect(steps.some((s) => s.isLast)).toBe(true)
    expect(steps.some((s) => s.isFailure)).toBe(true)
  })

  it('forexExperience auto-pass sets PASS and the appleUseLeverage step computes the scored level', async () => {
    const steps = buildUkSteps(questions)
    const forex = steps.find((s) => s.requiredQuestions?.includes('forexExperience'))!
    // auto-pass: forex answer = moreThan60Trades (answer id 12)
    const passed = await forex.beforeSubmit!(
      { accountApplicationQuestionDetails: [{ question: 1, answer: 12 }] },
      questions
    )
    expect(passed.appropriatenessLevel).toBe('PASS')
    // never -> undefined at the forex step
    const undet = await forex.beforeSubmit!(
      { accountApplicationQuestionDetails: [{ question: 1, answer: 11 }] },
      questions
    )
    expect(undet.appropriatenessLevel).toBeUndefined()

    const apple = steps.find((s) => s.requiredQuestions?.includes('appleUseLeverage'))!
    // never + no shares + scores summing > 1 -> REFER
    const details = [
      { question: 1, answer: 11 }, // forex never
      { question: 2, answer: 21 }, // shares never
      { question: 3, answer: 32 }, // personalProfit score 3
      { question: 4, answer: 42 }, // useLeverage score 3
    ]
    expect(
      (await apple.beforeSubmit!({ accountApplicationQuestionDetails: details }, questions))
        .appropriatenessLevel
    ).toBe('REFER')
  })

  it('assessment questions are shown only when forexExperience === never', () => {
    const steps = buildUkSteps(questions)
    const apple = steps.find((s) => s.requiredQuestions?.includes('appleUseLeverage'))!
    expect(
      apple.shouldDisplay?.({ accountApplicationQuestionDetails: [{ question: 1, answer: 11 }] })
    ).toBe(true) // never
    expect(
      apple.shouldDisplay?.({ accountApplicationQuestionDetails: [{ question: 1, answer: 12 }] })
    ).toBe(false) // experienced
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** `jurisdictions/uk.ts`:

```ts
import type { StepField } from '../../../engine/stepConfig'
import type { AppInfo, Question } from '../../../api/types'
import { getUserAnswers } from '../../../engine/scoring'
import { UK, UK_CONTACT_US_LINK } from '../constants'
import { forexAutoPass, computeUkLevel } from './ukScoring'
import { PersonalInfoStep } from '../../../steps/PersonalInfoStep'
import { PhoneStep } from '../../../steps/PhoneStep'
import { AddressStep } from '../../../steps/AddressStep'
import { PlatformStep } from '../../../steps/PlatformStep'
import { TermsStep } from '../../../steps/TermsStep'
import { EmploymentStatusStep } from '../../../steps/EmploymentStatusStep'
import { EmployerInfoStep } from '../../../steps/EmployerInfoStep'
import { SourceOfFundsStep } from '../../../steps/SourceOfFundsStep'
import { AnnualIncomeStep } from '../../../steps/AnnualIncomeStep'
import { SavingsStep } from '../../../steps/SavingsStep'
import { TaxInformationStep } from '../../../steps/TaxInformationStep'
import { makeQuestionStep } from '../../../steps/QuestionStep'
import { useQuestionsList } from '../../simplified/useQuestionsList'
import { makeAppFailed } from '../AppFailed'
import { ReferStep } from '../ReferStep'
import { EMPLOYED_VALUES } from '../constants'

const isEmployed = (draft: Partial<AppInfo>) =>
  EMPLOYED_VALUES.includes((draft.accountHolderEmploymentStatus as string) ?? '')

export const buildUkSteps = (questions: Question[]): StepField[] => {
  const noForex = (draft: Partial<AppInfo>) =>
    getUserAnswers(questions, draft.accountApplicationQuestionDetails ?? [])[UK.forexExperience]
      ?.answerLabel === 'never'

  const assessmentQuestion = (
    label: string,
    beforeSubmit?: StepField['beforeSubmit']
  ): StepField => ({
    fields: [],
    requiredQuestions: [label],
    component: makeQuestionStep(label, useQuestionsList),
    category: 'assessment',
    shouldDisplay: noForex,
    ...(beforeSubmit ? { beforeSubmit } : {}),
  })

  return [
    {
      fields: [
        'accountHolderFirstName',
        'accountHolderLastName',
        'accountHolderDayOfBirth',
        'accountHolderMonthOfBirth',
        'accountHolderYearOfBirth',
      ],
      component: PersonalInfoStep,
      category: 'personal',
      canGoBack: false,
    },
    {
      fields: ['accountHolderPhone', 'accountHolderPhoneCode'],
      component: PhoneStep,
      category: 'phone',
    },
    { fields: ['accountHolderPostalCode'], component: AddressStep, category: 'address' },
    {
      fields: ['taxIdentificationNumber', 'accountHolderNationality'],
      component: TaxInformationStep,
      category: 'tax',
    },
    {
      fields: ['selectedPlatform', 'platformAccountType', 'leverage', 'accountCurrency'],
      component: PlatformStep,
      category: 'platform',
    },
    {
      fields: ['accountHolderEmploymentStatus', 'employmentStatus'],
      component: EmploymentStatusStep,
      category: 'employment',
    },
    {
      fields: ['occupation', 'industry', 'employerName'],
      component: EmployerInfoStep,
      category: 'employment',
      shouldDisplay: isEmployed,
    },
    { fields: ['sourceOfFunds'], component: SourceOfFundsStep, category: 'income' },
    { fields: ['approximateIncomeValue'], component: AnnualIncomeStep, category: 'income' },
    { fields: ['estimatedNetWorth'], component: SavingsStep, category: 'income' },
    // UKDepositLoss: shown only if the backend returned it.
    {
      fields: [],
      requiredQuestions: [UK.UKDepositLoss],
      component: makeQuestionStep(UK.UKDepositLoss, useQuestionsList),
      category: 'experience',
      shouldDisplay: () => questions.some((qn) => qn.label === UK.UKDepositLoss),
    },
    // forexExperience: always shown; auto-pass beforeSubmit.
    {
      fields: [],
      requiredQuestions: [UK.forexExperience],
      component: makeQuestionStep(UK.forexExperience, useQuestionsList),
      category: 'experience',
      beforeSubmit: (draft: Partial<AppInfo>) => ({
        ...draft,
        appropriatenessLevel: forexAutoPass(
          getUserAnswers(questions, draft.accountApplicationQuestionDetails ?? [])
        ),
      }),
    },
    // Assessment questions: shown only when forexExperience === 'never'.
    assessmentQuestion(UK.futuresOptionsExperience),
    assessmentQuestion(UK.personalProfit),
    assessmentQuestion(UK.useLeverage),
    assessmentQuestion(UK.unwantedMarketMovements),
    assessmentQuestion(UK.appleUseLeverage, (draft: Partial<AppInfo>) => ({
      ...draft,
      appropriatenessLevel: computeUkLevel(
        getUserAnswers(questions, draft.accountApplicationQuestionDetails ?? [])
      ),
    })),
    {
      fields: ['isReferAcknowledged'],
      component: ReferStep,
      category: 'refer',
      canGoBack: false,
      shouldDisplay: (d) => d.appropriatenessLevel === 'REFER',
    },
    { fields: ['secondaryConsentAccepted'], component: TermsStep, category: 'terms', isLast: true },
    {
      fields: [],
      component: makeAppFailed(UK_CONTACT_US_LINK),
      category: 'assessment',
      isFailure: true,
    },
  ]
}
```

NOTE: the `appropriatenessLevel` on the returned object must satisfy `AppInfo`'s
`'PASS' | 'REFER' | 'FAIL' | undefined`; `forexAutoPass`/`computeUkLevel` already return that.
Confirm `makeAppFailed`/`ReferStep`/`getUserAnswers.answerLabel` names match the implemented
code; align if needed.

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/flows/general/jurisdictions/uk.ts src/features/onboarding/flows/general/jurisdictions/uk.test.ts
git commit -m "feat(onboarding): UK jurisdiction config (auto-pass + scored assessment + Refer)"
```

---

## Task 3: Flow selection (+UK) + OnboardingScreen builder

**Files:** Modify `src/features/onboarding/flowSelection.ts` (+ test), `src/features/onboarding/OnboardingScreen.tsx`.

- [ ] **Step 1: Extend the test** in `flowSelection.test.ts`:

```ts
it('routes UK to general UK', () => {
  expect(selectFlow({ portalAccountDomain: 'UK' })).toEqual({ kind: 'general', jurisdiction: 'UK' })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Update `flowSelection.ts`:** widen the general variant to `jurisdiction: 'AU' | 'TMCY' | 'UK'`, and add `if (domain === 'UK') return { kind: 'general', jurisdiction: 'UK' }` (after the AU/TMCY checks). Keep the rest.

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Update `OnboardingScreen.tsx`:** add `buildUkSteps` to the builders map:

```tsx
import { buildUkSteps } from './flows/general/jurisdictions/uk'
const builders = { AU: buildAuSteps, TMCY: buildTmcySteps, UK: buildUkSteps } as const
```

Ensure existing AU/TMCY/simplified tests still pass.

- [ ] **Step 6: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/flowSelection.ts src/features/onboarding/flowSelection.test.ts src/features/onboarding/OnboardingScreen.tsx
git commit -m "feat(onboarding): selectFlow + OnboardingScreen route UK to UK GeneralFlow"
```

---

## Task 4: Playwright e2e (UK wiring)

**Files:** Create `e2e/onboarding-uk.spec.ts` (model on `e2e/onboarding-tmcy.spec.ts`).

- [ ] **Step 1:** log in; `**/nsdata` by action — `get_user` (profile), `getLastApplicationsInfo` → `[{ applicationId: 1, status: 'INCOMPLETE', portalAccountDomain: 'UK', organizationId: 1 }]`, `getQuestions` → a non-empty set including `forexExperience` (and others), `application_submit` → `{ applicationStatus: 'INCOMPLETE', applicationId: 1 }`. Assert: lands on `/onboarding`; the GeneralFlow renders the "Personal information" heading; fill personal info + Continue; assert it progresses to "Phone number". (The scoring is unit-covered; this proves UK wiring. `organizationId` is required so the questions query enables.)

- [ ] **Step 2:** run `npm run e2e` — all specs pass. Adjust selectors as needed (do not change app source unless a real bug is found).

- [ ] **Step 3: Commit**

```bash
git add e2e/onboarding-uk.spec.ts
git commit -m "test(onboarding): UK GeneralFlow wiring e2e"
```

---

## Task 5: Security/compliance gate + final verification

- [ ] **Step 1: Full verification** under Node 20: `npm run lint && npm run test && npm run build && npm run e2e` — all green. Confirm no stray `.claude/worktrees/` dir.
- [ ] **Step 2: Security/compliance review** of the UK code. Checklist: the multi-path scoring is correct for every documented path (auto-pass; with/without shares; the deposit-loss gate; FAIL default); no bypass to PASS/REFER when the user should FAIL; FAIL/Refer-cancel reach the failure page; the scoring never throws on missing answers; no PII/answers logged; UK inherits the existing C-1 (REFER loss-percentage placeholder — UK needs its own figure) and C-2 (T&C/KID links) compliance follow-ups; confirm `UK_CONTACT_US_LINK`; no secret committed.
- [ ] **Step 3: Push:** `git push origin main`.
- [ ] **Step 4: Confirm DoD** against the spec.

---

## Notes for the implementer

- **`getUserAnswers` field name:** the engine's `UserAnswer` exposes `answerLabel` (and `score`). The scoring/config above read `answerLabel`. Make the `ukScoring.test.ts` fixtures use `{ answerLabel, score }` to match. (Inspect `engine/scoring.ts` to confirm the exact field names before writing the test.)
- **Two scoring hooks, one pure module:** the forexExperience hook uses `forexAutoPass` (PASS-or-undefined); the appleUseLeverage hook uses `computeUkLevel` (REFER/FAIL/PASS + gate). Both are pure and unit-tested in Task 1.
- **No engine change** and **no new components** — UK reuses `ReferStep` (with `isReferAcknowledged` in its `fields`), `makeAppFailed`, `TaxInformationStep`, `QuestionStep`, and the financial steps.
- **Deferred:** `SelectAccountType` (multi-platform-TT), UK NIN/passport tax validation, multi-country tax residency. **C-1/C-2 compliance** items carry over (UK has its own required loss percentage). Do not fabricate the figure or document URLs.
- **No `git add -A`; no worktrees; arrow functions; real English copy.**

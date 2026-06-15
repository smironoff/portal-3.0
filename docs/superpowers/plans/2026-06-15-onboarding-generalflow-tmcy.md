# Onboarding GeneralFlow Slice 2 (TMCY / EU individual) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the TMCY (Cyprus/EU) individual GeneralFlow at `/onboarding` with a three-band PASS/REFER/FAIL outcome — PASS completes, REFER shows a confirm/cancel screen, FAIL shows the failure page — reusing the existing GeneralFlow runner + engine.

**Architecture:** Extends the GeneralFlow runner with an `onNext` payload (so the REFER step can pass its outcome) and adds `scoreAll`. New: the TMCY jurisdiction config (`buildTmcySteps`), a `TaxInformationStep`, a `ReferStep`, and `selectFlow`/OnboardingScreen routing for TMCY. Assessment questions reuse the radio `QuestionStep`.

**Tech Stack:** React 19, TS 6 strict, TanStack Router/Query, Zustand, MUI v9, RHF + Zod, Vitest, Playwright. **Node 20** (`source "$HOME/.nvm/nvm.sh" && nvm use`). **Arrow functions only.** Commit with `git add <specific files>` (never `git add -A`). Do NOT create worktrees.

**Spec:** `docs/superpowers/specs/2026-06-15-onboarding-generalflow-tmcy-design.md`
**Legacy reference:** `/Volumes/WORK/ThinkMarkets/portal-2.0/src`.

**Verified legacy contracts:**

- `TMCY_Questions` labels (all values == keys): `sourceWealth`, `turnover`, `incomingFunds`, `education`, `describeTradingStrategy`, `futuresOptionsExperience`, `executedMoreThan10CFDTrades`, `personalProfit`, `useLeverage`, `unwantedMarketMovements`, `appleStocknearMinimumRequiredBalance`, `describeHighVolatility`.
- **TMCY scoring:** sum of **all** answered questions' scores; `PASS >= 21`, `REFER 11..20`, `FAIL < 11` (`TMCY_APPR_TEST_PASS_THRESHOLD = 21`, `TMCY_APPR_TEST_REFER_THRESHOLD = 11`).
- **REFER step:** confirm → submit with `appropriatenessLevel: 'REFER'` (proceeds to terms); cancel → `'FAIL'` (→ failure). `shouldDisplay: draft.appropriatenessLevel === 'REFER'`.
- Tax fields: `taxIdentificationNumber?: string`, `accountHolderNationality?: number`, `accountHolderIdNumber?: string`.
- Domains: `TMCY` and `TMEU` both map to the TMCY config. This slice uses `isTMCY = true` (excludes PEP + FinRole).
- Submit: same `application_submit` (`incrementalSubmit`) as AU; `appropriatenessLevel` carries the band.

---

## Task 1: Engine extension — `scoreAll` + `onNext` payload

**Files:** Modify `src/features/onboarding/engine/scoring.ts` (+ test), `src/features/onboarding/engine/stepConfig.ts`, `src/features/onboarding/flows/general/GeneralFlow.tsx` (+ test).

- [ ] **Step 1: Add a failing test for `scoreAll`** in `engine/scoring.test.ts`:

```ts
import { scoreAll } from './scoring'
// ...reuse the existing `questions` fixture in this file...

it('scoreAll sums every answered question score', () => {
  const details = [
    { question: 1, answer: 12 },
    { question: 2, answer: 22 },
  ] // 5 + 4
  expect(scoreAll(questions, details)).toBe(9)
})
it('scoreAll is 0 with no answers', () => {
  expect(scoreAll(questions, [])).toBe(0)
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `scoreAll`** in `engine/scoring.ts` (append):

```ts
export const scoreAll = (questions: Question[], details: QuestionsIDs[] = []): number =>
  Object.values(getUserAnswers(questions, details)).reduce((acc, a) => acc + (a.score ?? 0), 0)
```

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Change the `onNext` signature** in `engine/stepConfig.ts`:

```ts
import type { AppInfo, Question } from '../api/types' // AppInfo already needed

export interface StepComponentProps {
  onNext: (patch?: Partial<AppInfo>) => void
  onBack?: () => void
  canGoBack: boolean
}
```

(Existing steps call `onNext()` with no argument — still valid.)

- [ ] **Step 6: Update the runner** `flows/general/GeneralFlow.tsx` so `advance` accepts an optional payload and the failure check uses the freshly-passed/computed level (NOT the hydrated draft). Change the `advance` definition:

```ts
const advance = async (override?: Partial<AppInfo>) => {
  if (submitting) return
  setSubmitting(true)
  try {
    let app: Partial<AppInfo> = {
      ...useOnboardingStore.getState().draft,
      applicationId,
      ...override,
    }
    let computedLevel: string | undefined = override?.appropriatenessLevel
    if (step.beforeSubmit) {
      app = await step.beforeSubmit(app, questions)
      computedLevel = app.appropriatenessLevel
    }
    patch(app)
    const res = await incremental.mutateAsync(step.isLast ? { ...app, completed: true } : app)
    if (!CONTINUE_STATUSES.includes(res.applicationStatus) || computedLevel === 'FAIL') {
      setFailed(true)
      return
    }
    if (step.isLast) {
      await queryClient.invalidateQueries({ queryKey: ['application'] })
      return
    }
    setCurrentStep(getNextStep(steps, currentStep, useOnboardingStore.getState().draft))
  } catch {
    notify({ severity: 'error', message: 'onboarding.error.saveFailed' })
  } finally {
    setSubmitting(false)
  }
}
```

(`<Comp onNext={advance} ... />` already wires it; `advance` now accepts the optional override. Keep the existing `submitting`, `questions`, `failed`, `patch`, `notify`, `queryClient` from the prior task.)

- [ ] **Step 7: Confirm `GeneralFlow.test.tsx` still passes**; add a test that an override `onNext({ appropriatenessLevel: 'FAIL' })` from a non-`beforeSubmit` step triggers the failure page:

```ts
it('renders the failure step when a step passes appropriatenessLevel FAIL via onNext', async () => {
  const Cancel = ({ onNext }: StepComponentProps) => (
    <button onClick={() => onNext({ appropriatenessLevel: 'FAIL' })}>Cancel</button>
  )
  const steps: StepField[] = [
    { fields: [], component: Cancel, category: 'assessment', isLast: true },
    { fields: [], component: () => <div>FAILURE PAGE</div>, category: 'assessment', isFailure: true },
  ]
  const { GeneralFlow } = await import('./GeneralFlow')
  render(<GeneralFlow steps={steps} applicationId={1} questions={[]} />, { wrapper })
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
  expect(await screen.findByText('FAILURE PAGE')).toBeInTheDocument()
})
```

- [ ] **Step 8: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/engine/scoring.ts src/features/onboarding/engine/scoring.test.ts src/features/onboarding/engine/stepConfig.ts src/features/onboarding/flows/general/GeneralFlow.tsx src/features/onboarding/flows/general/GeneralFlow.test.tsx
git commit -m "feat(onboarding): scoreAll + onNext payload (runner uses passed/computed level)"
```

---

## Task 2: TMCY constants + tax fields

**Files:** Modify `src/features/onboarding/flows/general/constants.ts`, `src/features/onboarding/api/types.ts`.

- [ ] **Step 1: Add to `constants.ts`:**

```ts
export const TMCY = {
  sourceWealth: 'sourceWealth',
  turnover: 'turnover',
  incomingFunds: 'incomingFunds',
  education: 'education',
  describeTradingStrategy: 'describeTradingStrategy',
  futuresOptionsExperience: 'futuresOptionsExperience',
  executedMoreThan10CFDTrades: 'executedMoreThan10CFDTrades',
  personalProfit: 'personalProfit',
  useLeverage: 'useLeverage',
  unwantedMarketMovements: 'unwantedMarketMovements',
  appleStocknearMinimumRequiredBalance: 'appleStocknearMinimumRequiredBalance',
  describeHighVolatility: 'describeHighVolatility',
} as const

// Ordered TMCY assessment/income questions rendered as steps (the last carries scoring).
export const TMCY_QUESTION_LABELS: string[] = [
  TMCY.sourceWealth,
  TMCY.turnover,
  TMCY.incomingFunds,
  TMCY.education,
  TMCY.describeTradingStrategy,
  TMCY.futuresOptionsExperience,
  TMCY.executedMoreThan10CFDTrades,
  TMCY.personalProfit,
  TMCY.useLeverage,
  TMCY.unwantedMarketMovements,
  TMCY.appleStocknearMinimumRequiredBalance,
  TMCY.describeHighVolatility,
]

export const TMCY_PASS_THRESHOLD = 21
export const TMCY_REFER_THRESHOLD = 11
```

- [ ] **Step 2: Add tax fields to `AppInfo`** in `api/types.ts` (keep existing):

```ts
  taxIdentificationNumber?: string
  accountHolderNationality?: number
  accountHolderIdNumber?: string
  consentAccepted?: string
```

- [ ] **Step 3: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint
git add src/features/onboarding/flows/general/constants.ts src/features/onboarding/api/types.ts
git commit -m "feat(onboarding): TMCY question labels + thresholds + tax AppInfo fields"
```

---

## Task 3: TaxInformationStep

**Files:** Create `src/features/onboarding/steps/TaxInformationStep.tsx`, `steps/TaxInformationStep.test.tsx`.

- [ ] **Step 1: Failing test** `steps/TaxInformationStep.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOnboardingStore } from '../state/onboardingStore'
import { TaxInformationStep } from './TaxInformationStep'

beforeEach(() => useOnboardingStore.getState().reset())

describe('TaxInformationStep', () => {
  it('requires a tax id and writes the fields', async () => {
    const onNext = vi.fn()
    render(<TaxInformationStep onNext={onNext} canGoBack={false} />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/tax id is required/i)).toBeInTheDocument()
    expect(onNext).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/tax identification number/i), 'TAX123')
    await userEvent.type(screen.getByLabelText(/nationality/i), '826')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onNext).toHaveBeenCalled()
    expect(useOnboardingStore.getState().draft).toMatchObject({
      taxIdentificationNumber: 'TAX123',
      accountHolderIdNumber: 'TAX123',
      accountHolderNationality: 826,
    })
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** `steps/TaxInformationStep.tsx` (nationality simplified as a numeric country-id input for now; full dropdown deferred). Note the legacy writes `accountHolderIdNumber` = the tax id value too:

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'

const schema = z.object({
  taxIdentificationNumber: z.string().min(1, 'Tax ID is required'),
  accountHolderNationality: z.coerce.number().int().positive('Nationality is required'),
})
type Values = z.infer<typeof schema>

export const TaxInformationStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      taxIdentificationNumber: draft.taxIdentificationNumber ?? '',
      accountHolderNationality: draft.accountHolderNationality,
    },
  })
  const submit = handleSubmit((v) => {
    patch({
      taxIdentificationNumber: v.taxIdentificationNumber,
      accountHolderIdNumber: v.taxIdentificationNumber,
      accountHolderNationality: v.accountHolderNationality,
    })
    onNext()
  })
  return (
    <StepLayout title="Tax information" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <TextField
        label="Tax identification number"
        error={!!errors.taxIdentificationNumber}
        helperText={errors.taxIdentificationNumber?.message}
        {...register('taxIdentificationNumber')}
      />
      <TextField
        label="Nationality (country code)"
        type="number"
        error={!!errors.accountHolderNationality}
        helperText={errors.accountHolderNationality?.message}
        {...register('accountHolderNationality')}
      />
    </StepLayout>
  )
}
```

NOTE: if `zodResolver` + `z.coerce.number()` typing is awkward (as in PersonalInfoStep), use `z.number()` + `register('accountHolderNationality', { valueAsNumber: true })` to match the existing project pattern. The test asserts a numeric `826`.

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/steps/TaxInformationStep.tsx src/features/onboarding/steps/TaxInformationStep.test.tsx
git commit -m "feat(onboarding): tax information step (tax id + nationality)"
```

---

## Task 4: ReferStep

**Files:** Create `src/features/onboarding/flows/general/ReferStep.tsx`, `flows/general/ReferStep.test.tsx`.

- [ ] **Step 1: Failing test** `flows/general/ReferStep.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReferStep } from './ReferStep'

describe('ReferStep', () => {
  it('confirm proceeds as REFER', async () => {
    const onNext = vi.fn()
    render(<ReferStep onNext={onNext} canGoBack={false} />)
    await userEvent.click(screen.getByRole('button', { name: /i understand|confirm|proceed/i }))
    expect(onNext).toHaveBeenCalledWith({ appropriatenessLevel: 'REFER' })
  })
  it('cancel proceeds as FAIL', async () => {
    const onNext = vi.fn()
    render(<ReferStep onNext={onNext} canGoBack={false} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel|do not proceed/i }))
    expect(onNext).toHaveBeenCalledWith({ appropriatenessLevel: 'FAIL' })
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** `flows/general/ReferStep.tsx`:

```tsx
import { Stack, Typography } from '@mui/material'
import { Button } from '@/components/Button'
import type { StepComponentProps } from '../../engine/stepConfig'

// Shown when the appropriateness score lands in the REFER band. The user must
// explicitly acknowledge the risk to proceed; cancelling fails the application.
export const ReferStep = ({ onNext }: StepComponentProps) => (
  <Stack spacing={2} sx={{ maxWidth: 520 }}>
    <Typography variant="h5">Trading these products may not be appropriate for you</Typography>
    <Typography>
      Based on your responses, CFDs may not be appropriate for you. CFDs are complex instruments and
      come with a high risk of losing money rapidly due to leverage. You can still choose to
      proceed, but please make sure you understand the risks.
    </Typography>
    <Stack direction="row" spacing={1}>
      <Button variant="outlined" onClick={() => onNext({ appropriatenessLevel: 'FAIL' })}>
        Do not proceed
      </Button>
      <Button onClick={() => onNext({ appropriatenessLevel: 'REFER' })}>
        I understand, proceed
      </Button>
    </Stack>
  </Stack>
)
```

(The risk-disclosure wording is included deliberately for a regulated REFER acknowledgement; flag for compliance review of the exact copy.)

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/flows/general/ReferStep.tsx src/features/onboarding/flows/general/ReferStep.test.tsx
git commit -m "feat(onboarding): REFER step (confirm -> REFER / cancel -> FAIL)"
```

---

## Task 5: TMCY jurisdiction config (`buildTmcySteps`)

**Files:** Create `src/features/onboarding/flows/general/jurisdictions/tmcy.ts`, `jurisdictions/tmcy.test.ts`.

- [ ] **Step 1: Failing test** `jurisdictions/tmcy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildTmcySteps } from './tmcy'
import type { Question } from '../../../api/types'

// Two scored questions, one being describeHighVolatility (carries scoring).
const questions: Question[] = [
  {
    id: 1,
    question: 'src',
    label: 'sourceWealth',
    isMandatory: true,
    answers: [
      { id: 1, answer: 'a', label: 'a', score: 5 },
      { id: 2, answer: 'b', label: 'b', score: 15 },
    ],
  },
  {
    id: 2,
    question: 'vol',
    label: 'describeHighVolatility',
    isMandatory: true,
    answers: [
      { id: 3, answer: 'a', label: 'a', score: 5 },
      { id: 4, answer: 'b', label: 'b', score: 10 },
    ],
  },
]

describe('buildTmcySteps', () => {
  it('includes a tax step, a Refer step (REFER shouldDisplay), terms (isLast), failure (isFailure)', () => {
    const steps = buildTmcySteps(questions)
    expect(steps.some((s) => s.isLast)).toBe(true)
    expect(steps.some((s) => s.isFailure)).toBe(true)
    const refer = steps.find((s) => s.category === 'refer')
    expect(refer?.shouldDisplay?.({ appropriatenessLevel: 'REFER' })).toBe(true)
    expect(refer?.shouldDisplay?.({ appropriatenessLevel: 'PASS' })).toBe(false)
  })

  it('the describeHighVolatility step scores over ALL answers into the three bands', async () => {
    const steps = buildTmcySteps(questions)
    const scored = steps.find((s) => s.requiredQuestions?.includes('describeHighVolatility'))!
    // 15 + 10 = 25 -> PASS
    expect(
      (
        await scored.beforeSubmit!(
          {
            accountApplicationQuestionDetails: [
              { question: 1, answer: 2 },
              { question: 2, answer: 4 },
            ],
          },
          questions
        )
      ).appropriatenessLevel
    ).toBe('PASS')
    // 5 + 10 = 15 -> REFER (11..20)
    expect(
      (
        await scored.beforeSubmit!(
          {
            accountApplicationQuestionDetails: [
              { question: 1, answer: 1 },
              { question: 2, answer: 4 },
            ],
          },
          questions
        )
      ).appropriatenessLevel
    ).toBe('REFER')
    // 5 + 5 = 10 -> FAIL (<11)
    expect(
      (
        await scored.beforeSubmit!(
          {
            accountApplicationQuestionDetails: [
              { question: 1, answer: 1 },
              { question: 2, answer: 3 },
            ],
          },
          questions
        )
      ).appropriatenessLevel
    ).toBe('FAIL')
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** `flows/general/jurisdictions/tmcy.ts`:

```ts
import type { StepField } from '../../../engine/stepConfig'
import type { AppInfo, Question } from '../../../api/types'
import { scoreAll } from '../../../engine/scoring'
import {
  TMCY_QUESTION_LABELS,
  TMCY_PASS_THRESHOLD,
  TMCY_REFER_THRESHOLD,
  TMCY,
  EMPLOYED_VALUES,
} from '../constants'
import { PersonalInfoStep } from '../../../steps/PersonalInfoStep'
import { PhoneStep } from '../../../steps/PhoneStep'
import { AddressStep } from '../../../steps/AddressStep'
import { PlatformStep } from '../../../steps/PlatformStep'
import { TermsStep } from '../../../steps/TermsStep'
import { EmploymentStatusStep } from '../../../steps/EmploymentStatusStep'
import { EmployerInfoStep } from '../../../steps/EmployerInfoStep'
import { AnnualIncomeStep } from '../../../steps/AnnualIncomeStep'
import { SavingsStep } from '../../../steps/SavingsStep'
import { TaxInformationStep } from '../../../steps/TaxInformationStep'
import { makeQuestionStep } from '../../../steps/QuestionStep'
import { useQuestionsList } from '../../simplified/useQuestionsList'
import { AppFailed } from '../AppFailed'
import { ReferStep } from '../ReferStep'

const isEmployed = (draft: Partial<AppInfo>) =>
  EMPLOYED_VALUES.includes((draft.accountHolderEmploymentStatus as string) ?? '')

export const buildTmcySteps = (questions: Question[]): StepField[] => {
  const questionSteps: StepField[] = TMCY_QUESTION_LABELS.map((label) => ({
    fields: [],
    requiredQuestions: [label],
    component: makeQuestionStep(label, useQuestionsList),
    category: 'assessment',
    // The last question (describeHighVolatility) scores over ALL answered questions.
    ...(label === TMCY.describeHighVolatility
      ? {
          beforeSubmit: (draft: Partial<AppInfo>) => {
            const score = scoreAll(questions, draft.accountApplicationQuestionDetails ?? [])
            const appropriatenessLevel =
              score >= TMCY_PASS_THRESHOLD
                ? 'PASS'
                : score >= TMCY_REFER_THRESHOLD
                  ? 'REFER'
                  : 'FAIL'
            return { ...draft, appropriatenessLevel }
          },
        }
      : {}),
  }))

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
    { fields: ['approximateIncomeValue'], component: AnnualIncomeStep, category: 'income' },
    { fields: ['estimatedNetWorth'], component: SavingsStep, category: 'income' },
    ...questionSteps,
    {
      fields: [],
      component: ReferStep,
      category: 'refer',
      shouldDisplay: (d) => d.appropriatenessLevel === 'REFER',
      canGoBack: false,
    },
    { fields: ['secondaryConsentAccepted'], component: TermsStep, category: 'terms', isLast: true },
    { fields: [], component: AppFailed, category: 'assessment', isFailure: true },
  ]
}
```

NOTE: `StepCategory` needs `'tax'` and `'refer'` added (in `engine/stepConfig.ts`) — add them in this task. The `appropriatenessLevel` ternary must be typed as `'PASS' | 'REFER' | 'FAIL'`; cast literals `as const`/annotate if TS widens to `string`.

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/flows/general/jurisdictions/tmcy.ts src/features/onboarding/flows/general/jurisdictions/tmcy.test.ts src/features/onboarding/engine/stepConfig.ts
git commit -m "feat(onboarding): TMCY jurisdiction config + three-band scoring + tax/refer categories"
```

---

## Task 6: Flow selection (+TMCY) + OnboardingScreen jurisdiction → builder

**Files:** Modify `src/features/onboarding/flowSelection.ts` (+ test), `src/features/onboarding/OnboardingScreen.tsx`.

- [ ] **Step 1: Extend the failing test** in `flowSelection.test.ts`:

```ts
it('routes TMCY and TMEU to general TMCY', () => {
  expect(selectFlow({ portalAccountDomain: 'TMCY' })).toEqual({
    kind: 'general',
    jurisdiction: 'TMCY',
  })
  expect(selectFlow({ portalAccountDomain: 'TMEU' })).toEqual({
    kind: 'general',
    jurisdiction: 'TMCY',
  })
})
```

(Keep the existing AU / simplified / unsupported / no-domain cases.)

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Update** `flowSelection.ts`:

```ts
export type FlowSelection =
  | { kind: 'simplified' }
  | { kind: 'general'; jurisdiction: 'AU' | 'TMCY' }
  | { kind: 'unsupported'; domain?: string }

// ... in selectFlow:
if (domain === 'AU') return { kind: 'general', jurisdiction: 'AU' }
if (domain === 'TMCY' || domain === 'TMEU') return { kind: 'general', jurisdiction: 'TMCY' }
if (domain && SIMPLIFIED_DOMAINS.includes(domain)) return { kind: 'simplified' }
if (!domain) return { kind: 'simplified' }
return { kind: 'unsupported', domain }
```

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Update `OnboardingScreen.tsx`** to map the jurisdiction → its builder. Where it currently builds AU steps for the general branch, select the builder:

```tsx
import { buildAuSteps } from './flows/general/jurisdictions/au'
import { buildTmcySteps } from './flows/general/jurisdictions/tmcy'
// ...
const builders = { AU: buildAuSteps, TMCY: buildTmcySteps } as const
// in the general branch (questions already loaded; render "Loading questions..." if empty):
const steps = useMemo(() => builders[flow.jurisdiction](questions), [flow.jurisdiction, questions])
return <GeneralFlow steps={steps} applicationId={app.applicationId} questions={questions} />
```

Keep `useQuestionsList()`/`useMemo` at the top level (rules of hooks); only consume in the general branch. Ensure existing AU + simplified tests still pass.

- [ ] **Step 6: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/flowSelection.ts src/features/onboarding/flowSelection.test.ts src/features/onboarding/OnboardingScreen.tsx
git commit -m "feat(onboarding): selectFlow + OnboardingScreen route TMCY/TMEU to TMCY GeneralFlow"
```

---

## Task 7: Playwright e2e (TMCY wiring)

**Files:** Create `e2e/onboarding-tmcy.spec.ts`.

- [ ] **Step 1: Write the e2e** (model on `e2e/onboarding-au.spec.ts`): log in; `**/nsdata` by action — `get_user` (profile), `getLastApplicationsInfo` → `[{ applicationId: 1, status: 'INCOMPLETE', portalAccountDomain: 'TMCY', organizationId: 1 }]`, `getQuestions` → a non-empty set (include `describeHighVolatility` + others), `application_submit` → `{ applicationStatus: 'INCOMPLETE', applicationId: 1 }`. Assert the user lands on `/onboarding`, the GeneralFlow renders "Personal information", then progresses to "Phone number". (The PASS/REFER/FAIL scoring is unit/integration-covered; this proves the TMCY wiring/progression. `organizationId` is required so the questions query is enabled.)

- [ ] **Step 2: Run** `npm run e2e` — all specs (auth, onboarding, onboarding-au, onboarding-tmcy) pass. Adjust selectors as needed.

- [ ] **Step 3: Commit**

```bash
git add e2e/onboarding-tmcy.spec.ts
git commit -m "test(onboarding): TMCY GeneralFlow wiring e2e"
```

---

## Task 8: Security/compliance gate + final verification

- [ ] **Step 1: Full verification** under Node 20: `npm run lint && npm run test && npm run build && npm run e2e` — all green. Confirm no stray `.claude/worktrees/` dir.
- [ ] **Step 2: Security/compliance review** of the new TMCY code. Checklist: three-band scoring correct (PASS 21 / REFER 11 / FAIL); REFER confirm/cancel sets the right level and the runner uses the passed level (not stale draft); FAIL/cancel reliably reach the failure page with no bypass to completion; no PII/answers logged; tax id handled safely; the `appropriatenessLevel` client-trust remains a backend follow-up; REFER risk-notice copy flagged for compliance wording review; no secret committed.
- [ ] **Step 3: Push:** `git push origin main`.
- [ ] **Step 4: Confirm DoD** against the spec.

---

## Notes for the implementer

- **TMCY scores ALL answered questions** (via `scoreAll`), unlike AU (additional only). Thresholds 21 / 11 verified.
- **`StepCategory`** needs `'tax'` and `'refer'` added (Task 5).
- **REFER routing** relies on the Task 1 `onNext` payload; the runner must use `override?.appropriatenessLevel ?? computedLevel` (never the hydrated draft).
- **Deferred** (TMEU PEP/FinRole, FundCountry, FieldsOfStudy detail, France/Spain consent, full nationality dropdown, 'other' free-text) — do not build; they are tracked follow-ups.
- **REFER copy** includes a leveraged-products risk warning per the regulated context; the exact wording needs compliance sign-off (flag, do not block).
- **i18n:** use real English copy; no placeholders. **Do not `git add -A`; no worktrees.**

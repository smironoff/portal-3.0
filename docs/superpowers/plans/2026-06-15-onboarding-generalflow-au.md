# Onboarding GeneralFlow Slice 1 (AU individual) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the AU individual GeneralFlow at `/onboarding` for an authenticated user — personal/contact/financial steps, the appropriateness assessment (KOQ + dynamic questions), PASS/FAIL scoring at the threshold, and either completion (→ `PENDING_KYC` stub) or the AU failure page — on a reusable GeneralFlow runner + scoring engine.

**Architecture:** Extends the slice-1 onboarding engine/store/API. New: a pure scoring engine, new shared select-steps, the AU jurisdiction config (`buildAuSteps(questions)`), the `GeneralFlow` runner, and `selectFlow(app)`. Assessment questions reuse the slice-1 radio `QuestionStep`; scoring is a pure `beforeSubmit` hook.

**Tech Stack:** React 19, TS 6 strict, TanStack Router/Query, Zustand, MUI v9, RHF + Zod, Vitest, Playwright. **Node 20** (`source "$HOME/.nvm/nvm.sh" && nvm use`). **Arrow functions only.** Commit with `git add <specific files>` (never `git add -A` — `.claude/worktrees/` must never be staged). Do NOT create worktrees.

**Spec:** `docs/superpowers/specs/2026-06-15-onboarding-generalflow-au-design.md`
**Legacy reference:** `/Volumes/WORK/ThinkMarkets/portal-2.0/src`.

**Verified legacy contracts:**

- AU assessment question labels (`utils/questions.ts` `AU_Questions`): `KOQHardship`, `KOQHoldCFD`, `KOQCFDAccount`, `NKOQRiskAmount`, `KOQRiskAppetite = "KOQRiskAppetiteCFD"` (value differs from key), `KOQRiskFinancial`, `KOQLosingTrade`, `KOQVulnerability`.
- **AU scoring:** sum of the **additional (non-mandatory) questions' scores only** (the 7 KOQ are recorded but not summed); `appropriatenessLevel = total >= 8 ? 'PASS' : 'FAIL'` (`AU_APPR_TEST_PASS_THRESHOLD = 8`). `getUserAnswers` maps `details[].answer` → the question's `answers[].score`.
- `EmploymentStatus` enum (`utils/enums.ts`): `Employed='Employed'`, `Unemployed='Unemployed'`, `SelfEmployed='Self employed'`, `Retired='Retired'`, `Student='Student'`, `HousewifeOrHousehusband='Housewife/Househusband'`, `Others='Others'`.
- AU money options (income + savings, `individualMoneyOptionsAU`): values `'500,000+'`, `'250,001 - 500,000'`, `'150,001 - 250,000'`, `'75,001 - 150,000'`, `'35,001 - 75,000'`, `'20,001 - 35,000'`, `'< 20,000'` (last is a knockout).
- AU source-of-funds values: `'Employment'`, `'Self-employment'`, `'Inheritance'`, `'Savings and Investments'`, `'Social security payments and/or borrowings'`, `'Passive income'`.
- AppInfo fields: `accountHolderEmploymentStatus`, `employmentStatus`, `occupation`, `industry`, `employerName`, `sourceOfFunds`, `approximateIncomeValue`, `estimatedNetWorth` (all string); `portalAccountDomain?: PortalAccountDomain`.
- `PortalAccountDomain` enum: `AU, UK, TFSA, TMBM, TMSY, TMCY, TMEU, TMJP, TMNZ, TMLC`.
- `completeGeneral`: sets `completed: true`, defaults `appropriatenessLevel = 'PASS'` if unset, defaults AU platform to ThinkTrader/leverage 30/AUD, then calls `incrementalSubmit` (`application_submit`) — NOT a separate endpoint.
- Failure detection: `continueStatuses = ['INCOMPLETE','PENDING_APPROPRIATENESS_TEST']`; fail if status not in that set OR `appropriatenessLevel === 'FAIL'`.
- AU failure contact link: `https://www.thinkmarkets.com/au/support/contact-us/`.

---

## Task 1: Scoring engine

**Files:** Create `src/features/onboarding/engine/scoring.ts`, `engine/scoring.test.ts`.

- [ ] **Step 1: Failing test** `engine/scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getUserAnswers, scoreAssessment } from './scoring'
import type { Question } from '../api/types'

const questions: Question[] = [
  {
    id: 1,
    question: 'Q1',
    label: 'a1',
    answers: [
      { id: 11, answer: 'low', label: 'low', score: 2 },
      { id: 12, answer: 'high', label: 'high', score: 5 },
    ],
  },
  {
    id: 2,
    question: 'Q2',
    label: 'a2',
    answers: [
      { id: 21, answer: 'no', label: 'no', score: 0 },
      { id: 22, answer: 'yes', label: 'yes', score: 4 },
    ],
  },
]

describe('scoring', () => {
  it('getUserAnswers maps answered details to label -> score', () => {
    const map = getUserAnswers(questions, [
      { question: 1, answer: 12 },
      { question: 2, answer: 21 },
    ])
    expect(map.a1?.score).toBe(5)
    expect(map.a2?.score).toBe(0)
  })

  it('scoreAssessment sums scores over the given labels', () => {
    const details = [
      { question: 1, answer: 12 },
      { question: 2, answer: 22 },
    ]
    expect(scoreAssessment(questions, details, ['a1', 'a2'])).toBe(9)
    expect(scoreAssessment(questions, details, ['a1'])).toBe(5)
  })

  it('treats unanswered/unknown labels as 0', () => {
    expect(scoreAssessment(questions, [], ['a1', 'a2'])).toBe(0)
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** `engine/scoring.ts`:

```ts
import type { Question, QuestionsIDs } from '../api/types'

export interface UserAnswer {
  answerId?: number
  answerLabel?: string
  others?: string
  score: number
}

export const getUserAnswers = (
  questions: Question[],
  details: QuestionsIDs[] = []
): Record<string, UserAnswer> => {
  const result: Record<string, UserAnswer> = {}
  for (const detail of details) {
    const question = questions.find((q) => q.id === detail.question)
    if (!question) continue
    const answer = question.answers.find((a) => a.id === detail.answer)
    result[question.label] = {
      answerId: answer?.id,
      answerLabel: answer?.label,
      others: detail.others,
      score: answer?.score ?? 0,
    }
  }
  return result
}

export const scoreAssessment = (
  questions: Question[],
  details: QuestionsIDs[] = [],
  labels: string[]
): number => {
  const answers = getUserAnswers(questions, details)
  return labels.reduce((acc, label) => acc + (answers[label]?.score ?? 0), 0)
}
```

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/engine/scoring.ts src/features/onboarding/engine/scoring.test.ts
git commit -m "feat(onboarding): appropriateness scoring engine (pure)"
```

---

## Task 2: Types + AU constants

**Files:** Modify `src/features/onboarding/api/types.ts`. Create `src/features/onboarding/flows/general/constants.ts`.

- [ ] **Step 1: Extend `AppInfo`** in `api/types.ts` — add the financial/employment + domain fields (keep existing):

```ts
  // employment / financial
  accountHolderEmploymentStatus?: string
  employmentStatus?: string
  occupation?: string
  industry?: string
  employerName?: string
  sourceOfFunds?: string
  approximateIncomeValue?: string
  estimatedNetWorth?: string
  // jurisdiction
  portalAccountDomain?: string
```

- [ ] **Step 2: Implement** `src/features/onboarding/flows/general/constants.ts`:

```ts
// AU assessment question labels (verbatim from legacy AU_Questions; note the
// KOQRiskAppetite value differs from its key).
export const AU = {
  KOQHardship: 'KOQHardship',
  KOQHoldCFD: 'KOQHoldCFD',
  KOQCFDAccount: 'KOQCFDAccount',
  NKOQRiskAmount: 'NKOQRiskAmount',
  KOQRiskAppetite: 'KOQRiskAppetiteCFD',
  KOQRiskFinancial: 'KOQRiskFinancial',
  KOQLosingTrade: 'KOQLosingTrade',
  KOQVulnerability: 'KOQVulnerability',
} as const

// The mandatory KOQ assessment questions shown in order (KOQHardship first).
export const AU_KOQ_LABELS: string[] = [
  AU.KOQHardship,
  AU.KOQHoldCFD,
  AU.KOQCFDAccount,
  AU.NKOQRiskAmount,
  AU.KOQRiskAppetite,
  AU.KOQRiskFinancial,
  AU.KOQLosingTrade,
  AU.KOQVulnerability,
]

export const AU_PASS_THRESHOLD = 8

export const EMPLOYMENT_OPTIONS = [
  { label: 'Employed', value: 'Employed' },
  { label: 'Self employed', value: 'Self employed' },
  { label: 'Unemployed', value: 'Unemployed' },
  { label: 'Retired', value: 'Retired' },
  { label: 'Student', value: 'Student' },
  { label: 'Other', value: 'Others' },
]
// Employment statuses that require employer details.
export const EMPLOYED_VALUES = ['Employed', 'Self employed']

export const AU_MONEY_OPTIONS = [
  { label: '500,000+', value: '500,000+' },
  { label: '250,001 - 500,000', value: '250,001 - 500,000' },
  { label: '150,001 - 250,000', value: '150,001 - 250,000' },
  { label: '75,001 - 150,000', value: '75,001 - 150,000' },
  { label: '35,001 - 75,000', value: '35,001 - 75,000' },
  { label: '20,001 - 35,000', value: '20,001 - 35,000' },
  { label: 'Less than 20,000', value: '< 20,000' },
]

export const AU_SOURCE_OF_FUNDS_OPTIONS = [
  { label: 'Employment', value: 'Employment' },
  { label: 'Self-employment', value: 'Self-employment' },
  { label: 'Inheritance', value: 'Inheritance' },
  { label: 'Savings and Investments', value: 'Savings and Investments' },
  {
    label: 'Social security payments and/or borrowings',
    value: 'Social security payments and/or borrowings',
  },
  { label: 'Passive income', value: 'Passive income' },
]

export const AU_CONTACT_US_LINK = 'https://www.thinkmarkets.com/au/support/contact-us/'
```

- [ ] **Step 3: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint
git add src/features/onboarding/api/types.ts src/features/onboarding/flows/general/constants.ts
git commit -m "feat(onboarding): AppInfo financial/domain fields + AU constants"
```

---

## Task 3: Employment + financial select steps

Five RHF + select steps following the slice-1 `PlatformStep` pattern (MUI `TextField select` via RHF `Controller`, write the store draft, call `onNext`). EmployerInfo is conditional via the AU config's `shouldDisplay` (the component itself is unconditional).

**Files:** Create `src/features/onboarding/steps/EmploymentStatusStep.tsx`, `EmployerInfoStep.tsx`, `SourceOfFundsStep.tsx`, `AnnualIncomeStep.tsx`, `SavingsStep.tsx`. Test `steps/EmploymentStatusStep.test.tsx`.

- [ ] **Step 1: Failing test** `steps/EmploymentStatusStep.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOnboardingStore } from '../state/onboardingStore'
import { EmploymentStatusStep } from './EmploymentStatusStep'

beforeEach(() => useOnboardingStore.getState().reset())

describe('EmploymentStatusStep', () => {
  it('defaults to a valid selection, writes both fields, advances', async () => {
    const onNext = vi.fn()
    render(<EmploymentStatusStep onNext={onNext} canGoBack={false} />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onNext).toHaveBeenCalled()
    const draft = useOnboardingStore.getState().draft
    expect(draft.accountHolderEmploymentStatus).toBeTruthy()
    expect(draft.employmentStatus).toBe(draft.accountHolderEmploymentStatus)
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** `steps/EmploymentStatusStep.tsx` (writes BOTH `accountHolderEmploymentStatus` and `employmentStatus` to the same value, matching legacy):

```tsx
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField, MenuItem } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'
import { EMPLOYMENT_OPTIONS } from '../flows/general/constants'

const schema = z.object({ employment: z.string().min(1, 'Required') })
type Values = z.infer<typeof schema>

export const EmploymentStatusStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employment: draft.accountHolderEmploymentStatus ?? EMPLOYMENT_OPTIONS[0]!.value,
    },
  })
  const submit = handleSubmit((v) => {
    patch({ accountHolderEmploymentStatus: v.employment, employmentStatus: v.employment })
    onNext()
  })
  return (
    <StepLayout title="Employment status" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <Controller
        name="employment"
        control={control}
        render={({ field }) => (
          <TextField select label="Employment status" {...field}>
            {EMPLOYMENT_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
    </StepLayout>
  )
}
```

- [ ] **Step 4: Run the test, verify PASS.**

- [ ] **Step 5: Implement the other four steps** (same Controller+select or text pattern):

`SourceOfFundsStep.tsx` — field `sourceOfFunds`, options `AU_SOURCE_OF_FUNDS_OPTIONS`, title "Source of funds". Default to the first option; `patch({ sourceOfFunds })`.

`AnnualIncomeStep.tsx` — field `approximateIncomeValue`, options `AU_MONEY_OPTIONS`, title "Annual income". Default first; `patch({ approximateIncomeValue })`.

`SavingsStep.tsx` — field `estimatedNetWorth`, options `AU_MONEY_OPTIONS`, title "Estimated net worth". Default first; `patch({ estimatedNetWorth })`.

`EmployerInfoStep.tsx` — three free-text `TextField`s for `occupation`, `industry`, `employerName` (all required, `z.string().min(1)`), title "Employer information"; `patch(v)` on submit. (Conditionality is handled by the AU config's `shouldDisplay`, not here.)

- [ ] **Step 6: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/steps/EmploymentStatusStep.tsx src/features/onboarding/steps/EmploymentStatusStep.test.tsx src/features/onboarding/steps/EmployerInfoStep.tsx src/features/onboarding/steps/SourceOfFundsStep.tsx src/features/onboarding/steps/AnnualIncomeStep.tsx src/features/onboarding/steps/SavingsStep.tsx
git commit -m "feat(onboarding): employment + financial select steps"
```

---

## Task 4: AU failure page + unsupported-jurisdiction component

**Files:** Create `src/features/onboarding/flows/general/AppFailed.tsx`, `src/features/onboarding/flows/JurisdictionNotAvailable.tsx`.

- [ ] **Step 1: Implement** `flows/general/AppFailed.tsx` (matches `StepComponentProps` so it can be the `isFailure` step component; navigation props are unused):

```tsx
import { Stack, Typography, Link } from '@mui/material'
import { AU_CONTACT_US_LINK } from './constants'
import type { StepComponentProps } from '../../engine/stepConfig'

// Shown when the appropriateness assessment fails or a terminal status is returned.
export const AppFailed = (_props: StepComponentProps) => (
  <Stack spacing={2} sx={{ maxWidth: 480 }}>
    <Typography variant="h5">We are unable to open your account</Typography>
    <Typography>
      Based on your responses, trading these products may not be appropriate for you, so we cannot
      proceed with your application at this time.
    </Typography>
    <Typography>
      If you believe this is incorrect, please{' '}
      <Link href={AU_CONTACT_US_LINK} target="_blank" rel="noopener noreferrer">
        contact our support team
      </Link>
      .
    </Typography>
  </Stack>
)
```

- [ ] **Step 2: Implement** `flows/JurisdictionNotAvailable.tsx`:

```tsx
import { Stack, Typography } from '@mui/material'

export const JurisdictionNotAvailable = ({ domain }: { domain?: string }) => (
  <Stack spacing={2} sx={{ maxWidth: 480 }}>
    <Typography variant="h5">Onboarding not yet available</Typography>
    <Typography>
      Online onboarding for your region{domain ? ` (${domain})` : ''} is not available yet. Please
      contact support to continue.
    </Typography>
  </Stack>
)
```

- [ ] **Step 3: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint
git add src/features/onboarding/flows/general/AppFailed.tsx src/features/onboarding/flows/JurisdictionNotAvailable.tsx
git commit -m "feat(onboarding): AU failure page + unsupported-jurisdiction screen"
```

---

## Task 5: AU jurisdiction config (`buildAuSteps`)

Builds the ordered AU `StepField[]` from the loaded questions, appending the backend's additional (non-mandatory) questions and attaching the scoring `beforeSubmit` (over the additional labels only) to the last additional assessment step.

**Files:** Create `src/features/onboarding/flows/general/jurisdictions/au.ts`. Test `jurisdictions/au.test.ts`.

- [ ] **Step 1: Failing test** `jurisdictions/au.test.ts` (focus on scoring + structure):

```ts
import { describe, it, expect } from 'vitest'
import { buildAuSteps } from './au'
import type { Question } from '../../../api/types'

const additional: Question[] = [
  {
    id: 100,
    question: 'extra1',
    label: 'extra1',
    isMandatory: false,
    answers: [
      { id: 1, answer: 'a', label: 'a', score: 3 },
      { id: 2, answer: 'b', label: 'b', score: 6 },
    ],
  },
  {
    id: 101,
    question: 'extra2',
    label: 'extra2',
    isMandatory: false,
    answers: [
      { id: 3, answer: 'a', label: 'a', score: 2 },
      { id: 4, answer: 'b', label: 'b', score: 5 },
    ],
  },
]

describe('buildAuSteps', () => {
  it('produces a terms step (isLast) and a failure step (isFailure)', () => {
    const steps = buildAuSteps(additional)
    expect(steps.some((s) => s.isLast)).toBe(true)
    expect(steps.some((s) => s.isFailure)).toBe(true)
  })

  it('the last additional question carries a scoring beforeSubmit (PASS at >= 8)', async () => {
    const steps = buildAuSteps(additional)
    const scored = [...steps].reverse().find((s) => s.beforeSubmit)
    expect(scored).toBeTruthy()
    // both additional at max score: 6 + 5 = 11 >= 8 -> PASS
    const draft = {
      accountApplicationQuestionDetails: [
        { question: 100, answer: 2 },
        { question: 101, answer: 4 },
      ],
    }
    const out = await scored!.beforeSubmit!(draft, additional)
    expect(out.appropriatenessLevel).toBe('PASS')
    // both minimum: 3 + 2 = 5 < 8 -> FAIL
    const draft2 = {
      accountApplicationQuestionDetails: [
        { question: 100, answer: 1 },
        { question: 101, answer: 3 },
      ],
    }
    const out2 = await scored!.beforeSubmit!(draft2, additional)
    expect(out2.appropriatenessLevel).toBe('FAIL')
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** `flows/general/jurisdictions/au.ts`:

```ts
import type { StepField } from '../../../engine/stepConfig'
import type { AppInfo, Question } from '../../../api/types'
import { scoreAssessment } from '../../../engine/scoring'
import { AU_KOQ_LABELS, AU_PASS_THRESHOLD } from '../constants'
import { PersonalInfoStep } from '../../../steps/PersonalInfoStep'
import { PhoneStep } from '../../../steps/PhoneStep'
import { PlatformStep } from '../../../steps/PlatformStep'
import { AddressStep } from '../../../steps/AddressStep'
import { TermsStep } from '../../../steps/TermsStep'
import { EmploymentStatusStep } from '../../../steps/EmploymentStatusStep'
import { EmployerInfoStep } from '../../../steps/EmployerInfoStep'
import { SourceOfFundsStep } from '../../../steps/SourceOfFundsStep'
import { AnnualIncomeStep } from '../../../steps/AnnualIncomeStep'
import { SavingsStep } from '../../../steps/SavingsStep'
import { makeQuestionStep } from '../../../steps/QuestionStep'
import { useQuestionsList } from '../../simplified/useQuestionsList'
import { AppFailed } from '../AppFailed'
import { EMPLOYED_VALUES } from '../constants'

const isEmployed = (draft: Partial<AppInfo>) =>
  EMPLOYED_VALUES.includes((draft.accountHolderEmploymentStatus as string) ?? '')

export const buildAuSteps = (questions: Question[]): StepField[] => {
  const additional = questions.filter((q) => q.isMandatory === false)
  const additionalLabels = additional.map((q) => q.label)

  const koqSteps: StepField[] = AU_KOQ_LABELS.map((label) => ({
    fields: [],
    requiredQuestions: [label],
    component: makeQuestionStep(label, useQuestionsList),
    category: 'assessment',
  }))

  const additionalSteps: StepField[] = additional.map((q, idx) => ({
    fields: [],
    requiredQuestions: [q.label],
    component: makeQuestionStep(q.label, useQuestionsList),
    category: 'assessment',
    // The last additional question computes the appropriateness level from the
    // additional-question scores only (matches legacy TMAU).
    ...(idx === additional.length - 1
      ? {
          beforeSubmit: (draft: Partial<AppInfo>) => ({
            ...draft,
            appropriatenessLevel:
              scoreAssessment(
                questions,
                draft.accountApplicationQuestionDetails ?? [],
                additionalLabels
              ) >= AU_PASS_THRESHOLD
                ? 'PASS'
                : 'FAIL',
          }),
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
    {
      fields: ['selectedPlatform', 'platformAccountType', 'leverage', 'accountCurrency'],
      component: PlatformStep,
      category: 'platform',
    },
    { fields: ['accountHolderPostalCode'], component: AddressStep, category: 'address' },
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
    ...koqSteps,
    ...additionalSteps,
    { fields: ['secondaryConsentAccepted'], component: TermsStep, category: 'terms', isLast: true },
    { fields: [], component: AppFailed, category: 'assessment', isFailure: true },
  ]
}
```

NOTE: `StepCategory` currently lacks `'employment'` and `'income'` — add those two members to the `StepCategory` union in `src/features/onboarding/engine/stepConfig.ts` as part of this task. Also add `isFailure?: boolean` to the `StepField` interface there.

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/flows/general/jurisdictions/au.ts src/features/onboarding/flows/general/jurisdictions/au.test.ts src/features/onboarding/engine/stepConfig.ts
git commit -m "feat(onboarding): AU jurisdiction config + scoring beforeSubmit + StepField isFailure/categories"
```

---

## Task 6: GeneralFlow runner

**Files:** Create `src/features/onboarding/flows/general/GeneralFlow.tsx`. Test `flows/general/GeneralFlow.test.tsx`.

- [ ] **Step 1: Failing test** `flows/general/GeneralFlow.test.tsx` — drive a tiny 2-step config (one normal step + a failure step) to assert (a) advancing submits incrementally and (b) a FAIL `beforeSubmit` renders the failure component. Use a hand-built `StepField[]` to keep it focused:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useOnboardingStore } from '../../state/onboardingStore'
import type { StepField, StepComponentProps } from '../../engine/stepConfig'

const incremental = vi.fn().mockResolvedValue({ applicationStatus: 'INCOMPLETE', applicationId: 1 })
vi.mock('../../api/onboardingQueries', () => ({
  useIncrementalSubmit: () => ({ mutateAsync: incremental }),
}))

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const Ok = ({ onNext }: StepComponentProps) => <button onClick={onNext}>Continue</button>
const Fail = () => <div>FAILURE PAGE</div>

beforeEach(() => {
  useOnboardingStore.getState().reset()
  incremental.mockClear()
})

describe('GeneralFlow', () => {
  it('renders the failure step when a beforeSubmit sets appropriatenessLevel FAIL', async () => {
    const steps: StepField[] = [
      {
        fields: [],
        component: Ok,
        category: 'assessment',
        isLast: true,
        beforeSubmit: (d) => ({ ...d, appropriatenessLevel: 'FAIL' }),
      },
      { fields: [], component: Fail, category: 'assessment', isFailure: true },
    ]
    const { GeneralFlow } = await import('./GeneralFlow')
    render(<GeneralFlow steps={steps} applicationId={1} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText('FAILURE PAGE')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** `flows/general/GeneralFlow.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { getNextStep, getPreviousStep, getStartingStep } from '../../engine/stepMachine'
import { useOnboardingStore } from '../../state/onboardingStore'
import { useIncrementalSubmit } from '../../api/onboardingQueries'
import { useNotificationStore } from '@/state/notificationStore'
import { useQueryClient } from '@tanstack/react-query'
import type { StepField } from '../../engine/stepConfig'

const CONTINUE_STATUSES = ['INCOMPLETE', 'PENDING_APPROPRIATENESS_TEST']

export const GeneralFlow = ({
  steps,
  applicationId,
}: {
  steps: StepField[]
  applicationId?: number
}) => {
  const draft = useOnboardingStore((s) => s.draft)
  const currentStep = useOnboardingStore((s) => s.currentStep)
  const setCurrentStep = useOnboardingStore((s) => s.setCurrentStep)
  const patch = useOnboardingStore((s) => s.patch)
  const incremental = useIncrementalSubmit()
  const notify = useNotificationStore((s) => s.push)
  const queryClient = useQueryClient()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setCurrentStep(getStartingStep(steps, -1, useOnboardingStore.getState().draft, []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length])

  if (failed) {
    const failStep = steps.find((s) => s.isFailure)
    if (failStep) {
      const F = failStep.component
      return <F onNext={() => {}} canGoBack={false} />
    }
  }

  if (currentStep < 0 || currentStep >= steps.length) return <Typography>Loading...</Typography>
  const step = steps[currentStep]!
  if (step.isFailure) return <Typography>Loading...</Typography>
  const Comp = step.component

  const advance = async () => {
    try {
      let app: Partial<typeof draft> = { ...useOnboardingStore.getState().draft, applicationId }
      if (step.beforeSubmit) {
        app = await step.beforeSubmit(app, [])
        patch(app)
      }
      const res = await incremental.mutateAsync(step.isLast ? { ...app, completed: true } : app)
      const status = res.applicationStatus
      if (!CONTINUE_STATUSES.includes(status) || app.appropriatenessLevel === 'FAIL') {
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
    }
  }

  const back = () => setCurrentStep(getPreviousStep(steps, currentStep, draft))

  return (
    <Stack spacing={2}>
      <Comp onNext={advance} onBack={back} canGoBack={step.canGoBack ?? true} />
    </Stack>
  )
}
```

NOTE: `beforeSubmit` is called with `[]` for questions here because the scoring closure in `buildAuSteps` already captured the questions list. If you prefer to pass the live questions, thread them through as a prop; the AU `beforeSubmit` ignores its 2nd arg (it closes over `questions`). Keep the captured-closure approach.

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/flows/general/GeneralFlow.tsx src/features/onboarding/flows/general/GeneralFlow.test.tsx
git commit -m "feat(onboarding): GeneralFlow runner (beforeSubmit, incremental submit, failure detection)"
```

---

## Task 7: Flow selection + OnboardingScreen wiring

**Files:** Create `src/features/onboarding/flowSelection.ts`. Modify `src/features/onboarding/OnboardingScreen.tsx`. Test `flowSelection.test.ts`.

- [ ] **Step 1: Failing test** `flowSelection.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { selectFlow } from './flowSelection'

describe('selectFlow', () => {
  it('routes AU to general', () => {
    expect(selectFlow({ portalAccountDomain: 'AU' })).toEqual({
      kind: 'general',
      jurisdiction: 'AU',
    })
  })
  it('routes a simplified domain to simplified', () => {
    expect(selectFlow({ portalAccountDomain: 'TMLC' })).toEqual({ kind: 'simplified' })
  })
  it('routes unsupported domains to not-available', () => {
    expect(selectFlow({ portalAccountDomain: 'UK' })).toEqual({ kind: 'unsupported', domain: 'UK' })
  })
})
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement** `flowSelection.ts`:

```ts
import type { AppInfo } from './api/types'

export type FlowSelection =
  | { kind: 'simplified' }
  | { kind: 'general'; jurisdiction: 'AU' }
  | { kind: 'unsupported'; domain?: string }

// Domains that use the simplified two-level flow (slice 1). Extend as jurisdictions land.
const SIMPLIFIED_DOMAINS = ['TMLC', 'TMBM']

export const selectFlow = (app: Partial<AppInfo>): FlowSelection => {
  const domain = app.portalAccountDomain
  if (domain === 'AU') return { kind: 'general', jurisdiction: 'AU' }
  if (domain && SIMPLIFIED_DOMAINS.includes(domain)) return { kind: 'simplified' }
  // Default for slice-1 dev (no domain) stays simplified so existing behaviour holds.
  if (!domain) return { kind: 'simplified' }
  return { kind: 'unsupported', domain }
}
```

NOTE: confirm the simplified-vs-general rule against the legacy `useSimplifyOnboardingCheck` (it keys off `country.isSimplifyOnboarding` and UAE/SA + TMLC, not purely the domain). For this slice the domain-based mapping above is sufficient; refine when more jurisdictions land.

- [ ] **Step 4: Wire `OnboardingScreen`** to use `selectFlow`. When the active application is in a flow-running state (not the interstitial/processing states already handled), branch:
- `general` → render `<GeneralFlow steps={buildAuSteps(questions)} applicationId={app.applicationId} />`, where `questions = useQuestionsList()`; if `questions` is empty, show "Loading questions...".
- `simplified` → render `<SimplifiedFlow .../>` as today.
- `unsupported` → render `<JurisdictionNotAvailable domain={...} />`.
  Keep the existing `LEVEL1_APPROVED` interstitial and `PENDING_KYC`/processing handling. Run, verify PASS, ensure the existing OnboardingScreen/SimplifiedFlow tests still pass.

- [ ] **Step 5: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add src/features/onboarding/flowSelection.ts src/features/onboarding/flowSelection.test.ts src/features/onboarding/OnboardingScreen.tsx
git commit -m "feat(onboarding): selectFlow + OnboardingScreen routes AU to GeneralFlow"
```

---

## Task 8: Playwright e2e (AU PASS + FAIL)

**Files:** Create `e2e/onboarding-au.spec.ts`.

- [ ] **Step 1: Write the e2e** — log in, land on `/onboarding` with an AU application, walk to the assessment, and assert PASS completes vs FAIL shows the failure page. Intercept `**/nsdata` by `payload[0].action`. `getLastApplicationsInfo` returns `{ applicationId, status: 'INCOMPLETE', portalAccountDomain: 'AU' }`; `getQuestions` returns the KOQ + one additional scored question; `application_submit` echoes `{ applicationStatus: 'INCOMPLETE' }` until the scored step, then drive PASS/FAIL by the chosen answer. Two tests: a high-score answer → reaches terms/completes; a low-score answer → failure page. Keep selectors aligned with the step titles/labels. Use the same `tfboOk(action, result)` helper and `--mode test` HTTP setup as `e2e/onboarding.spec.ts`.

(Write the spec concretely against the implemented step labels; model it on `e2e/onboarding.spec.ts`. The minimum bar: the AU flow renders the employment/financial/assessment steps and a FAIL answer set renders "We are unable to open your account".)

- [ ] **Step 2: Run** `npm run e2e` — all specs pass. Adjust selectors as needed.

- [ ] **Step 3: Commit**

```bash
git add e2e/onboarding-au.spec.ts
git commit -m "test(onboarding): AU GeneralFlow PASS + FAIL e2e"
```

---

## Task 9: Security/compliance gate + final verification

- [ ] **Step 1: Full verification:** `npm run lint && npm run test && npm run build && npm run e2e` (Node 20) — all green.
- [ ] **Step 2: Security/compliance review** of the new GeneralFlow code + scoring. Checklist: no PII/answers logged; the appropriateness score computation is correct and unit-tested; FAIL reliably routes to the failure page (no way to bypass to completion client-side); the `appropriatenessLevel` client-trust question remains a tracked backend follow-up; envelope status checked; no secret committed.
- [ ] **Step 3: Push:** `git push origin main`.
- [ ] **Step 4: Confirm DoD** against the spec (AU flow PASS/FAIL, scoring, flow selection, failure page, suites green, review complete).

---

## Notes for the implementer

- **AU scores additional questions only** (matches legacy): the scoring `beforeSubmit` sums over the non-mandatory questions' labels, NOT the KOQ. If the backend returns no additional questions, `appropriatenessLevel` stays unset and the final submit defaults to PASS (legacy behaviour) — leave it; flag if it seems wrong.
- **`KOQRiskAppetite` label value is `"KOQRiskAppetiteCFD"`** — use the constant, not the key.
- **`StepCategory`** needs `'employment'` and `'income'` added, and `StepField` needs `isFailure?: boolean` (Task 5 Step 3).
- **Appropriateness intro modal** is deferred (cosmetic); `KOQHardship` is just another `QuestionStep`.
- **i18n:** use real English copy in the failure/not-available screens and step titles; no placeholders.
- **Do not create git worktrees; commit specific files only.**

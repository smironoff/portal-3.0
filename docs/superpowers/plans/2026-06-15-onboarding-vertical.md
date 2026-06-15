# Onboarding Vertical (2b) Implementation Plan — Engine + Simplified Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A unified `/onboarding` route that runs the SimplifiedFlow (Level 1 → pending-approval interstitial → Level 2 → `PENDING_KYC` stub) for an authenticated user, on a reusable config-driven step engine.

**Architecture:** Feature folder `src/features/onboarding/`. A pure step engine (`StepField[]` + state machine) ported from the legacy `utils.tsx`. Working application state in a Zustand store hydrated from a TanStack Query load. Server calls via a new `tfboCall` helper on the Foundation httpClient. RHF + Zod step forms. SimplifiedFlow selects Level 1/Level 2 steps by application status and delegates progression to the engine.

**Tech Stack:** React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`), TanStack Router + Query, Zustand, MUI v9, RHF + Zod, Vitest, Playwright. **Node pinned to 20** — every command under `source "$HOME/.nvm/nvm.sh" && nvm use`. **Arrow functions only.**

**Spec:** `docs/superpowers/specs/2026-06-15-onboarding-vertical-design.md`
**Legacy reference:** `/Volumes/WORK/ThinkMarkets/portal-2.0/src` (read-only).

**Verified legacy contracts:**

- TFBO convenience: `_tfboCall(module, action, parameters?, auth?)` posts `{ payload: [{ module, action, parameters }] }`. **Params are nested under `parameters`** (not spread). Result is at `response.payload[0].result`.
- Load application: module `application`, action `getLastApplicationsInfo`, no params, `Authorize.Yes` → `AppInfo[]`.
- Questions: module `application`, action `getQuestions`, params `{ orgId }`, `Authorize.No` → `Question[]`.
- Incremental save (authenticated): module `application`, action `application_submit`, params = `AppInfo`, `Authorize.Yes` → `IncrementalSubmitResponse` (`{ applicationStatus, applicationId, app_id, ... }`).
- Level submit: module `application`, action `simplified_submit_level_one` / `simplified_submit_level_two`, params = `AppInfo`, `Authorize.Yes` → `{ applicationId }`.
- `ApplicationStatus` is a string union (subset relevant here: `INCOMPLETE`, `LEVEL1_APPROVED`, `PENDING_KYC`, plus terminal `APPROVED`/`DENIED`/`PENDING_REVIEW`/etc).
- SimplifiedFlow: status `INCOMPLETE` → Level 1 steps; otherwise → Level 2 steps. L1 = personalInfo, phone, platform, terms. L2 = address, forexExperience question, securitiesBondsExperience question. Question labels: `TMLC_Questions.forexExperience = 'forexExperience'`, `securitiesBondsExperience = 'securitiesBondsExperience'`.
- `StepField`: `{ fields: (keyof AppInfo)[]; requiredQuestions?: string[]; component; category; shouldDisplay?(draft); beforeSubmit?; isLast?; canGoBack? }`.
- `QuestionsIDs`: `{ question?: number; answer?: number; others?: string }` stored in `appInfo.accountApplicationQuestionDetails`.

---

## File structure

```
src/api/httpClient.ts             (extend: add tfboCall helper)
src/features/onboarding/
  api/
    types.ts          (AppInfo subset, Question, Answer, QuestionsIDs, ApplicationStatus, response types)
    onboardingApi.ts  (loadApplication, getQuestions, incrementalSubmit, submitLevelOne, submitLevelTwo)
    onboardingApi.test.ts
    onboardingQueries.ts
    onboardingQueries.test.tsx
  engine/
    stepConfig.ts     (StepField, StepComponentProps, StepCategory)
    stepMachine.ts    (isStepCompleted, shouldSkipStep, getStartingStep, getNextStep, getPreviousStep)
    stepMachine.test.ts
  state/
    onboardingStore.ts / onboardingStore.test.ts
  steps/
    PersonalInfoStep.tsx, PhoneStep.tsx, PlatformStep.tsx, TermsStep.tsx, AddressStep.tsx, QuestionStep.tsx (+ tests)
  components/StepLayout.tsx
  flows/simplified/flowConfig.ts, SimplifiedFlow.tsx (+ SimplifiedFlow.test.tsx)
  OnboardingScreen.tsx
  routes/onboarding.tsx
e2e/onboarding.spec.ts
```

---

## Task 1: `tfboCall` helper on the HTTP client

Adds a convenience method matching the legacy `_tfboCall` (correct `parameters` nesting) so feature code never hand-builds the envelope.

**Files:** Modify `src/api/httpClient.ts`. Test: extend `src/api/httpClient.test.ts`.

- [ ] **Step 1: Write the failing test** (add to `src/api/httpClient.test.ts`):

```ts
it('tfboCall posts a module/action/parameters envelope', async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      id: 1,
      session_id: 's',
      token: 't',
      payload: [{ module: 'application', action: 'getQuestions', status: 'OK', result: [] }],
    }),
  }))
  vi.stubGlobal('fetch', fetchMock)
  const auth = createAuthClient(cfg)
  const http = createHttpClient(cfg, auth)
  await http.tfboCall('application', 'getQuestions', { orgId: 5 }, Authorize.No)
  const body = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(body.payload[0]).toMatchObject({
    module: 'application',
    action: 'getQuestions',
    parameters: { orgId: 5 },
  })
})
```

(Reuse the existing test's `cfg`, `createAuthClient`, `createHttpClient`, `Authorize` imports.)

- [ ] **Step 2: Run it, verify FAIL** — `npx vitest run src/api/httpClient.test.ts`.

- [ ] **Step 3: Implement.** Add to the `HttpClient` interface and the factory in `src/api/httpClient.ts`:

```ts
// in the HttpClient interface:
tfboCall: <T>(module: string, action: string, parameters?: object, auth?: Authorize) =>
  Promise<APIResponse<T>>
```

```ts
// in createHttpClient, alongside request/tfbo/auth:
const tfboCall = <T>(
  module: string,
  action: string,
  parameters?: object,
  authMode: Authorize = Authorize.Yes
) => tfbo<T>({ payload: [{ module, action, parameters }] }, authMode)

return { request, tfbo, auth, tfboCall }
```

Note: the existing `tfbo` request type is `{ payload: Array<{ module; action; [k]: unknown }> }`; `parameters` as a nested object is compatible. Adjust the inner payload type if needed to allow a `parameters?: object` field.

- [ ] **Step 4: Run it, verify PASS** (whole `httpClient.test.ts` green).

- [ ] **Step 5: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null
npm run build && npm run lint && npm run test
git add -A && git commit -m "feat(api): tfboCall helper (module/action/parameters envelope)"
```

---

## Task 2: Onboarding types

**Files:** Create `src/features/onboarding/api/types.ts`. (No standalone test; exercised by later tasks.)

- [ ] **Step 1: Implement** `src/features/onboarding/api/types.ts`:

```ts
export type ApplicationStatus =
  | 'INCOMPLETE'
  | 'LEVEL1_APPROVED'
  | 'PENDING_KYC'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'DENIED'
  | 'FAILED'
  | string

export type QuestionsIDs = {
  question?: number
  answer?: number
  others?: string
}

export interface Answer {
  id: number
  answer: string
  other?: string
  label: string
  score?: number
}

export interface Question {
  id: number
  question: string
  label: string
  answers: Answer[]
  topic?: string
  isMandatory?: boolean
}

// Subset of the legacy AppInfo used by SimplifiedFlow L1 + L2.
export interface AppInfo {
  applicationId?: number
  completed?: boolean
  status?: ApplicationStatus
  // personal
  accountHolderFirstName?: string
  accountHolderLastName?: string
  accountHolderTitle?: string
  accountHolderDayOfBirth?: number
  accountHolderMonthOfBirth?: number
  accountHolderYearOfBirth?: number
  // phone
  accountHolderPhone?: string
  accountHolderPhoneCode?: number
  // platform
  selectedPlatform?: string
  platformAccountType?: string
  leverage?: number
  accountCurrency?: string
  // terms
  secondaryConsentAccepted?: string
  // address
  accountHolderPostalCode?: string
  accountHolderStreetAddress?: string
  accountHolderCity?: string
  accountHolderStateProvince?: string
  // questions
  accountApplicationQuestionDetails?: QuestionsIDs[]
  // appropriateness (set on L2 complete = 'PASS' for Simplified)
  appropriatenessLevel?: 'PASS' | 'REFER' | 'FAIL'
  [key: string]: unknown
}

export interface IncrementalSubmitResponse {
  applicationStatus: ApplicationStatus
  applicationId: number
  app_id?: number
}

export interface SubmitLevelResponse {
  applicationId: number
}
```

- [ ] **Step 2: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint
git add -A && git commit -m "feat(onboarding): application/question/AppInfo types"
```

---

## Task 3: The step engine (pure)

Ports the legacy `StepField` + completion/skip/navigation logic as pure functions (the legacy used `useCallback` but the logic is pure).

**Files:** Create `src/features/onboarding/engine/stepConfig.ts`, `engine/stepMachine.ts`. Test `engine/stepMachine.test.ts`.

- [ ] **Step 1: Implement** `src/features/onboarding/engine/stepConfig.ts`:

```ts
import type { ComponentType } from 'react'
import type { AppInfo, Question } from '../api/types'

export type StepCategory =
  | 'personal'
  | 'phone'
  | 'platform'
  | 'terms'
  | 'address'
  | 'experience'
  | 'assessment'

export interface StepComponentProps {
  onNext: () => void
  onBack?: () => void
  canGoBack: boolean
}

export interface StepField {
  fields: Array<keyof AppInfo>
  requiredQuestions?: string[]
  component: ComponentType<StepComponentProps>
  category: StepCategory
  shouldDisplay?: (draft: Partial<AppInfo>) => boolean
  beforeSubmit?: (
    draft: Partial<AppInfo>,
    questions: Question[]
  ) => Promise<Partial<AppInfo>> | Partial<AppInfo>
  isLast?: boolean
  canGoBack?: boolean
}
```

- [ ] **Step 2: Write the failing test** `engine/stepMachine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isStepCompleted, getStartingStep, getNextStep, getPreviousStep } from './stepMachine'
import type { StepField } from './stepConfig'
import type { Question } from '../api/types'

const noop = (() => null) as unknown as StepField['component']
const step = (over: Partial<StepField>): StepField => ({
  fields: [],
  component: noop,
  category: 'personal',
  ...over,
})

const questions: Question[] = [
  {
    id: 7,
    question: 'Forex?',
    label: 'forexExperience',
    answers: [{ id: 1, answer: 'yes', label: 'yes' }],
  },
]

describe('isStepCompleted', () => {
  it('is true when all fields are filled', () => {
    const s = step({ fields: ['accountHolderFirstName'] })
    expect(isStepCompleted(s, { accountHolderFirstName: 'Jo' }, [])).toBe(true)
    expect(isStepCompleted(s, {}, [])).toBe(false)
  })

  it('treats empty/whitespace strings as incomplete', () => {
    const s = step({ fields: ['accountHolderFirstName'] })
    expect(isStepCompleted(s, { accountHolderFirstName: '   ' }, [])).toBe(false)
  })

  it('requires required questions to be answered (by mapped id)', () => {
    const s = step({ fields: [], requiredQuestions: ['forexExperience'] })
    expect(isStepCompleted(s, {}, questions)).toBe(false)
    expect(
      isStepCompleted(
        s,
        { accountApplicationQuestionDetails: [{ question: 7, answer: 1 }] },
        questions
      )
    ).toBe(true)
  })

  it('is complete when the step is skipped via shouldDisplay', () => {
    const s = step({ fields: ['accountHolderFirstName'], shouldDisplay: () => false })
    expect(isStepCompleted(s, {}, [])).toBe(true)
  })
})

describe('navigation', () => {
  const steps: StepField[] = [
    step({ fields: ['accountHolderFirstName'] }),
    step({ fields: ['accountHolderPhone'], shouldDisplay: () => false }),
    step({ fields: ['accountHolderPostalCode'] }),
  ]

  it('getStartingStep skips already-completed steps', () => {
    // step 0 complete, step 1 skipped -> start at 2
    expect(getStartingStep(steps, -1, { accountHolderFirstName: 'Jo' }, [])).toBe(2)
  })

  it('getNextStep skips non-displayed steps', () => {
    expect(getNextStep(steps, 0, {})).toBe(2)
  })

  it('getPreviousStep skips non-displayed steps', () => {
    expect(getPreviousStep(steps, 2, {})).toBe(0)
  })
})
```

- [ ] **Step 3: Run it, verify FAIL.**

- [ ] **Step 4: Implement** `engine/stepMachine.ts`:

```ts
import type { StepField } from './stepConfig'
import type { AppInfo, Question } from '../api/types'

export const shouldSkipStep = (step: StepField, draft: Partial<AppInfo>): boolean =>
  step.shouldDisplay ? !step.shouldDisplay(draft) : false

export const isStepCompleted = (
  step: StepField,
  draft: Partial<AppInfo>,
  questions: Question[]
): boolean => {
  if (shouldSkipStep(step, draft)) return true

  const fieldsDone = step.fields.every((field) => {
    const v = draft[field]
    if (typeof v === 'string') return v.trim() !== ''
    return v !== undefined && v !== null
  })

  const requiredIds = (step.requiredQuestions ?? [])
    .map((label) => questions.find((q) => q.label === label)?.id)
    .filter((id): id is number => typeof id === 'number')

  const questionsDone = requiredIds.every((qid) =>
    draft.accountApplicationQuestionDetails?.some(
      (a) => a.question === qid && a.answer !== null && a.answer !== undefined
    )
  )

  return fieldsDone && questionsDone
}

export const getStartingStep = (
  steps: StepField[],
  currentStep: number,
  draft: Partial<AppInfo>,
  questions: Question[]
): number => {
  let next = currentStep + 1
  while (next < steps.length && isStepCompleted(steps[next]!, draft, questions)) next++
  return next
}

export const getNextStep = (
  steps: StepField[],
  currentStep: number,
  draft: Partial<AppInfo>
): number => {
  let next = currentStep + 1
  while (next < steps.length && shouldSkipStep(steps[next]!, draft)) next++
  return next
}

export const getPreviousStep = (
  steps: StepField[],
  currentStep: number,
  draft: Partial<AppInfo>
): number => {
  let prev = currentStep - 1
  while (prev >= 0 && shouldSkipStep(steps[prev]!, draft)) prev--
  return prev
}
```

(Note `noUncheckedIndexedAccess` is on — the `!` on `steps[next]` after the bounds check is intentional.)

- [ ] **Step 5: Run it, verify PASS.**

- [ ] **Step 6: Commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add -A && git commit -m "feat(onboarding): pure step engine (config + state machine)"
```

---

## Task 4: Onboarding store (Zustand)

**Files:** Create `src/features/onboarding/state/onboardingStore.ts`. Test `state/onboardingStore.test.ts`.

- [ ] **Step 1: Write the failing test** `state/onboardingStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useOnboardingStore } from './onboardingStore'

describe('onboardingStore', () => {
  beforeEach(() => useOnboardingStore.getState().reset())

  it('patches the draft with a shallow merge', () => {
    useOnboardingStore.getState().patch({ accountHolderFirstName: 'Jo' })
    useOnboardingStore.getState().patch({ accountHolderLastName: 'Lee' })
    expect(useOnboardingStore.getState().draft).toMatchObject({
      accountHolderFirstName: 'Jo',
      accountHolderLastName: 'Lee',
    })
  })

  it('records a question answer', () => {
    useOnboardingStore.getState().setAnswer(7, 1)
    expect(useOnboardingStore.getState().draft.accountApplicationQuestionDetails).toEqual([
      { question: 7, answer: 1 },
    ])
    // replaces an existing answer for the same question
    useOnboardingStore.getState().setAnswer(7, 2)
    expect(useOnboardingStore.getState().draft.accountApplicationQuestionDetails).toEqual([
      { question: 7, answer: 2 },
    ])
  })

  it('hydrate replaces the draft; reset clears it', () => {
    useOnboardingStore.getState().hydrate({ accountHolderFirstName: 'A' })
    expect(useOnboardingStore.getState().draft.accountHolderFirstName).toBe('A')
    useOnboardingStore.getState().reset()
    expect(useOnboardingStore.getState().draft).toEqual({})
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `state/onboardingStore.ts`:

```ts
import { create } from 'zustand'
import type { AppInfo } from '../api/types'

interface OnboardingState {
  draft: Partial<AppInfo>
  currentStep: number
  patch: (partial: Partial<AppInfo>) => void
  setAnswer: (questionId: number, answerId: number, others?: string) => void
  setCurrentStep: (step: number) => void
  hydrate: (app: Partial<AppInfo>) => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  draft: {},
  currentStep: -1,
  patch: (partial) => set((s) => ({ draft: { ...s.draft, ...partial } })),
  setAnswer: (questionId, answerId, others) =>
    set((s) => {
      const existing = s.draft.accountApplicationQuestionDetails ?? []
      const next = existing.filter((a) => a.question !== questionId)
      next.push({ question: questionId, answer: answerId, ...(others ? { others } : {}) })
      return { draft: { ...s.draft, accountApplicationQuestionDetails: next } }
    }),
  setCurrentStep: (currentStep) => set({ currentStep }),
  hydrate: (app) => set({ draft: { ...app } }),
  reset: () => set({ draft: {}, currentStep: -1 }),
}))
```

- [ ] **Step 4: Run it, verify PASS.**

- [ ] **Step 5: Commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add -A && git commit -m "feat(onboarding): zustand working-application store"
```

---

## Task 5: Onboarding API

**Files:** Create `src/features/onboarding/api/onboardingApi.ts`. Test `api/onboardingApi.test.ts`.

- [ ] **Step 1: Write the failing test** `api/onboardingApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const http = { tfboCall: vi.fn(), auth: vi.fn(), tfbo: vi.fn(), request: vi.fn() }
vi.mock('@/api/client', () => ({ getHttpClient: () => http }))

beforeEach(() => http.tfboCall.mockReset())

describe('onboardingApi', () => {
  it('loadApplication returns the most recent application', async () => {
    http.tfboCall.mockResolvedValue({
      payload: [{ result: [{ applicationId: 1, status: 'INCOMPLETE' }] }],
    })
    const { loadApplication } = await import('./onboardingApi')
    const app = await loadApplication()
    expect(http.tfboCall).toHaveBeenCalledWith('application', 'getLastApplicationsInfo', {}, 0)
    expect(app?.status).toBe('INCOMPLETE')
  })

  it('getQuestions passes orgId unauthenticated', async () => {
    http.tfboCall.mockResolvedValue({ payload: [{ result: [] }] })
    const { getQuestions } = await import('./onboardingApi')
    await getQuestions(5)
    expect(http.tfboCall).toHaveBeenCalledWith('application', 'getQuestions', { orgId: 5 }, 1)
  })

  it('incrementalSubmit posts application_submit and returns the status', async () => {
    http.tfboCall.mockResolvedValue({
      payload: [{ result: { applicationStatus: 'INCOMPLETE', applicationId: 1 } }],
    })
    const { incrementalSubmit } = await import('./onboardingApi')
    const res = await incrementalSubmit({ accountHolderFirstName: 'Jo' })
    expect(http.tfboCall).toHaveBeenCalledWith(
      'application',
      'application_submit',
      { accountHolderFirstName: 'Jo' },
      0
    )
    expect(res.applicationStatus).toBe('INCOMPLETE')
  })

  it('submitLevelOne / submitLevelTwo post the right actions', async () => {
    http.tfboCall.mockResolvedValue({ payload: [{ result: { applicationId: 1 } }] })
    const { submitLevelOne, submitLevelTwo } = await import('./onboardingApi')
    await submitLevelOne({ applicationId: 1 })
    expect(http.tfboCall).toHaveBeenCalledWith(
      'application',
      'simplified_submit_level_one',
      { applicationId: 1 },
      0
    )
    await submitLevelTwo({ applicationId: 1 })
    expect(http.tfboCall).toHaveBeenCalledWith(
      'application',
      'simplified_submit_level_two',
      { applicationId: 1 },
      0
    )
  })
})
```

(Recall `Authorize.Yes === 0`, `Authorize.No === 1`.)

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `api/onboardingApi.ts`:

```ts
import { getHttpClient } from '@/api/client'
import { Authorize } from '@/api/httpClient'
import type { AppInfo, Question, IncrementalSubmitResponse, SubmitLevelResponse } from './types'

export const loadApplication = async (): Promise<AppInfo | undefined> => {
  const res = await getHttpClient().tfboCall<AppInfo[]>(
    'application',
    'getLastApplicationsInfo',
    {},
    Authorize.Yes
  )
  const apps = res.payload?.[0]?.result
  return Array.isArray(apps) ? apps[apps.length - 1] : undefined
}

export const getQuestions = async (orgId: number): Promise<Question[]> => {
  const res = await getHttpClient().tfboCall<Question[]>(
    'application',
    'getQuestions',
    { orgId },
    Authorize.No
  )
  return res.payload?.[0]?.result ?? []
}

export const incrementalSubmit = async (
  app: Partial<AppInfo>
): Promise<IncrementalSubmitResponse> => {
  const res = await getHttpClient().tfboCall<IncrementalSubmitResponse>(
    'application',
    'application_submit',
    app,
    Authorize.Yes
  )
  return res.payload[0]!.result
}

export const submitLevelOne = async (app: Partial<AppInfo>): Promise<SubmitLevelResponse> => {
  const res = await getHttpClient().tfboCall<SubmitLevelResponse>(
    'application',
    'simplified_submit_level_one',
    app,
    Authorize.Yes
  )
  return res.payload[0]!.result
}

export const submitLevelTwo = async (app: Partial<AppInfo>): Promise<SubmitLevelResponse> => {
  const res = await getHttpClient().tfboCall<SubmitLevelResponse>(
    'application',
    'simplified_submit_level_two',
    app,
    Authorize.Yes
  )
  return res.payload[0]!.result
}
```

- [ ] **Step 4: Run it, verify PASS.**

- [ ] **Step 5: Commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add -A && git commit -m "feat(onboarding): API (load, questions, incremental + level submit)"
```

---

## Task 6: Onboarding query/mutation hooks

**Files:** Create `src/features/onboarding/api/onboardingQueries.ts`. Test `api/onboardingQueries.test.tsx`.

- [ ] **Step 1: Write the failing test** `api/onboardingQueries.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const api = {
  loadApplication: vi.fn(),
  getQuestions: vi.fn(),
  incrementalSubmit: vi.fn(),
  submitLevelOne: vi.fn(),
  submitLevelTwo: vi.fn(),
}
vi.mock('./onboardingApi', () => api)

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => Object.values(api).forEach((m) => m.mockReset()))

describe('useApplication', () => {
  it('loads the application', async () => {
    api.loadApplication.mockResolvedValue({ status: 'INCOMPLETE' })
    const { useApplication } = await import('./onboardingQueries')
    const { result } = renderHook(() => useApplication(true), { wrapper })
    await waitFor(() => expect(result.current.data?.status).toBe('INCOMPLETE'))
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `api/onboardingQueries.ts`:

```ts
import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from './onboardingApi'
import type { AppInfo } from './types'

export const useApplication = (enabled: boolean) =>
  useQuery({ queryKey: ['application'], queryFn: api.loadApplication, enabled })

export const useQuestions = (orgId: number | undefined) =>
  useQuery({
    queryKey: ['questions', orgId],
    queryFn: () => api.getQuestions(orgId!),
    enabled: orgId != null,
  })

export const useIncrementalSubmit = () =>
  useMutation({ mutationFn: (app: Partial<AppInfo>) => api.incrementalSubmit(app) })

export const useSubmitLevelOne = () =>
  useMutation({ mutationFn: (app: Partial<AppInfo>) => api.submitLevelOne(app) })

export const useSubmitLevelTwo = () =>
  useMutation({ mutationFn: (app: Partial<AppInfo>) => api.submitLevelTwo(app) })
```

- [ ] **Step 4: Run it, verify PASS.**

- [ ] **Step 5: Commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add -A && git commit -m "feat(onboarding): tanstack query/mutation hooks"
```

---

## Task 7: Level 1 step components (personal, phone, platform, terms)

A shared `StepLayout` plus four RHF + Zod steps that write the store draft and call `onNext`.

**Files:** Create `src/features/onboarding/components/StepLayout.tsx`, `steps/PersonalInfoStep.tsx`, `steps/PhoneStep.tsx`, `steps/PlatformStep.tsx`, `steps/TermsStep.tsx`. Test `steps/PersonalInfoStep.test.tsx`.

- [ ] **Step 1: Implement** `components/StepLayout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { Button } from '@/components/Button'

export const StepLayout = ({
  title,
  children,
  onSubmit,
  canGoBack,
  onBack,
  submitLabel = 'Continue',
}: {
  title: string
  children: ReactNode
  onSubmit: () => void
  canGoBack: boolean
  onBack?: () => void
  submitLabel?: string
}) => (
  <Box
    component="form"
    onSubmit={(e) => {
      e.preventDefault()
      onSubmit()
    }}
    noValidate
    sx={{ maxWidth: 420 }}
  >
    <Stack spacing={2}>
      <Typography variant="h5">{title}</Typography>
      {children}
      <Stack direction="row" spacing={1}>
        {canGoBack && onBack && (
          <Button variant="outlined" onClick={onBack} type="button">
            Back
          </Button>
        )}
        <Button type="submit">{submitLabel}</Button>
      </Stack>
    </Stack>
  </Box>
)
```

- [ ] **Step 2: Write the failing test** `steps/PersonalInfoStep.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOnboardingStore } from '../state/onboardingStore'
import { PersonalInfoStep } from './PersonalInfoStep'

beforeEach(() => useOnboardingStore.getState().reset())

describe('PersonalInfoStep', () => {
  it('writes fields to the draft and advances', async () => {
    const onNext = vi.fn()
    render(<PersonalInfoStep onNext={onNext} canGoBack={false} />)
    await userEvent.type(screen.getByLabelText(/first name/i), 'Jo')
    await userEvent.type(screen.getByLabelText(/last name/i), 'Lee')
    await userEvent.type(screen.getByLabelText(/day/i), '1')
    await userEvent.type(screen.getByLabelText(/month/i), '2')
    await userEvent.type(screen.getByLabelText(/year/i), '1990')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onNext).toHaveBeenCalled()
    expect(useOnboardingStore.getState().draft).toMatchObject({
      accountHolderFirstName: 'Jo',
      accountHolderLastName: 'Lee',
      accountHolderDayOfBirth: 1,
      accountHolderMonthOfBirth: 2,
      accountHolderYearOfBirth: 1990,
    })
  })

  it('validates required fields', async () => {
    render(<PersonalInfoStep onNext={vi.fn()} canGoBack={false} />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run it, verify FAIL.**

- [ ] **Step 4: Implement** `steps/PersonalInfoStep.tsx`:

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'

const schema = z.object({
  accountHolderFirstName: z.string().min(1, 'First name is required'),
  accountHolderLastName: z.string().min(1, 'Last name is required'),
  accountHolderDayOfBirth: z.coerce.number().int().min(1).max(31),
  accountHolderMonthOfBirth: z.coerce.number().int().min(1).max(12),
  accountHolderYearOfBirth: z.coerce.number().int().min(1900).max(2025),
})
type Values = z.infer<typeof schema>

export const PersonalInfoStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountHolderFirstName: draft.accountHolderFirstName ?? '',
      accountHolderLastName: draft.accountHolderLastName ?? '',
      accountHolderDayOfBirth: draft.accountHolderDayOfBirth,
      accountHolderMonthOfBirth: draft.accountHolderMonthOfBirth,
      accountHolderYearOfBirth: draft.accountHolderYearOfBirth,
    },
  })
  const submit = handleSubmit((v) => {
    patch(v)
    onNext()
  })
  return (
    <StepLayout
      title="Personal information"
      onSubmit={submit}
      canGoBack={canGoBack}
      onBack={onBack}
    >
      <TextField
        label="First name"
        error={!!errors.accountHolderFirstName}
        helperText={errors.accountHolderFirstName?.message}
        {...register('accountHolderFirstName')}
      />
      <TextField
        label="Last name"
        error={!!errors.accountHolderLastName}
        helperText={errors.accountHolderLastName?.message}
        {...register('accountHolderLastName')}
      />
      <TextField label="Day" type="number" {...register('accountHolderDayOfBirth')} />
      <TextField label="Month" type="number" {...register('accountHolderMonthOfBirth')} />
      <TextField label="Year" type="number" {...register('accountHolderYearOfBirth')} />
    </StepLayout>
  )
}
```

- [ ] **Step 5: Run it, verify PASS.**

- [ ] **Step 6: Implement the other three L1 steps** (same pattern; no separate tests required, they are covered by the flow integration test in Task 9):

`steps/PhoneStep.tsx` — fields `accountHolderPhoneCode` (number) + `accountHolderPhone` (string):

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField } from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'

const schema = z.object({
  accountHolderPhoneCode: z.coerce.number().int().positive(),
  accountHolderPhone: z.string().min(3, 'Phone is required'),
})
type Values = z.infer<typeof schema>

export const PhoneStep = ({ onNext, onBack, canGoBack }: StepComponentProps) => {
  const draft = useOnboardingStore((s) => s.draft)
  const patch = useOnboardingStore((s) => s.patch)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountHolderPhoneCode: draft.accountHolderPhoneCode,
      accountHolderPhone: draft.accountHolderPhone ?? '',
    },
  })
  const submit = handleSubmit((v) => {
    patch(v)
    onNext()
  })
  return (
    <StepLayout title="Phone number" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
      <TextField label="Country code" type="number" {...register('accountHolderPhoneCode')} />
      <TextField
        label="Phone number"
        error={!!errors.accountHolderPhone}
        helperText={errors.accountHolderPhone?.message}
        {...register('accountHolderPhone')}
      />
    </StepLayout>
  )
}
```

`steps/PlatformStep.tsx` — fields `selectedPlatform`, `platformAccountType`, `leverage`, `accountCurrency` (use MUI `TextField select` with a small fixed option set: platform `ThinkTrader`/`MT4`/`MT5`; currency `USD`/`EUR`/`GBP`; leverage `30`/`100`/`500`; account type `standard`). Same RHF+Zod+StepLayout pattern; on submit `patch(v); onNext()`.

`steps/TermsStep.tsx` — field `secondaryConsentAccepted`: a required checkbox; on submit set `secondaryConsentAccepted: 'true'` and call `onNext()`. Use MUI `FormControlLabel`+`Checkbox`; block submit until checked (Zod `z.literal(true)` on a boolean, mapped to the string on patch). Mark this step `isLast` for Level 1 in the flow config.

- [ ] **Step 7: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add -A && git commit -m "feat(onboarding): level 1 step components (personal, phone, platform, terms)"
```

---

## Task 8: Level 2 step components (address, dynamic question)

**Files:** Create `src/features/onboarding/steps/AddressStep.tsx`, `steps/QuestionStep.tsx`. Test `steps/QuestionStep.test.tsx`.

- [ ] **Step 1: Implement** `steps/AddressStep.tsx` — manual address form, fields `accountHolderPostalCode` (required), plus `accountHolderStreetAddress`, `accountHolderCity` (optional in the draft). Same RHF + Zod + StepLayout pattern as PhoneStep; required: postal code. On submit `patch(v); onNext()`. (No GBG/Google lookup — deferred.)

- [ ] **Step 2: Write the failing test** `steps/QuestionStep.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOnboardingStore } from '../state/onboardingStore'
import { makeQuestionStep } from './QuestionStep'
import type { Question } from '../api/types'

const question: Question = {
  id: 7,
  question: 'How much forex experience do you have?',
  label: 'forexExperience',
  answers: [
    { id: 11, answer: 'none', label: 'none' },
    { id: 12, answer: 'some', label: 'some' },
  ],
}

beforeEach(() => useOnboardingStore.getState().reset())

describe('QuestionStep', () => {
  it('renders the question and records the chosen answer', async () => {
    const onNext = vi.fn()
    const Step = makeQuestionStep('forexExperience', () => [question])
    render(<Step onNext={onNext} canGoBack />)
    await userEvent.click(screen.getByText('How much forex experience do you have?'))
    await userEvent.click(screen.getByRole('radio', { name: /some/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(useOnboardingStore.getState().draft.accountApplicationQuestionDetails).toEqual([
      { question: 7, answer: 12 },
    ])
    expect(onNext).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run it, verify FAIL.**

- [ ] **Step 4: Implement** `steps/QuestionStep.tsx` — a factory that builds a step component bound to a question label, reading the questions list and recording the answer via `setAnswer`:

```tsx
import { useState } from 'react'
import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { StepLayout } from '../components/StepLayout'
import { useOnboardingStore } from '../state/onboardingStore'
import type { StepComponentProps } from '../engine/stepConfig'
import type { Question } from '../api/types'

export const makeQuestionStep =
  (label: string, useQuestionsList: () => Question[]) =>
  ({ onNext, onBack, canGoBack }: StepComponentProps) => {
    const questions = useQuestionsList()
    const question = questions.find((q) => q.label === label)
    const setAnswer = useOnboardingStore((s) => s.setAnswer)
    const existing = useOnboardingStore(
      (s) =>
        s.draft.accountApplicationQuestionDetails?.find((a) => a.question === question?.id)?.answer
    )
    const [selected, setSelected] = useState<number | undefined>(existing)
    const [error, setError] = useState(false)

    const submit = () => {
      if (selected == null || !question) {
        setError(true)
        return
      }
      setAnswer(question.id, selected)
      onNext()
    }

    if (!question) return <Typography>Loading question...</Typography>

    return (
      <StepLayout title="A quick question" onSubmit={submit} canGoBack={canGoBack} onBack={onBack}>
        <FormControl error={error}>
          <FormLabel>{question.question}</FormLabel>
          <RadioGroup
            value={selected ?? ''}
            onChange={(e) => {
              setSelected(Number(e.target.value))
              setError(false)
            }}
          >
            {question.answers.map((a) => (
              <FormControlLabel key={a.id} value={a.id} control={<Radio />} label={a.answer} />
            ))}
          </RadioGroup>
        </FormControl>
      </StepLayout>
    )
  }
```

- [ ] **Step 5: Run it, verify PASS.**

- [ ] **Step 6: Commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add -A && git commit -m "feat(onboarding): level 2 steps (address, dynamic question)"
```

---

## Task 9: SimplifiedFlow + flow config

Drives the engine over the level's steps, persists each step (incremental), submits at the level boundary, and renders the interstitial.

**Files:** Create `src/features/onboarding/flows/simplified/flowConfig.ts`, `flows/simplified/SimplifiedFlow.tsx`. Test `flows/simplified/SimplifiedFlow.test.tsx`.

- [ ] **Step 1: Implement** `flows/simplified/flowConfig.ts`:

```ts
import type { StepField } from '../../engine/stepConfig'
import { PersonalInfoStep } from '../../steps/PersonalInfoStep'
import { PhoneStep } from '../../steps/PhoneStep'
import { PlatformStep } from '../../steps/PlatformStep'
import { TermsStep } from '../../steps/TermsStep'
import { AddressStep } from '../../steps/AddressStep'
import { makeQuestionStep } from '../../steps/QuestionStep'
import { useQuestionsList } from './useQuestionsList'

export const TMLC_QUESTIONS = {
  forexExperience: 'forexExperience',
  securitiesBondsExperience: 'securitiesBondsExperience',
} as const

export const LEVEL_ONE_STEPS: StepField[] = [
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
    canGoBack: false,
  },
  {
    fields: ['selectedPlatform', 'platformAccountType', 'leverage', 'accountCurrency'],
    component: PlatformStep,
    category: 'platform',
  },
  { fields: ['secondaryConsentAccepted'], component: TermsStep, category: 'terms', isLast: true },
]

export const LEVEL_TWO_STEPS: StepField[] = [
  { fields: ['accountHolderPostalCode'], component: AddressStep, category: 'address' },
  {
    fields: [],
    requiredQuestions: [TMLC_QUESTIONS.forexExperience],
    component: makeQuestionStep(TMLC_QUESTIONS.forexExperience, useQuestionsList),
    category: 'experience',
  },
  {
    fields: [],
    requiredQuestions: [TMLC_QUESTIONS.securitiesBondsExperience],
    component: makeQuestionStep(TMLC_QUESTIONS.securitiesBondsExperience, useQuestionsList),
    category: 'experience',
    isLast: true,
  },
]
```

Also create `flows/simplified/useQuestionsList.ts` — a tiny hook returning the loaded questions list from a context/query so `makeQuestionStep` can read it:

```ts
import { useQuestions } from '../../api/onboardingQueries'
import { useOnboardingStore } from '../../state/onboardingStore'

export const useQuestionsList = () => {
  // orgId is carried on the draft once the application loads; undefined disables the query.
  const orgId = useOnboardingStore((s) => s.draft.organizationId as number | undefined)
  return useQuestions(orgId).data ?? []
}
```

(Confirm the exact org id field name on `AppInfo` during implementation; the legacy resolves org id from the user profile or onboarding state. If the field differs, adjust `useQuestionsList` to source it correctly. The questions query is `enabled` only when an org id is present.)

- [ ] **Step 2: Write the failing test** `flows/simplified/SimplifiedFlow.test.tsx` — drive Level 1 to completion and assert `submitLevelOne` is called. Mock the query/mutation hooks and the questions list:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOnboardingStore } from '../../state/onboardingStore'

const submitLevelOne = vi.fn()
const incremental = vi.fn().mockResolvedValue({ applicationStatus: 'INCOMPLETE', applicationId: 1 })
vi.mock('../../api/onboardingQueries', () => ({
  useApplication: () => ({ data: { applicationId: 1, status: 'INCOMPLETE' }, isLoading: false }),
  useQuestions: () => ({ data: [] }),
  useIncrementalSubmit: () => ({ mutateAsync: incremental }),
  useSubmitLevelOne: () => ({ mutateAsync: submitLevelOne }),
  useSubmitLevelTwo: () => ({ mutateAsync: vi.fn() }),
}))

beforeEach(() => {
  useOnboardingStore.getState().reset()
  submitLevelOne.mockReset()
  submitLevelOne.mockResolvedValue({ applicationId: 1 })
})

describe('SimplifiedFlow level 1', () => {
  it('walks the level-1 steps and submits at the end', async () => {
    const { SimplifiedFlow } = await import('./SimplifiedFlow')
    render(<SimplifiedFlow status="INCOMPLETE" applicationId={1} />)

    // personal
    await userEvent.type(screen.getByLabelText(/first name/i), 'Jo')
    await userEvent.type(screen.getByLabelText(/last name/i), 'Lee')
    await userEvent.type(screen.getByLabelText(/day/i), '1')
    await userEvent.type(screen.getByLabelText(/month/i), '2')
    await userEvent.type(screen.getByLabelText(/year/i), '1990')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    // phone
    await userEvent.type(screen.getByLabelText(/country code/i), '44')
    await userEvent.type(screen.getByLabelText(/phone number/i), '7700900000')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    // platform (selects have defaults set in the component; just continue)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    // terms
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /continue|submit/i }))

    expect(submitLevelOne).toHaveBeenCalled()
  })
})
```

(If the platform step requires explicit selection, set sensible defaults in `PlatformStep` so the test can proceed, or extend the test to choose options. Keep it green.)

- [ ] **Step 3: Run it, verify FAIL.**

- [ ] **Step 4: Implement** `flows/simplified/SimplifiedFlow.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Typography, Stack } from '@mui/material'
import { Button } from '@/components/Button'
import { LEVEL_ONE_STEPS, LEVEL_TWO_STEPS } from './flowConfig'
import { getNextStep, getPreviousStep, getStartingStep } from '../../engine/stepMachine'
import { useOnboardingStore } from '../../state/onboardingStore'
import {
  useQuestions,
  useIncrementalSubmit,
  useSubmitLevelOne,
  useSubmitLevelTwo,
} from '../../api/onboardingQueries'
import { useNotificationStore } from '@/state/notificationStore'
import type { ApplicationStatus } from '../../api/types'

export const SimplifiedFlow = ({
  status,
  applicationId,
}: {
  status: ApplicationStatus
  applicationId?: number
}) => {
  const isLevelOne = status === 'INCOMPLETE'
  const steps = isLevelOne ? LEVEL_ONE_STEPS : LEVEL_TWO_STEPS
  const draft = useOnboardingStore((s) => s.draft)
  const currentStep = useOnboardingStore((s) => s.currentStep)
  const setCurrentStep = useOnboardingStore((s) => s.setCurrentStep)
  const questions = useQuestions(draft.organizationId as number | undefined).data ?? []
  const incremental = useIncrementalSubmit()
  const submitLevelOne = useSubmitLevelOne()
  const submitLevelTwo = useSubmitLevelTwo()
  const notify = useNotificationStore((s) => s.push)

  useEffect(() => {
    setCurrentStep(getStartingStep(steps, -1, draft, questions))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  if (currentStep < 0 || currentStep >= steps.length) return <Typography>Loading...</Typography>
  const step = steps[currentStep]!
  const Comp = step.component

  const advance = async () => {
    try {
      const app = { ...useOnboardingStore.getState().draft, applicationId }
      if (step.isLast) {
        if (isLevelOne) await submitLevelOne.mutateAsync({ ...app, completed: true })
        else
          await submitLevelTwo.mutateAsync({
            ...app,
            completed: true,
            appropriatenessLevel: 'PASS',
          })
        // parent (OnboardingScreen) re-reads status after submit
      } else {
        await incremental.mutateAsync(app)
        setCurrentStep(getNextStep(steps, currentStep, useOnboardingStore.getState().draft))
      }
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

- [ ] **Step 5: Run it, verify PASS.**

- [ ] **Step 6: Commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add -A && git commit -m "feat(onboarding): SimplifiedFlow + level configs"
```

---

## Task 10: OnboardingScreen, route, and landing

**Files:** Create `src/features/onboarding/OnboardingScreen.tsx`, `routes/onboarding.tsx`. Modify `src/features/auth/landing.ts`, `src/router/router.tsx`, and remove the `/hello` route (`src/router/routes/hello.tsx` + its registration).

- [ ] **Step 1: Implement** `OnboardingScreen.tsx` — loads the application, hydrates the store, and renders the interstitial / SimplifiedFlow / hand-off by status:

```tsx
import { useEffect } from 'react'
import { Stack, Typography } from '@mui/material'
import { Button } from '@/components/Button'
import { useApplication } from './api/onboardingQueries'
import { useOnboardingStore } from './state/onboardingStore'
import { SimplifiedFlow } from './flows/simplified/SimplifiedFlow'

export const OnboardingScreen = () => {
  const { data: app, isLoading } = useApplication(true)
  const hydrate = useOnboardingStore((s) => s.hydrate)

  useEffect(() => {
    if (app) hydrate(app)
  }, [app, hydrate])

  if (isLoading || !app) return <Typography>Loading your application...</Typography>

  const status = app.status ?? 'INCOMPLETE'

  if (status === 'LEVEL1_APPROVED' && !useOnboardingStore.getState().draft.completed) {
    // interstitial -> proceed to level 2
    return <Level1Done applicationId={app.applicationId} />
  }
  if (status === 'PENDING_KYC' || status === 'PENDING_REVIEW' || status === 'APPROVED') {
    return (
      <Typography>
        Your application is being processed. Document verification is the next step.
      </Typography>
    )
  }
  return <SimplifiedFlow status={status} applicationId={app.applicationId} />
}

const Level1Done = ({ applicationId }: { applicationId?: number }) => {
  const [go, setGo] = useReactState(false)
  if (go) return <SimplifiedFlow status="LEVEL1_APPROVED" applicationId={applicationId} />
  return (
    <Stack spacing={2} sx={{ maxWidth: 420 }}>
      <Typography variant="h5">Step 1 submitted</Typography>
      <Typography>
        Your initial details are in review. You can continue with the remaining questions now.
      </Typography>
      <Button onClick={() => setGo(true)}>Continue</Button>
    </Stack>
  )
}
```

Replace `useReactState` with the real `useState` import (`import { useEffect, useState } from 'react'`); the placeholder name above is only to flag it — use `useState`.

- [ ] **Step 2: Implement** `routes/onboarding.tsx` under the authenticated layout:

```tsx
import { createRoute } from '@tanstack/react-router'
import { AuthenticatedRoute } from '@/router/routes/authenticated'
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen'

export const OnboardingRoute = createRoute({
  getParentRoute: () => AuthenticatedRoute,
  path: '/onboarding',
  component: OnboardingScreen,
})
```

- [ ] **Step 3: Update routing.** In `src/router/router.tsx`: import `OnboardingRoute`, add it under `AuthenticatedRoute.addChildren([...])`, and remove `HelloRoute` (and delete `src/router/routes/hello.tsx`). In `src/features/auth/landing.ts`, change `resolveLandingRoute` to return `/onboarding`:

```ts
import type { UserProfile } from '@/api/types'

// Authenticated users with an incomplete application land in onboarding.
// Later verticals refine this (approved -> dashboard, etc.).
export const resolveLandingRoute = (_profile?: UserProfile): string => '/onboarding'
```

Update any test asserting `/hello` (e.g. `src/features/auth/landing.test.ts`) to expect `/onboarding`. The auth e2e (`e2e/auth.spec.ts`) asserts the post-login screen shows "Hello, Portal 3.0" — update it to assert the onboarding screen instead (e.g. intercept `getLastApplicationsInfo` to return `INCOMPLETE` and assert the first onboarding step renders, e.g. text "Personal information"). Keep the e2e green.

- [ ] **Step 4: Verify + commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run build && npm run lint && npm run test
git add -A && git commit -m "feat(onboarding): OnboardingScreen, /onboarding route, landing -> onboarding (remove /hello)"
```

---

## Task 11: Playwright e2e

**Files:** Create `e2e/onboarding.spec.ts`.

- [ ] **Step 1: Write the e2e** — log in (reuse the auth interception), then drive Level 1, intercepting the onboarding endpoints. All `/nsdata` (TFBO) calls are POSTs distinguished by the request body's `payload[0].action`; intercept and branch on the action.

```ts
import { test, expect } from '@playwright/test'

const tfbo = (result: unknown, status = 'OK') => ({
  json: {
    id: 1,
    session_id: 's',
    token: 't',
    payload: [{ module: 'application', action: 'x', status, result }],
  },
})

test('authenticated user completes Simplified level 1', async ({ page }) => {
  // auth: go straight to logged-in by stubbing login OK + profile
  await page.route('**/auth/login', (r) =>
    r.fulfill({
      json: {
        status: 'OK',
        tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' },
      },
    })
  )

  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as
      | { payload?: Array<{ action?: string }> }
      | undefined
    const action = body?.payload?.[0]?.action
    if (action === 'get_user')
      return route.fulfill(tfbo({ id: 1, email: 'a@b.com', additionalAttributes: {} }))
    if (action === 'getLastApplicationsInfo')
      return route.fulfill(tfbo([{ applicationId: 1, status: 'INCOMPLETE' }]))
    if (action === 'getQuestions') return route.fulfill(tfbo([]))
    if (action === 'application_submit')
      return route.fulfill(tfbo({ applicationStatus: 'INCOMPLETE', applicationId: 1 }))
    if (action === 'simplified_submit_level_one') return route.fulfill(tfbo({ applicationId: 1 }))
    return route.fulfill(tfbo({}))
  })

  await page.goto('/account/login')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByLabel('Password', { exact: true }).fill('secret1')
  await page.getByRole('button', { name: /sign in/i }).click()

  // lands on onboarding -> level 1 personal info
  await expect(page.getByText('Personal information')).toBeVisible()
  await page.getByLabel(/first name/i).fill('Jo')
  await page.getByLabel(/last name/i).fill('Lee')
  await page.getByLabel(/day/i).fill('1')
  await page.getByLabel(/month/i).fill('2')
  await page.getByLabel(/year/i).fill('1990')
  await page.getByRole('button', { name: /continue/i }).click()
  await expect(page.getByText('Phone number')).toBeVisible()
})
```

(Adjust selectors/labels to match the implemented steps; the goal is a green happy-path that proves login → onboarding → first step transition. Extend through the level if practical, but the personal→phone transition is the minimum bar.)

- [ ] **Step 2: Run the e2e** under Node 20: `npm run e2e`. All specs (auth + onboarding) pass.

- [ ] **Step 3: Commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null
git add -A && git commit -m "test(onboarding): Playwright Simplified level-1 e2e"
```

---

## Task 12: Security/compliance gate + final verification

- [ ] **Step 1: Full verification**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null
npm run lint && npm run test && npm run build && npm run e2e
```

- [ ] **Step 2: Security/compliance review** of `src/features/onboarding/*` and the `tfboCall` change. Checklist:
- No PII or answers logged (console/Sentry); the draft and submissions are not leaked.
- The draft persists across steps with no silent data loss; a failed submit keeps the user on the step and notifies.
- `tfboCall` uses the correct `parameters` nesting (and note: re-verify the shipped auth `requestPasswordReset`/`confirmPasswordReset`, which spread params instead of nesting — fix in a follow-up if the backend requires `parameters`).
- No secret committed.
  Resolve blockers before sign-off.

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Confirm definition of done** against the spec (engine + SimplifiedFlow L1→interstitial→L2→PENDING_KYC, resume, dynamic questions, landing -> /onboarding, all suites green, review complete).

---

## Notes for the implementer

- **Exact field names / org id:** the `organizationId` field used to fetch questions, and a few `AppInfo` keys, are confirmed against the legacy `types.ts`/`getQuestions` usage during implementation. If the org id is sourced from the user profile rather than the application, adjust `useQuestionsList`/`SimplifiedFlow` accordingly.
- **i18n:** step titles/labels and `onboarding.error.*` keys should be real strings (add to the `common` locale as you build); no placeholders.
- **The auth `parameters` discrepancy** (reset endpoints spread params) is a real follow-up to verify against the backend; it is flagged, not fixed here, to keep this slice focused.
- **Interstitial vs direct L2:** the legacy went straight to L2 on `LEVEL1_APPROVED` (the dashboard provided the wait). This slice adds an explicit interstitial per the approved design.

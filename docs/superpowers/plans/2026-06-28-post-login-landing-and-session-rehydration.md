# Post-login Landing (real application status) + Session Rehydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Approved users land on `/dashboard` after login (even with a newer in-progress application), non-approved users are routed by their real application status, and a valid persisted session survives reloads / direct navigation.

**Architecture:** The real application status lives in `check_application_statuses` (field `application_status`), NOT on `getLastApplicationsInfo` (form data only). Add that call, derive `hasApproved` (any application `APPROVED`) and the latest status, and have `OnboardingScreen` redirect approved users to `/dashboard` and route the rest by real status — keeping `getLastApplicationsInfo` for the form draft and flow selection. Separately, derive `sessionStore.loggedIn` from a valid persisted token on boot.

**Tech Stack:** React 19, TS 6 (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), TanStack Router + Query, Zustand, Vitest + Testing Library, Playwright.

**Reference:** `docs/superpowers/specs/2026-06-28-post-login-landing-and-session-rehydration-design.md`; legacy `check_application_statuses` usage in `portal-2.0/src/redux/sagas.ts:190` and `utils/api.ts:748`. Verified real response: `check_application_statuses` -> `[{ application_status: 'APPROVED', ... }]`.

## Global Constraints

- **Node 20.** Windows host; plain `npm`/`npx`.
- **Arrow functions only**; TS strict.
- **Status source is `check_application_statuses`** (`application_status`, snake_case). `getLastApplicationsInfo` stays the form-data source (no status).
- **`hasApproved` (any application `APPROVED`) wins -> dashboard**, even with a newer incomplete application.
- **`hasValidSession()` = refresh token present AND `validUntil` parses to a future date.** No access-token requirement, no skew margin.
- Keep existing query keys; the new statuses query uses key `['applicationStatuses']`.
- No emojis; no em or en dashes.
- `git add <specific files>` only; one commit per task. Per-task gate: `npm run lint && npx tsc -p tsconfig.json --noEmit` clean + the task's tests green. Global `testTimeout: 30000` is set; run vitest plain.

---

### Task 1: Session rehydration (Bug A)

**Files:**
- Modify: `src/api/tokenStore.ts`, `src/state/sessionStore.ts`
- Test: `src/api/tokenStore.test.ts` (extend), `src/state/sessionStore.rehydrate.test.ts` (create)

**Interfaces:**
- Produces: `tokenStore.hasValidSession(): boolean`; `sessionStore` initial `loggedIn` reflects it on boot.

- [ ] **Step 1: Failing tokenStore tests.** Append to `src/api/tokenStore.test.ts` (it has `beforeEach(() => localStorage.clear())`):

```ts
  it('hasValidSession is true for a refresh token with a future validUntil', () => {
    tokenStore.setAuthTokens({ accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2999-01-01T00:00:00Z' })
    expect(tokenStore.hasValidSession()).toBe(true)
  })
  it('hasValidSession is false when validUntil is in the past', () => {
    tokenStore.setAuthTokens({ accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2000-01-01T00:00:00Z' })
    expect(tokenStore.hasValidSession()).toBe(false)
  })
  it('hasValidSession is false with no refresh token', () => {
    localStorage.setItem(STORAGE_KEYS.validUntil, '2999-01-01T00:00:00Z')
    expect(tokenStore.hasValidSession()).toBe(false)
  })
  it('hasValidSession is false for an empty or unparseable validUntil', () => {
    tokenStore.setAuthTokens({ accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: 'not-a-date' })
    expect(tokenStore.hasValidSession()).toBe(false)
  })
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/api/tokenStore.test.ts`.

- [ ] **Step 3: Implement `hasValidSession`** in `src/api/tokenStore.ts` (add to the `tokenStore` object, after `getValidUntil`):

```ts
  hasValidSession: (): boolean => {
    const refresh = read(STORAGE_KEYS.refreshToken)
    const validUntil = read(STORAGE_KEYS.validUntil)
    if (!refresh || !validUntil) return false
    const expiry = Date.parse(validUntil)
    return Number.isFinite(expiry) && expiry > Date.now()
  },
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/api/tokenStore.test.ts`.

- [ ] **Step 5: Failing rehydration test.** Create `src/state/sessionStore.rehydrate.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { STORAGE_KEYS } from '@/api/tokenStore'

describe('sessionStore rehydration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('rehydrates loggedIn=true from a valid persisted session', async () => {
    localStorage.setItem(STORAGE_KEYS.refreshToken, 'r')
    localStorage.setItem(STORAGE_KEYS.validUntil, '2999-01-01T00:00:00Z')
    const { useSessionStore } = await import('./sessionStore')
    expect(useSessionStore.getState().loggedIn).toBe(true)
  })

  it('starts logged out when there is no valid session', async () => {
    const { useSessionStore } = await import('./sessionStore')
    expect(useSessionStore.getState().loggedIn).toBe(false)
  })

  it('starts logged out when validUntil is in the past', async () => {
    localStorage.setItem(STORAGE_KEYS.refreshToken, 'r')
    localStorage.setItem(STORAGE_KEYS.validUntil, '2000-01-01T00:00:00Z')
    const { useSessionStore } = await import('./sessionStore')
    expect(useSessionStore.getState().loggedIn).toBe(false)
  })
})
```

- [ ] **Step 6: Run, verify FAIL** — `npx vitest run src/state/sessionStore.rehydrate.test.ts`.

- [ ] **Step 7: Implement rehydration** in `src/state/sessionStore.ts`:

```ts
import { create } from 'zustand'
import { tokenStore } from '@/api/tokenStore'

interface SessionState {
  loggedIn: boolean
  setLoggedIn: (v: boolean) => void
  reset: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  // Rehydrate from a valid persisted token so a logged-in session survives a
  // full page load (refresh / direct navigation), not just in-session routing.
  loggedIn: tokenStore.hasValidSession(),
  setLoggedIn: (v) => set({ loggedIn: v }),
  reset: () => set({ loggedIn: false }),
}))
```

- [ ] **Step 8: Run, verify PASS** — `npx vitest run src/state/sessionStore.rehydrate.test.ts src/state/sessionStore.test.ts` (both green; the existing file's `beforeEach` calls `reset()` and its localStorage is empty).

- [ ] **Step 9: Verify + commit**

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint
git add src/api/tokenStore.ts src/api/tokenStore.test.ts src/state/sessionStore.ts src/state/sessionStore.rehydrate.test.ts
git commit -m "fix(auth): rehydrate session loggedIn from a valid persisted token on boot"
```

---

### Task 2: Application-status data layer (`check_application_statuses`)

**Files:**
- Modify: `src/features/onboarding/api/types.ts` (add `ApplicationStatusResponse`)
- Modify: `src/features/onboarding/api/onboardingApi.ts` (add `loadApplicationStatuses`)
- Modify: `src/features/onboarding/api/onboardingApi.test.ts`
- Modify: `src/features/onboarding/api/onboardingQueries.ts` (add `useApplicationStatuses`)
- Modify: `src/features/onboarding/api/onboardingQueries.test.tsx`

This task is additive — `loadApplication`/`useApplication` and `OnboardingScreen` are untouched, so the tree stays green.

**Interfaces:**
- Produces: `ApplicationStatusResponse` (fields below); `loadApplicationStatuses(): Promise<ApplicationStatusResponse[]>`; `useApplicationStatuses(enabled: boolean)` (query key `['applicationStatuses']`, returns `ApplicationStatusResponse[]`).

- [ ] **Step 1: Add the type** to `src/features/onboarding/api/types.ts` (append):

```ts
// Returned by the `check_application_statuses` action (snake_case from the backend).
// This is the real application lifecycle status; getLastApplicationsInfo has no status.
export interface ApplicationStatusResponse {
  application_id: string
  application_type: string
  application_status: string
  organization_id: string
  appropriateness_level: string
  preKycRequired: boolean
  client_boarded_green_id: boolean
  green_id_status: string
}
```

- [ ] **Step 2: Failing api test.** Append to `src/features/onboarding/api/onboardingApi.test.ts`:

```ts
  it('loadApplicationStatuses posts check_application_statuses and returns the array', async () => {
    http.tfboCall.mockResolvedValue({ payload: [{ result: [{ application_status: 'APPROVED' }] }] })
    const { loadApplicationStatuses } = await import('./onboardingApi')
    const statuses = await loadApplicationStatuses()
    expect(http.tfboCall).toHaveBeenCalledWith('application', 'check_application_statuses', {}, 0)
    expect(statuses[0]?.application_status).toBe('APPROVED')
  })

  it('loadApplicationStatuses returns [] for a non-array payload', async () => {
    http.tfboCall.mockResolvedValue({ payload: [{ result: {} }] })
    const { loadApplicationStatuses } = await import('./onboardingApi')
    expect(await loadApplicationStatuses()).toEqual([])
  })
```

(`Authorize.Yes === 0`.)

- [ ] **Step 3: Run, verify FAIL** — `npx vitest run src/features/onboarding/api/onboardingApi.test.ts`.

- [ ] **Step 4: Implement** in `src/features/onboarding/api/onboardingApi.ts`. Add `ApplicationStatusResponse` to the type import from `./types`, and append:

```ts
export const loadApplicationStatuses = async (): Promise<ApplicationStatusResponse[]> => {
  const res = await getHttpClient().tfboCall<ApplicationStatusResponse[]>('application', 'check_application_statuses', {}, Authorize.Yes)
  const statuses = res.payload?.[0]?.result
  return Array.isArray(statuses) ? statuses : []
}
```

- [ ] **Step 5: Run, verify PASS** — `npx vitest run src/features/onboarding/api/onboardingApi.test.ts`.

- [ ] **Step 6: Add the query** to `src/features/onboarding/api/onboardingQueries.ts`:

```ts
export const useApplicationStatuses = (enabled: boolean) =>
  useQuery({ queryKey: ['applicationStatuses'], queryFn: api.loadApplicationStatuses, enabled })
```

- [ ] **Step 7: Failing query test.** In `src/features/onboarding/api/onboardingQueries.test.tsx`, add `loadApplicationStatuses: vi.fn()` to the `api` mock object, and add:

```ts
describe('useApplicationStatuses', () => {
  it('loads the statuses array', async () => {
    api.loadApplicationStatuses.mockResolvedValue([{ application_status: 'APPROVED' }])
    const { useApplicationStatuses } = await import('./onboardingQueries')
    const { result } = renderHook(() => useApplicationStatuses(true), { wrapper })
    await waitFor(() => expect(result.current.data?.[0]?.application_status).toBe('APPROVED'))
  })
})
```

- [ ] **Step 8: Run, verify PASS** — `npx vitest run src/features/onboarding/api/onboardingQueries.test.tsx`.

- [ ] **Step 9: Verify + commit**

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint
git add src/features/onboarding/api/types.ts src/features/onboarding/api/onboardingApi.ts src/features/onboarding/api/onboardingApi.test.ts src/features/onboarding/api/onboardingQueries.ts src/features/onboarding/api/onboardingQueries.test.tsx
git commit -m "feat(onboarding): load real application status via check_application_statuses"
```

---

### Task 3: OnboardingScreen routes by real status

**Files:**
- Modify: `src/features/onboarding/OnboardingScreen.tsx`
- Modify: `src/features/onboarding/OnboardingScreen.approved.test.tsx`, `OnboardingScreen.completion.test.tsx`

**Interfaces:**
- Consumes: `useApplication` (form blob) and `useApplicationStatuses` (status). Redirects to `/dashboard` when `hasApproved`; routes non-approved by latest `application_status`.

- [ ] **Step 1: Rewrite the approved test** for the real signal. Replace `src/features/onboarding/OnboardingScreen.approved.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const navigate = vi.fn()
vi.mock('./api/onboardingQueries', () => ({
  useApplication: () => ({ data: { applicationId: 1 }, isLoading: false }),
  useApplicationStatuses: () => ({
    data: [{ application_status: 'APPROVED' }, { application_status: 'INCOMPLETE' }],
    isLoading: false,
  }),
  useQuestions: () => ({ data: [] }),
  useIncrementalSubmit: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelOne: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelTwo: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./flows/simplified/useQuestionsList', () => ({ useQuestionsList: () => [] }))
vi.mock('./hooks/useApplicantCountry', () => ({ useApplicantCountry: () => undefined }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => navigate.mockReset())

describe('OnboardingScreen (approved among multiple applications)', () => {
  it('redirects to the dashboard when any application is approved', async () => {
    const { OnboardingScreen } = await import('./OnboardingScreen')
    render(<OnboardingScreen />)
    expect(navigate).toHaveBeenCalledWith({ to: '/dashboard' })
  })
})
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/features/onboarding/OnboardingScreen.approved.test.tsx` (the current screen does not call `useApplicationStatuses`, so the mocked module's absence of the old `status` path means it does not redirect on `hasApproved`).

- [ ] **Step 3: Update `OnboardingScreen.tsx`.** Add the import and rewire the data + decision.

Change the import line 5 area to include the new hook:
```tsx
import { useApplication, useApplicationStatuses } from './api/onboardingQueries'
```

Replace:
```tsx
  const { data: app, isLoading } = useApplication(true)
```
with:
```tsx
  const { data: app, isLoading: appLoading } = useApplication(true)
  const { data: statuses, isLoading: statusLoading } = useApplicationStatuses(true)
  const hasApproved = (statuses ?? []).some((s) => s.application_status === 'APPROVED')
  const latestStatus = statuses?.[statuses.length - 1]?.application_status
```

(The `hydrate` effect, `useQuestionsList`, `useApplicantCountry`, `selectFlow(app ?? {}, country)`, `jurisdiction`, and `steps` lines are unchanged — they keep using the form `app`.)

Replace the decision block (the loading guard through the status branches) with:
```tsx
  if (appLoading || statusLoading || !statuses) return <Typography>Loading your application...</Typography>
  if (hasApproved) return <ApprovedRedirect />
  if (!app) return <Typography>Loading your application...</Typography>

  const status = latestStatus ?? 'INCOMPLETE'
  if (status === 'DENIED' || status === 'FAILED') {
    return <Typography>Your application was not approved. Please contact support for assistance.</Typography>
  }
  if (status === 'LEVEL1_APPROVED' && !draft.completed) {
    return <Level1Done applicationId={app.applicationId} />
  }
  if (status === 'PENDING_KYC' || status === 'PENDING_REVIEW') {
    return <OnboardingComplete />
  }

  if (flow.kind === 'general') {
    if (questions.length === 0) return <Typography>Loading questions...</Typography>
    return <GeneralFlow steps={steps} applicationId={app.applicationId} questions={questions} />
  }
  if (flow.kind === 'unsupported') {
    return <JurisdictionNotAvailable domain={flow.domain} />
  }
  return <SimplifiedFlow status={status} applicationId={app.applicationId} />
```

(The previous `const status = app.status ?? 'INCOMPLETE'` and the standalone `if (status === 'APPROVED') return <ApprovedRedirect />` are removed; status now comes from `latestStatus`, and approval is handled by `hasApproved`.)

- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/features/onboarding/OnboardingScreen.approved.test.tsx`.

- [ ] **Step 5: Update the completion test** (status now comes from `useApplicationStatuses`). In `src/features/onboarding/OnboardingScreen.completion.test.tsx`, change the `./api/onboardingQueries` mock so `useApplication` returns a form blob and `useApplicationStatuses` carries the status:

```tsx
  useApplication: () => ({ data: { applicationId: 1 }, isLoading: false }),
  useApplicationStatuses: () => ({ data: [{ application_status: 'PENDING_KYC' }], isLoading: false }),
```
(Keep the rest of that mock — `useQuestions`, the submit mutations — and the existing email-gate assertions unchanged.)

- [ ] **Step 6: Run the full onboarding suite** — `npx vitest run src/features/onboarding` (all pass). If any other test that renders `OnboardingScreen` fails because `useApplicationStatuses` is unmocked, add `useApplicationStatuses: () => ({ data: [], isLoading: false })` to that test's `onboardingQueries` mock (empty -> non-approved -> existing flow). Do not weaken assertions.

- [ ] **Step 7: Verify + commit**

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint
git add src/features/onboarding/OnboardingScreen.tsx src/features/onboarding/OnboardingScreen.approved.test.tsx src/features/onboarding/OnboardingScreen.completion.test.tsx
git commit -m "fix(onboarding): route by real application status; approved users land on dashboard"
```

---

### Task 4: e2e — approved user reaches the dashboard via real status

**Files:**
- Modify: `e2e/dashboard.spec.ts`

The existing dashboard spec drives approval via `getLastApplicationsInfo` status, which no longer gates the redirect — it must mock `check_application_statuses`.

- [ ] **Step 1: Update `e2e/dashboard.spec.ts`.** In the existing approved-user test's `**/nsdata` handler, add a `check_application_statuses` branch returning an approved status, and keep `getLastApplicationsInfo` returning a form blob:

```ts
    if (action === 'getLastApplicationsInfo') return ok([{ applicationId: 1, completed: true }])
    if (action === 'check_application_statuses') return ok([{ application_status: 'APPROVED' }])
```

(Add the `check_application_statuses` line to every test in this spec that expects the dashboard. Other specs that expect onboarding — `auth.spec.ts`, `onboarding.spec.ts`, `registration.spec.ts` — need no change: their default `ok({})` makes `check_application_statuses` return a non-array -> `[]` -> non-approved -> onboarding.)

- [ ] **Step 2: Add an explicit multi-application test** to `e2e/dashboard.spec.ts` (approved + newer incomplete still lands on dashboard):

```ts
test('approved user with a newer incomplete application still lands on the dashboard', async ({ page }) => {
  await page.route('**/auth/login', (route) =>
    route.fulfill({ json: { status: 'OK', tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } } })
  )
  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    const ok = (result: unknown) =>
      route.fulfill({ json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] } })
    if (action === 'get_user') return ok({ id: 1, email: 'a@b.com', additionalAttributes: {} })
    if (action === 'getLastApplicationsInfo') return ok([{ applicationId: 1, completed: true }])
    if (action === 'check_application_statuses')
      return ok([{ application_status: 'APPROVED' }, { application_status: 'INCOMPLETE' }])
    if (action === 'getQuestions') return ok([])
    return ok({})
  })

  await page.goto('/account/login')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByLabel('Password', { exact: true }).fill('secret1')
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible()
})
```

- [ ] **Step 3: Run e2e** — `npx playwright test e2e/dashboard.spec.ts e2e/auth.spec.ts e2e/onboarding.spec.ts --reporter=line` (all pass). Debug selectors/mocks if needed; do not weaken assertions.

- [ ] **Step 4: Commit**

```bash
git add e2e/dashboard.spec.ts
git commit -m "test(e2e): approved user (incl. with newer incomplete app) lands on dashboard via real status"
```

---

### Task 5: Full verification gate

- [ ] **Step 1: Run the whole suite** — `npm run lint && npx tsc -p tsconfig.json --noEmit && npx vitest run && npx playwright test` (all green).

- [ ] **Step 2:** If fixes were required, commit them; otherwise no commit.

- [ ] **Step 3: Confirm definition of done** against the spec: portal-3.0 calls `check_application_statuses`; `OnboardingScreen` redirects to `/dashboard` on `hasApproved` and routes non-approved users by their real latest `application_status`; an approved account (incl. with a newer in-progress application) lands on `/dashboard`; a valid persisted session survives a reload / direct navigation; all suites green.

---

## Self-review notes

- **Spec coverage:** Bug A rehydration (Task 1); status data layer (Task 2); real-status decision + `hasApproved` redirect (Task 3); e2e (Task 4); gate (Task 5). All design sections map to tasks.
- **Additive Task 2** keeps the tree green before the screen is rewired in Task 3.
- **Form vs status separation:** `getLastApplicationsInfo`/`useApplication` remain the form-data source (draft, `applicationId`, `selectFlow`); `check_application_statuses`/`useApplicationStatuses` are the status source. Both are loaded by `OnboardingScreen`.
- **`hasApproved` wins** (any application `APPROVED` -> dashboard), matching the confirmed landing rule; non-approved users branch on the real latest `application_status` (same branch set as before, now correctly grounded).
- **Type consistency:** `loadApplicationStatuses(): Promise<ApplicationStatusResponse[]>`, `useApplicationStatuses(enabled: boolean)`, and `ApplicationStatusResponse.application_status` are used consistently across Tasks 2/3/4; `hasApproved`/`latestStatus` appear once in the screen. `tokenStore.hasValidSession()` matches its `sessionStore` consumer.
- **e2e default handler** covers the non-approved case (`ok({})` -> `[]` -> onboarding), so only the dashboard spec needs the explicit `check_application_statuses` branch.
- **Determinism:** `Date.parse`/`Date.now` are app/test code (allowed); tests use fixed far-future/past dates.

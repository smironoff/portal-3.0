# Post-login Landing (hasApproved) + Session Rehydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Approved users land on `/dashboard` after login even when a newer in-progress application exists, and a valid persisted session survives reloads / direct navigation.

**Architecture:** `getLastApplicationsInfo` already returns the full `AppInfo[]`; switch the data layer to expose the whole array, derive `hasApproved` (any app with `status === 'APPROVED'`), and have `OnboardingScreen` redirect on `hasApproved` (replacing the single-latest-app `status === 'APPROVED'` check). Separately, derive `sessionStore`'s initial `loggedIn` from a valid persisted token so `AuthenticatedRoute` stops bouncing authenticated users on a full page load.

**Tech Stack:** React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), TanStack Router + Query, Zustand, Vitest + Testing Library, Playwright.

**Reference:** `docs/superpowers/specs/2026-06-28-post-login-landing-and-session-rehydration-design.md`; legacy `landUser` in `portal-2.0/src/components/Container/App/index.tsx`.

## Global Constraints

- **Node 20.** Windows host; plain `npm`/`npx`.
- **Arrow functions only**; TS strict.
- **`hasApproved` is the only addition to the dashboard path** — non-approved users' behaviour is unchanged.
- **Preserve the `['application']` query key** — it is invalidated in `emailQueries.ts:14`, `GeneralFlow.tsx:78`, `SimplifiedFlow.tsx:49`; those must keep working.
- **`hasValidSession()` = refresh token present AND `validUntil` parses to a future date.** No access-token requirement, no skew margin (per spec).
- No emojis; no em or en dashes.
- `git add <specific files>` only; one commit per task. Per-task gate: `npm run lint && npx tsc -p tsconfig.json --noEmit` clean + the task's tests green. Global `testTimeout: 30000` is set; run vitest plain.

---

### Task 1: Session rehydration (Bug A)

**Files:**
- Modify: `src/api/tokenStore.ts` (add `hasValidSession`)
- Modify: `src/state/sessionStore.ts` (derive initial `loggedIn`)
- Test: `src/api/tokenStore.test.ts` (extend), `src/state/sessionStore.rehydrate.test.ts` (create)

**Interfaces:**
- Produces: `tokenStore.hasValidSession(): boolean`. `sessionStore` initial `loggedIn` reflects it on boot.

- [ ] **Step 1: Write failing tokenStore tests.** Append to `src/api/tokenStore.test.ts` (it already has `beforeEach(() => localStorage.clear())`):

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

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/api/tokenStore.test.ts` (`hasValidSession` is not a function).

- [ ] **Step 3: Implement `hasValidSession`** in `src/api/tokenStore.ts`. Add this method to the `tokenStore` object (e.g. after `getValidUntil`):

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

- [ ] **Step 5: Write failing sessionStore rehydration test.** Create `src/state/sessionStore.rehydrate.test.ts`:

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

- [ ] **Step 6: Run, verify FAIL** — `npx vitest run src/state/sessionStore.rehydrate.test.ts` (initial `loggedIn` is hardcoded `false`).

- [ ] **Step 7: Implement rehydration** in `src/state/sessionStore.ts`. Add the import and derive the initial value:

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

- [ ] **Step 8: Run, verify PASS** — `npx vitest run src/state/sessionStore.rehydrate.test.ts src/state/sessionStore.test.ts` (both files; the existing `sessionStore.test.ts` still passes because its `beforeEach` calls `reset()` and localStorage is empty in that file).

- [ ] **Step 9: Verify + commit**

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint
git add src/api/tokenStore.ts src/api/tokenStore.test.ts src/state/sessionStore.ts src/state/sessionStore.rehydrate.test.ts
git commit -m "fix(auth): rehydrate session loggedIn from a valid persisted token on boot"
```

---

### Task 2: Landing logic — hasApproved (Bug B)

**Files:**
- Modify: `src/features/onboarding/api/onboardingApi.ts` (`loadApplication` -> `loadApplications`)
- Modify: `src/features/onboarding/api/onboardingApi.test.ts`
- Modify: `src/features/onboarding/api/onboardingQueries.ts` (`useApplication` -> `useApplications`)
- Modify: `src/features/onboarding/api/onboardingQueries.test.tsx`
- Modify: `src/features/onboarding/OnboardingScreen.tsx`
- Modify: `src/features/onboarding/OnboardingScreen.approved.test.tsx`, `OnboardingScreen.completion.test.tsx`, `src/features/onboarding/flows/simplified/SimplifiedFlow.test.tsx`

**Interfaces:**
- Consumes: `tfboCall` `getLastApplicationsInfo` (returns `AppInfo[]`).
- Produces: `loadApplications(): Promise<AppInfo[]>`; `useApplications(enabled: boolean)` (query key `['application']`, returns `AppInfo[]`). `OnboardingScreen` redirects to `/dashboard` when any application is `APPROVED`.

- [ ] **Step 1: Replace `loadApplication` with `loadApplications`** in `src/features/onboarding/api/onboardingApi.ts`. Change:

```ts
export const loadApplication = async (): Promise<AppInfo | undefined> => {
  const res = await getHttpClient().tfboCall<AppInfo[]>('application', 'getLastApplicationsInfo', {}, Authorize.Yes)
  const apps = res.payload?.[0]?.result
  return Array.isArray(apps) ? apps[apps.length - 1] : undefined
}
```

to:

```ts
export const loadApplications = async (): Promise<AppInfo[]> => {
  const res = await getHttpClient().tfboCall<AppInfo[]>('application', 'getLastApplicationsInfo', {}, Authorize.Yes)
  const apps = res.payload?.[0]?.result
  return Array.isArray(apps) ? apps : []
}
```

- [ ] **Step 2: Update `onboardingApi.test.ts`.** Replace the existing `loadApplication` test with:

```ts
  it('loadApplications returns the full applications array', async () => {
    http.tfboCall.mockResolvedValue({
      payload: [{ result: [{ applicationId: 1, status: 'APPROVED' }, { applicationId: 2, status: 'INCOMPLETE' }] }],
    })
    const { loadApplications } = await import('./onboardingApi')
    const apps = await loadApplications()
    expect(http.tfboCall).toHaveBeenCalledWith('application', 'getLastApplicationsInfo', {}, 0)
    expect(apps).toHaveLength(2)
    expect(apps[1]?.status).toBe('INCOMPLETE')
  })

  it('loadApplications returns [] when the payload has no array', async () => {
    http.tfboCall.mockResolvedValue({ payload: [{ result: undefined }] })
    const { loadApplications } = await import('./onboardingApi')
    expect(await loadApplications()).toEqual([])
  })
```

(`Authorize.Yes === 0`. Keep the file's existing `getQuestions`/submit tests unchanged.)

- [ ] **Step 3: Replace `useApplication` with `useApplications`** in `src/features/onboarding/api/onboardingQueries.ts`:

```ts
export const useApplications = (enabled: boolean) =>
  useQuery({ queryKey: ['application'], queryFn: api.loadApplications, enabled })
```

(Keep the `['application']` key so existing invalidations refetch it. The other hooks in this file are unchanged.)

- [ ] **Step 4: Update `onboardingQueries.test.tsx`.** In the `api` mock object replace `loadApplication: vi.fn()` with `loadApplications: vi.fn()`, and replace the `useApplication` test with:

```ts
describe('useApplications', () => {
  it('loads the applications array', async () => {
    api.loadApplications.mockResolvedValue([{ status: 'INCOMPLETE' }])
    const { useApplications } = await import('./onboardingQueries')
    const { result } = renderHook(() => useApplications(true), { wrapper })
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('INCOMPLETE'))
  })
})
```

- [ ] **Step 5: Write the failing OnboardingScreen test** for the exact bug. Replace the mock + assertions in `src/features/onboarding/OnboardingScreen.approved.test.tsx` so it covers an approved account with a newer incomplete application:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const navigate = vi.fn()
vi.mock('./api/onboardingQueries', () => ({
  useApplications: () => ({
    data: [{ applicationId: 1, status: 'APPROVED' }, { applicationId: 2, status: 'INCOMPLETE' }],
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

- [ ] **Step 6: Run, verify FAIL** — `npx vitest run src/features/onboarding/OnboardingScreen.approved.test.tsx` (current screen imports `useApplication` and decides from the latest app `INCOMPLETE`, so it does not navigate; the mock provides `useApplications`, so the screen using `useApplication` gets `undefined` and shows loading).

- [ ] **Step 7: Update `OnboardingScreen.tsx`.** Change the import on line 5 from `useApplication` to `useApplications`, and replace the component body's data handling. Specifically:

Replace:
```tsx
  const { data: app, isLoading } = useApplication(true)
```
with:
```tsx
  const { data: apps, isLoading } = useApplications(true)
  const hasApproved = (apps ?? []).some((a) => a.status === 'APPROVED')
  const current = apps?.[apps.length - 1]
```

Replace the `selectFlow(app ?? {}, country)` call with `selectFlow(current ?? {}, country)`.

Replace the hydrate effect so it uses `current`:
```tsx
  useEffect(() => {
    if (current && !hydrated.current) {
      hydrate(current)
      hydrated.current = true
    }
  }, [current, hydrate])
```

Replace the decision block (from the loading guard through the status branches) with:
```tsx
  if (isLoading || !apps) return <Typography>Loading your application...</Typography>
  if (hasApproved) return <ApprovedRedirect />
  if (!current) return <Typography>Loading your application...</Typography>

  const status = current.status ?? 'INCOMPLETE'
  if (status === 'DENIED' || status === 'FAILED') {
    return <Typography>Your application was not approved. Please contact support for assistance.</Typography>
  }
  if (status === 'LEVEL1_APPROVED' && !draft.completed) {
    return <Level1Done applicationId={current.applicationId} />
  }
  if (status === 'PENDING_KYC' || status === 'PENDING_REVIEW') {
    return <OnboardingComplete />
  }

  if (flow.kind === 'general') {
    if (questions.length === 0) return <Typography>Loading questions...</Typography>
    return <GeneralFlow steps={steps} applicationId={current.applicationId} questions={questions} />
  }
  if (flow.kind === 'unsupported') {
    return <JurisdictionNotAvailable domain={flow.domain} />
  }
  return <SimplifiedFlow status={status} applicationId={current.applicationId} />
```

(The previous standalone `if (status === 'APPROVED') return <ApprovedRedirect />` branch is removed — it is subsumed by the `hasApproved` check.)

- [ ] **Step 8: Run, verify PASS** — `npx vitest run src/features/onboarding/OnboardingScreen.approved.test.tsx`.

- [ ] **Step 9: Fix the other affected test mocks** (they mock the old `useApplication`). Update each to `useApplications` returning an array:

In `src/features/onboarding/OnboardingScreen.completion.test.tsx`, change the `./api/onboardingQueries` mock's `useApplication` line to:
```tsx
  useApplications: () => ({ data: [{ applicationId: 1, status: 'PENDING_KYC' }], isLoading: false }),
```

In `src/features/onboarding/flows/simplified/SimplifiedFlow.test.tsx`, change the `useApplication` line in its `../../api/onboardingQueries` mock to:
```tsx
  useApplications: () => ({ data: [{ applicationId: 1, status: 'INCOMPLETE' }], isLoading: false }),
```

- [ ] **Step 10: Run the full onboarding suite** — `npx vitest run src/features/onboarding` (all pass, including completion and SimplifiedFlow). Fix any remaining mock-shape mismatches the same way (provide `useApplications` returning an array). Do not weaken assertions.

- [ ] **Step 11: Verify + commit**

```bash
npx tsc -p tsconfig.json --noEmit && npm run lint
git add src/features/onboarding/api/onboardingApi.ts src/features/onboarding/api/onboardingApi.test.ts src/features/onboarding/api/onboardingQueries.ts src/features/onboarding/api/onboardingQueries.test.tsx src/features/onboarding/OnboardingScreen.tsx src/features/onboarding/OnboardingScreen.approved.test.tsx src/features/onboarding/OnboardingScreen.completion.test.tsx src/features/onboarding/flows/simplified/SimplifiedFlow.test.tsx
git commit -m "fix(onboarding): land approved users on the dashboard via whole-list hasApproved"
```

---

### Task 3: e2e — approved-with-newer-incomplete lands on dashboard

**Files:**
- Modify: `e2e/dashboard.spec.ts`

- [ ] **Step 1: Add a test** to `e2e/dashboard.spec.ts` proving the reported scenario. It mirrors the existing approved-user test but returns TWO applications (approved + a newer incomplete one):

```ts
test('approved user with a newer incomplete application still lands on the dashboard', async ({ page }) => {
  await page.route('**/auth/login', (route) =>
    route.fulfill({
      json: { status: 'OK', tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } },
    })
  )
  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    const ok = (result: unknown) =>
      route.fulfill({ json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] } })
    if (action === 'get_user') return ok({ id: 1, email: 'a@b.com', additionalAttributes: {} })
    if (action === 'getLastApplicationsInfo')
      return ok([{ applicationId: 1, status: 'APPROVED' }, { applicationId: 2, status: 'INCOMPLETE' }])
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

- [ ] **Step 2: Run e2e** — `npx playwright test e2e/dashboard.spec.ts e2e/auth.spec.ts e2e/onboarding.spec.ts --reporter=line` (all pass; the existing single-APPROVED and INCOMPLETE-onboarding specs remain valid). Debug selectors/mocks if needed; do not weaken assertions.

- [ ] **Step 3: Commit**

```bash
git add e2e/dashboard.spec.ts
git commit -m "test(e2e): approved user with a newer incomplete application lands on dashboard"
```

---

### Task 4: Full verification gate

- [ ] **Step 1: Run the whole suite** — `npm run lint && npx tsc -p tsconfig.json --noEmit && npx vitest run && npx playwright test` (all green).

- [ ] **Step 2:** If fixes were required, commit them with a clear message; otherwise no commit.

- [ ] **Step 3: Confirm definition of done** against the spec: approved account with a newer in-progress application lands on `/dashboard`; `useApplications` exposes the whole array and `OnboardingScreen` redirects on `hasApproved`; non-approved behaviour unchanged; a valid persisted session survives a reload / direct navigation (covered by the rehydration unit tests); all suites green.

---

## Self-review notes

- **Spec coverage:** Bug A session rehydration (Task 1); Bug B data layer + `hasApproved` decision (Task 2); approved-multi-app e2e (Task 3); gate (Task 4). All design sections map to tasks.
- **`['application']` key preserved** (Task 2 Step 3) so the three existing invalidations keep working — called out in Global Constraints.
- **Non-approved behaviour unchanged:** the only added dashboard path is the `hasApproved` redirect; all other status branches and flow selection are byte-for-byte the same, just reading `current` instead of `app`.
- **Type consistency:** `loadApplications(): Promise<AppInfo[]>` and `useApplications(enabled: boolean)` returning `AppInfo[]` are used consistently across Tasks 2/3; `current = apps?.[apps.length - 1]` and `hasApproved = (apps ?? []).some(...)` appear once in the screen. `tokenStore.hasValidSession()` signature matches its consumer in `sessionStore`.
- **Empty-array edge** preserved: `apps === []` (loaded, no application) -> `!current` -> the same "Loading your application..." the old `!app` path produced; no behaviour change.
- **Determinism:** `Date.parse`/`Date.now` are used in app/test code (allowed); tests seed fixed far-future/past dates, no reliance on the current clock beyond past-vs-future.

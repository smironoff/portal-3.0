# Simplified Registration + Onboarding Reconciliation — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make email/password registration for a Simplified-flow country create an account via the real backend sequence (`/auth/register` → `simplified_submit_level_one`) at a new Personal Information screen, and let Simplified onboarding proceed without stranding.

**Architecture:** Registration becomes backend-free (collect email/pw/country into an in-memory registration store, navigate to a new public Personal Information screen). That screen collects name/DOB and calls a create-account seam: `registerUser` (auth/register → tokens) then `submitLevelOne` (simplified_submit_level_one → application). Then the user is authenticated and lands on `/onboarding`, which tolerates an empty `getLastApplicationsInfo` and submits each step via `simplified_submit_level_*`.

**Tech Stack:** React 19, TS 6 (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), TanStack Router + Query, Zustand, RHF + Zod, MUI v9, Vitest + Testing Library, Playwright.

**Reference:** `docs/superpowers/specs/2026-06-28-simplified-registration-onboarding-reconciliation-design.md`; `docs/superpowers/research/2026-06-28-legacy-registration-onboarding-flow.md`.

## Global Constraints

- **Node 20.** Windows host; plain `npm`/`npx`.
- **Arrow functions only**; TS strict.
- **Hardcoded British English copy** in components (the codebase does not use react-i18next outside `src/features/auth`); no em or en dashes; no emojis.
- **The verified create sequence is `/auth/register` then `application/simplified_submit_level_one` (Authorize.Yes).** Registration itself makes NO backend call. Never use `incremental_submit` for the simplified create.
- **Password lives only in memory** (the registration store); never persist it to localStorage. Clear it after the create succeeds.
- **No notification renderer exists** — surface registration/create errors INLINE on the form, not via the notification store.
- **Create-account seam:** the auth-establishment step (`registerUser`) and the app-create step (`submitLevelOne`) are separate functions so Phase B (social) can reuse the app-create half.
- `git add <specific files>` only; one commit per task. Per-task gate: `npm run lint && npx tsc -p tsconfig.json --noEmit` clean + the task's tests green. Global vitest `testTimeout` is 30000; run vitest plain.

---

### Task 1: `registerUser` auth API (auth/register)

**Files:**
- Modify: `src/features/auth/api/authApi.ts`, `src/features/auth/api/authTypes.ts` (add `RegisterUserParams`)
- Test: `src/features/auth/api/authApi.test.ts`

**Interfaces:**
- Produces: `registerUser(params: RegisterUserParams): Promise<AuthResult>` posting `auth/register` (Authorize.No), returning `{ status, tokens? }` like `login`.
- `RegisterUserParams = { email_id: string; password: string; first_name: string; last_name: string; country: number; account_holder_title: string; preferred_language_code?: string; brand: string; source?: string }`.

- [ ] **Step 1: Add the type** to `src/features/auth/api/authTypes.ts` (append):
```ts
export interface RegisterUserParams {
  email_id: string
  password: string
  first_name: string
  last_name: string
  country: number
  account_holder_title: string
  preferred_language_code?: string
  brand: string
  source?: string
}
```

- [ ] **Step 2: Write the failing test.** Append to `src/features/auth/api/authApi.test.ts` (it mocks the http client; mirror the existing `login`/`requestPasswordReset` test style — the client exposes `auth`):
```ts
  it('registerUser posts auth/register unauthenticated with the snake_case body', async () => {
    const auth = vi.fn().mockResolvedValue({ status: 'OK', tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } })
    vi.doMock('@/api/client', () => ({ getHttpClient: () => ({ auth }) }))
    vi.resetModules()
    const { registerUser } = await import('./authApi')
    const { Authorize } = await import('@/api/httpClient')
    const res = await registerUser({ email_id: 'a@b.com', password: 'p', first_name: 'Test', last_name: 'User', country: 158, account_holder_title: 'Mr', preferred_language_code: 'en', brand: 'ThinkMarkets', source: 'TP3-LiveApp' })
    expect(auth).toHaveBeenCalledWith('auth/register', 'post', expect.objectContaining({ email_id: 'a@b.com', country: 158, account_holder_title: 'Mr', brand: 'ThinkMarkets' }), Authorize.No)
    expect(res.status).toBe('OK')
  })
```
(If `authApi.test.ts` already establishes the http-client mock at module scope, follow that file's exact mocking convention instead of `vi.doMock` — the assertion on `auth(...)` args is the load-bearing part.)

- [ ] **Step 3: Run it, verify FAIL** — `npx vitest run src/features/auth/api/authApi.test.ts`.

- [ ] **Step 4: Implement** in `src/features/auth/api/authApi.ts` (add the import for `RegisterUserParams` and append):
```ts
export const registerUser = (params: RegisterUserParams): Promise<AuthResult> =>
  getHttpClient().auth<AuthResult>('auth/register', 'post', params, Authorize.No)
```

- [ ] **Step 5: Run it, verify PASS**, then `npx tsc -p tsconfig.json --noEmit && npm run lint`.

- [ ] **Step 6: Commit**
```bash
git add src/features/auth/api/authApi.ts src/features/auth/api/authTypes.ts src/features/auth/api/authApi.test.ts
git commit -m "feat(auth): registerUser (auth/register) for account creation"
```

---

### Task 2: Registration store (in-flight draft)

**Files:**
- Create: `src/features/registration/state/registrationStore.ts`
- Test: `src/features/registration/state/registrationStore.test.ts`

**Interfaces:**
- Produces: `useRegistrationStore` (Zustand) with `draft: RegistrationDraft | null`, `setDraft(d)`, `clear()`.
- `RegistrationDraft = { email: string; password: string; originCountry: number; preferredOrganization: number; portalAccountDomain: string; preferredLanguage: number; agreeToAllTerms: boolean; isMarketingOptOut: boolean }`.

- [ ] **Step 1: Write the failing test** `registrationStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useRegistrationStore } from './registrationStore'

const sample = {
  email: 'a@b.com', password: 'Think123!', originCountry: 158, preferredOrganization: 14,
  portalAccountDomain: 'TMLC', preferredLanguage: 1, agreeToAllTerms: true, isMarketingOptOut: true,
}

describe('registrationStore', () => {
  beforeEach(() => useRegistrationStore.getState().clear())

  it('starts empty', () => {
    expect(useRegistrationStore.getState().draft).toBeNull()
  })
  it('stores and clears the draft', () => {
    useRegistrationStore.getState().setDraft(sample)
    expect(useRegistrationStore.getState().draft?.originCountry).toBe(158)
    useRegistrationStore.getState().clear()
    expect(useRegistrationStore.getState().draft).toBeNull()
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `registrationStore.ts`:
```ts
import { create } from 'zustand'

export interface RegistrationDraft {
  email: string
  password: string
  originCountry: number
  preferredOrganization: number
  portalAccountDomain: string
  preferredLanguage: number
  agreeToAllTerms: boolean
  isMarketingOptOut: boolean
}

interface RegistrationState {
  draft: RegistrationDraft | null
  setDraft: (d: RegistrationDraft) => void
  clear: () => void
}

// In-memory only: holds the password between the registration screen and the
// Personal Information screen. Never persisted to localStorage.
export const useRegistrationStore = create<RegistrationState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  clear: () => set({ draft: null }),
}))
```

- [ ] **Step 4: Run it, verify PASS**, then tsc + lint.

- [ ] **Step 5: Commit**
```bash
git add src/features/registration/state/registrationStore.ts src/features/registration/state/registrationStore.test.ts
git commit -m "feat(registration): in-memory registration draft store"
```

---

### Task 3: Create-account seam

**Files:**
- Create: `src/features/registration/api/createAccount.ts`
- Test: `src/features/registration/api/createAccount.test.ts`

**Interfaces:**
- Consumes: `registerUser` (Task 1), `submitLevelOne` from `@/features/onboarding/api/onboardingApi`, `tokenStore`, `useSessionStore`.
- Produces:
  - `submitInitialApplication(payload: Partial<AppInfo>): Promise<number>` — calls `submitLevelOne`, returns `applicationId` (shared with Phase B social).
  - `createSimplifiedAccount(input: CreateSimplifiedAccountInput): Promise<{ applicationId: number }>` — establishes auth via `registerUser` (stores tokens + sets `loggedIn`), then `submitInitialApplication`.
  - `CreateSimplifiedAccountInput = RegistrationDraft & { firstName: string; lastName: string; day: number; month: number; year: number; title: string; recaptchaResponse: string }`.

- [ ] **Step 1: Write the failing test** `createAccount.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const registerUser = vi.fn()
const submitLevelOne = vi.fn()
const setAuthTokens = vi.fn()
vi.mock('@/features/auth/api/authApi', () => ({ registerUser }))
vi.mock('@/features/onboarding/api/onboardingApi', () => ({ submitLevelOne }))
vi.mock('@/api/tokenStore', () => ({ tokenStore: { setAuthTokens } }))

beforeEach(() => {
  registerUser.mockReset(); submitLevelOne.mockReset(); setAuthTokens.mockReset()
})

const input = {
  email: 'a@b.com', password: 'Think123!', originCountry: 158, preferredOrganization: 14,
  portalAccountDomain: 'TMLC', preferredLanguage: 1, agreeToAllTerms: true, isMarketingOptOut: true,
  firstName: 'Test', lastName: 'User', day: 1, month: 1, year: 1990, title: 'Mr', recaptchaResponse: 'x',
}

describe('createSimplifiedAccount', () => {
  it('registers the auth user, stores tokens, sets logged in, then creates the application', async () => {
    registerUser.mockResolvedValue({ status: 'OK', tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } })
    submitLevelOne.mockResolvedValue({ applicationId: 999 })
    const { createSimplifiedAccount } = await import('./createAccount')
    const { useSessionStore } = await import('@/state/sessionStore')
    const out = await createSimplifiedAccount(input)
    expect(registerUser).toHaveBeenCalledWith(expect.objectContaining({ email_id: 'a@b.com', country: 158, account_holder_title: 'Mr' }))
    expect(setAuthTokens).toHaveBeenCalled()
    expect(useSessionStore.getState().loggedIn).toBe(true)
    expect(submitLevelOne).toHaveBeenCalledWith(expect.objectContaining({
      accountHolderEmail: 'a@b.com', originCountry: 158, accountHolderFirstName: 'Test',
      accountHolderDayOfBirth: 1, recaptchaResponse: 'x',
    }))
    expect(out.applicationId).toBe(999)
  })

  it('throws and does not create the application when auth registration fails', async () => {
    registerUser.mockResolvedValue({ status: 'ASE-008', code: 'ASE-008' })
    const { createSimplifiedAccount } = await import('./createAccount')
    await expect(createSimplifiedAccount(input)).rejects.toThrow()
    expect(submitLevelOne).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `createAccount.ts`:
```ts
import { registerUser } from '@/features/auth/api/authApi'
import { submitLevelOne } from '@/features/onboarding/api/onboardingApi'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'
import type { AppInfo } from '@/features/onboarding/api/types'
import type { RegistrationDraft } from '../state/registrationStore'

export type CreateSimplifiedAccountInput = RegistrationDraft & {
  firstName: string
  lastName: string
  day: number
  month: number
  year: number
  title: string
  recaptchaResponse: string
}

// Shared with Phase B (social): creates the application once auth is established.
export const submitInitialApplication = async (payload: Partial<AppInfo>): Promise<number> => {
  const res = await submitLevelOne(payload)
  return res.applicationId
}

export const createSimplifiedAccount = async (
  input: CreateSimplifiedAccountInput
): Promise<{ applicationId: number }> => {
  // 1) Establish auth (email/password). Phase B swaps this for a social exchange.
  const auth = await registerUser({
    email_id: input.email,
    password: input.password,
    first_name: input.firstName,
    last_name: input.lastName,
    country: input.originCountry,
    account_holder_title: input.title,
    preferred_language_code: 'en',
    brand: 'ThinkMarkets',
    source: 'TP3-LiveApp',
  })
  if (auth.status !== 'OK' || !auth.tokens) {
    throw new Error(`Registration failed: ${auth.code ?? auth.status ?? 'unknown'}`)
  }
  tokenStore.setAuthTokens(auth.tokens)
  useSessionStore.getState().setLoggedIn(true)

  // 2) Create the application (shared step).
  const applicationId = await submitInitialApplication({
    accountHolderEmail: input.email,
    accountHolderPassword: input.password,
    originCountry: input.originCountry,
    preferredOrganization: input.preferredOrganization,
    portalAccountDomain: input.portalAccountDomain,
    preferredLanguage: input.preferredLanguage,
    accountHolderFirstName: input.firstName,
    accountHolderLastName: input.lastName,
    accountHolderDayOfBirth: input.day,
    accountHolderMonthOfBirth: input.month,
    accountHolderYearOfBirth: input.year,
    accountHolderTitle: input.title,
    agreeToAllTerms: input.agreeToAllTerms,
    isMarketingOptOut: input.isMarketingOptOut,
    accountType: 'individual',
    accountTradingTypes: [1],
    brand: 'ThinkMarkets',
    source: 'TP3-LiveApp',
    recaptchaResponse: input.recaptchaResponse,
  })
  return { applicationId }
}
```
(`AppInfo` has an index signature, so the extra fields like `accountHolderEmail`/`accountTradingTypes`/`recaptchaResponse` are accepted.)

- [ ] **Step 4: Run it, verify PASS**, then tsc + lint.

- [ ] **Step 5: Commit**
```bash
git add src/features/registration/api/createAccount.ts src/features/registration/api/createAccount.test.ts
git commit -m "feat(registration): create-account seam (registerUser + simplified_submit_level_one)"
```

---

### Task 4: RegisterForm — collect only, no backend call

**Files:**
- Modify: `src/features/registration/components/RegisterForm.tsx`
- Modify/Remove: `src/features/registration/api/registerApi.ts` (drop `createLiveAccount`/`storeRegistrationAuth`), `src/features/registration/api/registerQueries.ts` (drop `useRegister`)
- Test: `src/features/registration/components/RegisterForm.test.tsx`

**Interfaces:**
- Consumes: `useRegistrationStore` (Task 2), `domainForCountry`/`organizationIdForCountry`/`getLanguageId` (existing `../country`).
- Produces: on submit, sets the registration draft and navigates to `/account/personal-information`. Makes no TFBO call.

- [ ] **Step 1: Update the RegisterForm test.** In `src/features/registration/components/RegisterForm.test.tsx`, the submit no longer calls a backend mutation; it should set the registration store and navigate. Replace the submit-path assertions so the test: fills email/password/confirm, advances, selects a country (mock `useCountries` to return a Simplified country, e.g. `{ id: 158, name: 'Nigeria', organization: { id: 14, name: 'TMLC' }, isSimplifyOnboarding: true }`), accepts terms, submits, then asserts `navigate` was called with `{ to: '/account/personal-information' }` and `useRegistrationStore.getState().draft?.originCountry === 158`. Mock `@tanstack/react-router` `useNavigate` (and `Link` if imported). Remove any mock of `useRegister`/`createLiveAccount`.

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Rework `RegisterForm.tsx` onSubmit.** Remove the `useRegister`/`createLiveAccount`/`storeRegistrationAuth`/captcha imports and the `register` mutation. The submit becomes (replace the `onSubmit` body and drop the `register.isPending` usage on the button):
```tsx
  const setDraft = useRegistrationStore((s) => s.setDraft)
  // ...
  const onSubmit = (v: Values) => {
    const country = countries.find((c) => c.id === v.countryId)
    if (!country) return
    setDraft({
      email: v.email,
      password: v.password,
      originCountry: country.id,
      preferredOrganization: organizationIdForCountry(country),
      portalAccountDomain: domainForCountry(country),
      preferredLanguage: getLanguageId(country, [], 'en'),
      agreeToAllTerms: true,
      isMarketingOptOut: !v.marketingConsent,
    })
    navigate({ to: '/account/personal-information' })
  }
```
Change the final button from `disabled={register.isPending}` / "Create account" to a plain submit labelled `Continue`. Keep the existing two-step structure, country select, terms, marketing checkbox, and the password zod schema. Remove `{captcha.element}` (captcha now runs at the Personal Information create step). Remove the `useNotificationStore`/`EmailAlreadyRegisteredError` usage (email-already is handled at the create step now).

- [ ] **Step 4: Delete the dead API.** Remove `createLiveAccount`, `storeRegistrationAuth`, and `EmailAlreadyRegisteredError` from `registerApi.ts` if no longer referenced (keep the file only if other exports remain; otherwise delete it). Delete `registerQueries.ts` (`useRegister`) if unused. Run `npx tsc -p tsconfig.json --noEmit` to confirm nothing else imports them; if something does, that import is in scope to update.

- [ ] **Step 5: Run the test, verify PASS**, then tsc + lint.

- [ ] **Step 6: Commit**
```bash
git add src/features/registration/components/RegisterForm.tsx src/features/registration/components/RegisterForm.test.tsx src/features/registration/api/registerApi.ts src/features/registration/api/registerQueries.ts
git commit -m "feat(registration): registration collects only; no backend call at sign-up"
```

---

### Task 5: Personal Information screen + route

**Files:**
- Create: `src/features/registration/components/PersonalInformationForm.tsx`
- Create: `src/features/registration/routes/personalInformation.tsx`
- Modify: `src/router/router.tsx` (register the route)
- Test: `src/features/registration/components/PersonalInformationForm.test.tsx`

**Interfaces:**
- Consumes: `useRegistrationStore` (draft), `createSimplifiedAccount` (Task 3), `useCaptcha`, `useOnboardingStore` (seed name/DOB + applicationId), `useNavigate`.
- Produces: a public `/account/personal-information` route; on success authenticates and navigates to `/onboarding`.

- [ ] **Step 1: Write the failing test** `PersonalInformationForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const navigate = vi.fn()
const createSimplifiedAccount = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('../api/createAccount', () => ({ createSimplifiedAccount }))
vi.mock('@/features/auth/hooks/useCaptcha', () => ({
  useCaptcha: () => ({ element: null, execute: async () => 'cap', reset: vi.fn() }),
}))

beforeEach(() => {
  navigate.mockReset(); createSimplifiedAccount.mockReset()
})

const seedDraft = async () => {
  const { useRegistrationStore } = await import('../state/registrationStore')
  useRegistrationStore.getState().setDraft({
    email: 'a@b.com', password: 'Think123!', originCountry: 158, preferredOrganization: 14,
    portalAccountDomain: 'TMLC', preferredLanguage: 1, agreeToAllTerms: true, isMarketingOptOut: true,
  })
}

describe('PersonalInformationForm', () => {
  it('redirects to register when there is no draft', async () => {
    const { useRegistrationStore } = await import('../state/registrationStore')
    useRegistrationStore.getState().clear()
    const { PersonalInformationForm } = await import('./PersonalInformationForm')
    render(<PersonalInformationForm />)
    expect(navigate).toHaveBeenCalledWith({ to: '/account/register' })
  })

  it('creates the account and navigates to onboarding', async () => {
    await seedDraft()
    createSimplifiedAccount.mockResolvedValue({ applicationId: 999 })
    const { PersonalInformationForm } = await import('./PersonalInformationForm')
    render(<PersonalInformationForm />)
    await userEvent.type(screen.getByLabelText(/first name/i), 'Test')
    await userEvent.type(screen.getByLabelText(/last name/i), 'User')
    await userEvent.type(screen.getByLabelText(/day/i), '1')
    await userEvent.type(screen.getByLabelText(/month/i), '1')
    await userEvent.type(screen.getByLabelText(/year/i), '1990')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(createSimplifiedAccount).toHaveBeenCalledWith(expect.objectContaining({
      email: 'a@b.com', originCountry: 158, firstName: 'Test', lastName: 'User', day: 1, month: 1, year: 1990, recaptchaResponse: 'cap',
    }))
    expect(navigate).toHaveBeenCalledWith({ to: '/onboarding' })
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `PersonalInformationForm.tsx` (RHF + Zod; mirrors the onboarding `PersonalInfoStep` field shape; uses `AuthCard` for consistent presentation):
```tsx
import { useEffect, useMemo } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { useCaptcha } from '@/features/auth/hooks/useCaptcha'
import { useRegistrationStore } from '../state/registrationStore'
import { useOnboardingStore } from '@/features/onboarding/state/onboardingStore'
import { createSimplifiedAccount } from '../api/createAccount'

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  day: z.coerce.number().int().min(1).max(31),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1900).max(2025),
})
type Values = z.infer<typeof schema>

export const PersonalInformationForm = () => {
  const navigate = useNavigate()
  const draft = useRegistrationStore((s) => s.draft)
  const clearDraft = useRegistrationStore((s) => s.clear)
  const seedOnboarding = useOnboardingStore((s) => s.patch)
  const captcha = useCaptcha()
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '' },
  })

  useEffect(() => {
    if (!draft) navigate({ to: '/account/register' })
  }, [draft, navigate])

  const onSubmit = useMemo(
    () =>
      methods.handleSubmit(async (v) => {
        if (!draft) return
        try {
          const token = await captcha.execute()
          const { applicationId } = await createSimplifiedAccount({
            ...draft,
            firstName: v.firstName,
            lastName: v.lastName,
            day: v.day,
            month: v.month,
            year: v.year,
            title: 'Mr',
            recaptchaResponse: token,
          })
          seedOnboarding({
            applicationId,
            originCountry: draft.originCountry,
            portalAccountDomain: draft.portalAccountDomain,
            accountHolderFirstName: v.firstName,
            accountHolderLastName: v.lastName,
            accountHolderDayOfBirth: v.day,
            accountHolderMonthOfBirth: v.month,
            accountHolderYearOfBirth: v.year,
          })
          clearDraft()
          navigate({ to: '/onboarding' })
        } catch {
          captcha.reset()
          methods.setError('firstName', { message: 'We could not create your account. Please try again.' })
        }
      }),
    [methods, draft, captcha, seedOnboarding, clearDraft, navigate]
  )

  return (
    <AuthCard title="Personal information">
      <FormProvider {...methods}>
        <Box component="form" onSubmit={onSubmit} noValidate>
          <Stack spacing={2}>
            <RHFTextField name="firstName" label="First name" />
            <RHFTextField name="lastName" label="Last name" />
            <RHFTextField name="day" label="Day" type="number" />
            <RHFTextField name="month" label="Month" type="number" />
            <RHFTextField name="year" label="Year" type="number" />
            <Button type="submit">Continue</Button>
            {captcha.element}
          </Stack>
        </Box>
      </FormProvider>
    </AuthCard>
  )
}
```
(`seedOnboarding` writes `originCountry`/`portalAccountDomain` into the onboarding draft via the `AppInfo` index signature; `selectFlow` reads `portalAccountDomain` from there when the form blob is empty — see Task 6.)

- [ ] **Step 4: Create the route** `src/features/registration/routes/personalInformation.tsx`:
```tsx
import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { PersonalInformationForm } from '@/features/registration/components/PersonalInformationForm'

export const PersonalInformationRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/personal-information',
  component: PersonalInformationForm,
})
```

- [ ] **Step 5: Register it** in `src/router/router.tsx`: add `import { PersonalInformationRoute } from '@/features/registration/routes/personalInformation'` and include `PersonalInformationRoute` in the `RootRoute.addChildren([...])` array (alongside `RegisterRoute`).

- [ ] **Step 6: Run the test, verify PASS**, then tsc + lint.

- [ ] **Step 7: Commit**
```bash
git add src/features/registration/components/PersonalInformationForm.tsx src/features/registration/components/PersonalInformationForm.test.tsx src/features/registration/routes/personalInformation.tsx src/router/router.tsx
git commit -m "feat(registration): Personal Information screen creates the account via the seam"
```

---

### Task 6: Onboarding tolerates an empty application

**Files:**
- Modify: `src/features/onboarding/api/onboardingApi.ts` (`loadApplication` returns `null`)
- Modify: `src/features/onboarding/OnboardingScreen.tsx`
- Test: `src/features/onboarding/api/onboardingApi.test.ts`, `src/features/onboarding/OnboardingScreen.freshApp.test.tsx` (create)

**Interfaces:**
- `loadApplication(): Promise<AppInfo | null>` (never `undefined`).
- `OnboardingScreen` uses `current = app ?? (draft as AppInfo)` for `selectFlow`/`applicationId` and does not strand when the form blob is absent.

- [ ] **Step 1: Update the api test.** In `src/features/onboarding/api/onboardingApi.test.ts`, change the `loadApplication` empty-payload expectation to `null`:
```ts
  it('loadApplication returns null when the payload has no array', async () => {
    http.tfboCall.mockResolvedValue({ payload: [{ result: undefined }] })
    const { loadApplication } = await import('./onboardingApi')
    expect(await loadApplication()).toBeNull()
  })
```
(Keep the existing "returns the most recent application" test.)

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Fix `loadApplication`** in `onboardingApi.ts`:
```ts
export const loadApplication = async (): Promise<AppInfo | null> => {
  const res = await getHttpClient().tfboCall<AppInfo[]>('application', 'getLastApplicationsInfo', {}, Authorize.Yes)
  const apps = res.payload?.[0]?.result
  return Array.isArray(apps) && apps.length > 0 ? apps[apps.length - 1]! : null
}
```

- [ ] **Step 4: Write the failing OnboardingScreen test** `OnboardingScreen.freshApp.test.tsx` — a freshly-registered (INCOMPLETE) user whose `getLastApplicationsInfo` is empty must not strand on loading and must reach the Simplified flow:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./api/onboardingQueries', () => ({
  useApplication: () => ({ data: null, isLoading: false }),
  useApplicationStatuses: () => ({ data: [{ application_status: 'INCOMPLETE' }], isLoading: false }),
  useQuestions: () => ({ data: [] }),
  useIncrementalSubmit: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelOne: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelTwo: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./flows/simplified/useQuestionsList', () => ({ useQuestionsList: () => [] }))
vi.mock('./hooks/useApplicantCountry', () => ({ useApplicantCountry: () => undefined }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))

beforeEach(async () => {
  const { useOnboardingStore } = await import('./state/onboardingStore')
  useOnboardingStore.getState().reset()
  // seed the draft as the Personal Information screen would, for a TMLC applicant
  useOnboardingStore.getState().patch({ applicationId: 999, portalAccountDomain: 'TMLC' })
})

describe('OnboardingScreen (fresh application, empty getLastApplicationsInfo)', () => {
  it('does not strand on loading and renders the simplified flow', async () => {
    const { OnboardingScreen } = await import('./OnboardingScreen')
    render(<OnboardingScreen />)
    expect(screen.queryByText(/loading your application/i)).toBeNull()
  })
})
```

- [ ] **Step 5: Run it, verify FAIL** (current screen returns "Loading your application..." when `app` is null).

- [ ] **Step 6: Update `OnboardingScreen.tsx`.** Replace the `app`-derived pieces so a null form blob falls back to the onboarding draft. After the existing `const { data: app, isLoading: appLoading } = useApplication(true)` and the statuses hook, add:
```tsx
  const draft = useOnboardingStore((s) => s.draft)
  const current = (app ?? draft) as AppInfo
```
Change `selectFlow(app ?? {}, country)` to `selectFlow(current, country)`. Change the existing `if (!app) return <Typography>Loading your application...</Typography>` guard to:
```tsx
  if (!current || (!current.applicationId && !current.portalAccountDomain)) {
    return <Typography>Loading your application...</Typography>
  }
```
Replace later uses of `app.applicationId` with `current.applicationId`, and the hydrate effect's `app` checks with `app` still (only hydrate from a real loaded `app`, not the draft — leave the hydrate effect guarded by `if (app && !hydrated.current)`). Ensure `AppInfo` and `useOnboardingStore` are imported.

- [ ] **Step 7: Run the new test + the full onboarding suite** — `npx vitest run src/features/onboarding` (all pass; the approved/completion/statusError tests still hold). Fix any fallout (e.g. tests asserting on `app.applicationId` that now read `current`).

- [ ] **Step 8: tsc + lint**, then commit:
```bash
git add src/features/onboarding/api/onboardingApi.ts src/features/onboarding/api/onboardingApi.test.ts src/features/onboarding/OnboardingScreen.tsx src/features/onboarding/OnboardingScreen.freshApp.test.tsx
git commit -m "fix(onboarding): tolerate empty getLastApplicationsInfo; drive from the draft"
```

---

### Task 7: SimplifiedFlow submits per step via simplified_submit_level_*

**Files:**
- Modify: `src/features/onboarding/flows/simplified/SimplifiedFlow.tsx`
- Test: `src/features/onboarding/flows/simplified/SimplifiedFlow.test.tsx`

**Interfaces:**
- Each Level 1 step advance calls `simplified_submit_level_one` (via `useSubmitLevelOne`); each Level 2 step advance calls `simplified_submit_level_two` — not the `application_submit` incremental call.

- [ ] **Step 1: Read** `SimplifiedFlow.tsx` to locate the per-step submit. It currently calls the incremental mutation (`application_submit`) between steps and `submitLevelOne`/`submitLevelTwo` at the level boundary. 

- [ ] **Step 2: Update the SimplifiedFlow test** so the per-step (non-final) advance asserts the level submit fires. In `SimplifiedFlow.test.tsx`, change the mock/assertion: the existing happy-path test should expect `submitLevelOne` (not the incremental mutation) to be called on a non-final Level 1 step advance. Keep the final-step assertion. (If the test only asserted the final submit, add an assertion that the per-step advance also calls `submitLevelOne`.)

- [ ] **Step 3: Run it, verify FAIL** for the new per-step expectation.

- [ ] **Step 4: Change the per-step submit** in `SimplifiedFlow.tsx`: in the step-advance handler, replace the `incremental.mutateAsync(app)` call with the level-appropriate submit — `submitLevelOne.mutateAsync(app)` while `status === 'INCOMPLETE'` (Level 1) and `submitLevelTwo.mutateAsync(app)` for Level 2 — mirroring what the final-step boundary already does. Remove the now-unused `useIncrementalSubmit` usage if nothing else needs it (leave the import only if still referenced).

- [ ] **Step 5: Run the test + full onboarding suite** — `npx vitest run src/features/onboarding` (green).

- [ ] **Step 6: tsc + lint**, then commit:
```bash
git add src/features/onboarding/flows/simplified/SimplifiedFlow.tsx src/features/onboarding/flows/simplified/SimplifiedFlow.test.tsx
git commit -m "fix(onboarding): SimplifiedFlow submits each step via simplified_submit_level_*"
```

---

### Task 8: e2e — register → personal info → onboarding

**Files:**
- Create: `e2e/registration-simplified.spec.ts`

- [ ] **Step 1: Write the e2e.** Drives the full Phase A happy path with mocked `auth/register` + `nsdata`:
```ts
import { test, expect } from '@playwright/test'

test('email/password registration for a simplified country reaches onboarding', async ({ page }) => {
  await page.route('**/auth/register', (route) =>
    route.fulfill({ json: { status: 'OK', tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } } })
  )
  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    const ok = (result: unknown) =>
      route.fulfill({ json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] } })
    if (action === 'getCountries')
      return ok([{ id: 158, name: 'Nigeria', code2: 'NG', code3: 'NGA', organization: { id: 14, name: 'TMLC' }, isSimplifyOnboarding: true }])
    if (action === 'simplified_submit_level_one') return ok({ applicationId: 999 })
    if (action === 'check_application_statuses') return ok([{ application_status: 'INCOMPLETE' }])
    if (action === 'getLastApplicationsInfo') return ok([]) // empty for a fresh app
    if (action === 'getQuestions') return ok([])
    if (action === 'get_user') return ok({ id: 1, email: 'ng@b.com', country: { id: 158 }, additionalAttributes: {} })
    return ok({})
  })

  await page.goto('/account/register')
  await page.getByLabel(/email/i).fill('ng@b.com')
  await page.getByLabel('Password', { exact: true }).fill('Think123!')
  await page.getByLabel(/confirm password/i).fill('Think123!')
  await page.getByRole('button', { name: /next/i }).click()
  await page.getByLabel(/country of residence/i).click()
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: /terms/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()

  // Personal Information screen
  await expect(page.getByRole('heading', { name: /personal information/i })).toBeVisible()
  await page.getByLabel(/first name/i).fill('Test')
  await page.getByLabel(/last name/i).fill('User')
  await page.getByLabel(/day/i).fill('1')
  await page.getByLabel(/month/i).fill('1')
  await page.getByLabel(/year/i).fill('1990')
  await page.getByRole('button', { name: /continue/i }).click()

  // Lands in onboarding (Simplified flow), not stranded
  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByText(/loading your application/i)).toHaveCount(0)
})
```
(Adjust selectors to the implemented labels; the bar is: register → personal info → land on `/onboarding` without stranding. Do not weaken these assertions.)

- [ ] **Step 2: Run** `npx playwright test e2e/registration-simplified.spec.ts --reporter=line` (passes). Also run `e2e/registration.spec.ts` — the old registration e2e asserted `incremental_submit` landing in onboarding; update or replace it to match the new flow (no `incremental_submit`), do not leave it asserting the removed behavior.

- [ ] **Step 3: Commit**
```bash
git add e2e/registration-simplified.spec.ts e2e/registration.spec.ts
git commit -m "test(e2e): simplified email/password registration reaches onboarding"
```

---

### Task 9: Full verification gate

- [ ] **Step 1: Run the whole suite** — `npm run lint && npx tsc -p tsconfig.json --noEmit && npx vitest run && npx playwright test` (all green).

- [ ] **Step 2:** Commit any fixes; otherwise no commit.

- [ ] **Step 3: Live smoke (manual, optional but recommended):** the `/auth/register` → `simplified_submit_level_one` sequence is already verified against UAT; if practical, walk the UI once with a fresh mailinator email + a Simplified country and confirm it reaches the onboarding steps.

- [ ] **Step 4: Confirm definition of done** against the spec: registration makes no backend call and routes to Personal Information; that screen creates the account via `/auth/register` + `simplified_submit_level_one`; onboarding no longer strands on an empty `getLastApplicationsInfo` and submits per step via `simplified_submit_level_*`; the create-account seam isolates the auth step for Phase B; all suites green.

---

## Self-review notes

- **Spec coverage:** registerUser (T1); registration store (T2); create-account seam with the shared `submitInitialApplication` (T3); registration collect-only + dead-API removal (T4); Personal Information screen + route (T5); onboarding empty-app tolerance (T6); per-step `simplified_submit_level_*` (T7); e2e (T8); gate (T9). All spec sections map to tasks.
- **Auth boundary honoured:** the create happens on the public `/account/personal-information` screen (T5), before the authenticated `/onboarding`. Registration makes no backend call (T4).
- **Seam for Phase B:** `submitInitialApplication` (app-create) is separated from the email/password auth step in `createAccount.ts` (T3); social will add a parallel auth step and reuse it.
- **Type consistency:** `createSimplifiedAccount(input)` / `CreateSimplifiedAccountInput`, `RegistrationDraft`, `registerUser(RegisterUserParams)`, and `loadApplication(): AppInfo | null` are used consistently across T1/T2/T3/T5/T6. The onboarding draft carries `portalAccountDomain`/`originCountry` (via `AppInfo`'s index signature) so `selectFlow`/`current` work for a fresh app (T5/T6).
- **No-backend-at-registration and no-`incremental_submit`-for-simplified** constraints are enforced in T4 (removal) and the e2e (T8).
- **Open questions from the spec** (exact required fields at create vs completion, `accountTradingTypes` value, email-verify gate) are flagged to verify during T9's live smoke; the create set used is the live-verified one.

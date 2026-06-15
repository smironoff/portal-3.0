# Country-driven email gate + flow selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Gate email verification on `isemail_verification_required(country) && !isuserverified(email)`, and make `selectFlow` choose simplified-vs-general from `country.isSimplifyOnboarding` (+ UAE/SA→TMLC), resolving the rich country from the logged-in profile.

**Architecture:** New `emailvalidation` status endpoints + queries; a `useApplicantCountry` hook (profile.country.id → rich country via `useCountries`); `selectFlow(app, country?)` country-driven with the existing domain logic preserved as fallback; the onboarding completion component gates the verify button; the verify screen short-circuits when already verified.

**Tech Stack:** React 19, TS6 strict, TanStack Query/Router, MUI v9, Vitest, Playwright. Node 20 (prefix every command `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null &&`). Arrow functions only. `git add <specific files>` only.

**Reference:** `docs/superpowers/specs/2026-06-15-country-driven-email-gate-and-flow-selection-design.md`.

---

### Task 1: Country flags on the registration type

**Files:** Modify `src/features/registration/types.ts`

- [ ] Add the two optional flags to the `Country` interface (returned by `utility/getCountries`):
```ts
export interface Country extends BaseCountry {
  used?: boolean
  forceEmailValidate?: boolean
  isSimplifyOnboarding?: boolean
  organization: Organization
}
```
- [ ] Verify: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx tsc -p tsconfig.json --noEmit && npm run lint` (clean).
- [ ] Commit: `git add src/features/registration/types.ts && git commit -m "feat(registration): country email/simplify flags on Country type"`

---

### Task 2: Email status endpoints + queries

**Files:** Modify `src/features/emailVerification/api/emailApi.ts`, `emailQueries.ts`; Test `emailApi.test.ts`

- [ ] **Test first** — add to `emailApi.test.ts`:
```ts
  it('isUserVerified calls emailvalidation/isuserverified and coerces the boolean', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'OK', result: true }] })
    const { isUserVerified } = await import('./emailApi')
    const { Authorize } = await import('@/api/httpClient')
    expect(await isUserVerified('a@b.com')).toBe(true)
    expect(tfboCall).toHaveBeenCalledWith('emailvalidation', 'isuserverified', { userEmail: 'a@b.com' }, Authorize.No)
  })

  it('isEmailVerificationRequired calls isemail_verification_required with originCountry', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'OK', result: false }] })
    const { isEmailVerificationRequired } = await import('./emailApi')
    const { Authorize } = await import('@/api/httpClient')
    expect(await isEmailVerificationRequired(7)).toBe(false)
    expect(tfboCall).toHaveBeenCalledWith('emailvalidation', 'isemail_verification_required', { originCountry: 7 }, Authorize.No)
  })

  it('status helpers return false on a non-OK / empty payload', async () => {
    tfboCall.mockResolvedValue({ payload: [] })
    const { isUserVerified, isEmailVerificationRequired } = await import('./emailApi')
    expect(await isUserVerified('a@b.com')).toBe(false)
    expect(await isEmailVerificationRequired(7)).toBe(false)
  })
```
- [ ] Run it to see the new cases fail.
- [ ] Implement in `emailApi.ts` (append):
```ts
export const isUserVerified = async (email: string): Promise<boolean> => {
  const res = await getHttpClient().tfboCall<boolean>('emailvalidation', 'isuserverified', { userEmail: email }, Authorize.No)
  return res.payload?.[0]?.result === true
}

export const isEmailVerificationRequired = async (countryId: number): Promise<boolean> => {
  const res = await getHttpClient().tfboCall<boolean>('emailvalidation', 'isemail_verification_required', { originCountry: countryId }, Authorize.No)
  return res.payload?.[0]?.result === true
}
```
- [ ] Implement in `emailQueries.ts` — add the two queries and invalidate the verified key on verify success:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sendOtpCode, verifyOtpCode, isUserVerified, isEmailVerificationRequired } from './emailApi'
import type { SendOtpParams } from './emailApi'

export const useSendOtp = () =>
  useMutation({ mutationFn: (params: SendOtpParams) => sendOtpCode(params) })

export const useVerifyOtp = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { otp: string; email: string }) => verifyOtpCode(v.otp, v.email),
    onSuccess: (ok) => {
      if (ok) {
        queryClient.invalidateQueries({ queryKey: ['application'] })
        queryClient.invalidateQueries({ queryKey: ['isUserVerified'] })
      }
    },
  })
}

export const useIsUserVerified = (email?: string) =>
  useQuery({ queryKey: ['isUserVerified', email], queryFn: () => isUserVerified(email!), enabled: !!email })

export const useIsEmailVerificationRequired = (countryId?: number) =>
  useQuery({ queryKey: ['emailVerificationRequired', countryId], queryFn: () => isEmailVerificationRequired(countryId!), enabled: countryId != null })
```
- [ ] Run `npx vitest run src/features/emailVerification/api/emailApi.test.ts` (all pass), then lint+tsc.
- [ ] Commit: `git add src/features/emailVerification/api/emailApi.ts src/features/emailVerification/api/emailQueries.ts src/features/emailVerification/api/emailApi.test.ts && git commit -m "feat(email-verification): isuserverified + isemail_verification_required queries"`

---

### Task 3: `useApplicantCountry` hook

**Files:** Create `src/features/onboarding/hooks/useApplicantCountry.ts`, `useApplicantCountry.test.tsx`

- [ ] **Test first** (`useApplicantCountry.test.tsx`):
```tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const rich = { id: 1, name: 'Australia', code2: 'AU', code3: 'AUS', phoneCode: 61, european: false, organization: { id: 7, name: 'AU' }, isSimplifyOnboarding: false }
vi.mock('@/features/auth/api/authQueries', () => ({ useUserProfile: () => ({ data: { country: { id: 1 }, email: 'a@b.com' } }) }))
vi.mock('@/features/registration/api/countriesQueries', () => ({ useCountries: () => ({ data: [rich] }) }))

describe('useApplicantCountry', () => {
  it('resolves the rich country by profile.country.id', async () => {
    const { useApplicantCountry } = await import('./useApplicantCountry')
    const { result } = renderHook(() => useApplicantCountry())
    expect(result.current?.organization.name).toBe('AU')
  })
})
```
- [ ] Run to see it fail.
- [ ] Implement (`useApplicantCountry.ts`):
```ts
import { useUserProfile } from '@/features/auth/api/authQueries'
import { useCountries } from '@/features/registration/api/countriesQueries'
import type { Country } from '@/features/registration/types'

export const useApplicantCountry = (): Country | undefined => {
  const { data: profile } = useUserProfile(true)
  const { data: countries } = useCountries()
  if (!profile || !countries) return undefined
  return countries.find((c) => c.id === profile.country.id)
}
```
- [ ] Run the test (pass), lint+tsc.
- [ ] Commit: `git add src/features/onboarding/hooks/useApplicantCountry.ts src/features/onboarding/hooks/useApplicantCountry.test.tsx && git commit -m "feat(onboarding): useApplicantCountry resolves rich country from profile"`

---

### Task 4: Country-driven `selectFlow`

**Files:** Modify `src/features/onboarding/flowSelection.ts`; Test `flowSelection.test.ts`

- [ ] **Test first** — add cases (keep all existing tests):
```ts
  it('UAE country is simplified only when the domain is TMLC', () => {
    const uae = { code3: 'ARE', isSimplifyOnboarding: false }
    expect(selectFlow({ portalAccountDomain: 'TMLC' }, uae)).toEqual({ kind: 'simplified' })
    expect(selectFlow({ portalAccountDomain: 'UK' }, uae)).toEqual({ kind: 'general', jurisdiction: 'UK' })
  })
  it('isSimplifyOnboarding country routes to simplified (except Money_Manager)', () => {
    const c = { code3: 'XYZ', isSimplifyOnboarding: true }
    expect(selectFlow({ portalAccountDomain: 'AU' }, c)).toEqual({ kind: 'simplified' })
    expect(selectFlow({ portalAccountDomain: 'AU', platformAccountType: 'Money_Manager' }, c)).toEqual({ kind: 'general', jurisdiction: 'AU' })
  })
  it('falls back to domain routing when no country is supplied', () => {
    expect(selectFlow({ portalAccountDomain: 'AU' })).toEqual({ kind: 'general', jurisdiction: 'AU' })
  })
```
- [ ] Run to see new cases fail.
- [ ] Implement the new `selectFlow` signature (exactly the design's version): add an optional second param `country?: { code3: string; isSimplifyOnboarding?: boolean }`; run the UAE/SA→TMLC and `isSimplifyOnboarding && platformAccountType !== 'Money_Manager'` checks before the existing domain routing; keep `SIMPLIFIED_DOMAINS`, the no-domain dev default, and a one-line comment that the IB-`simplified`-flow edge case is deferred.
- [ ] Run `npx vitest run src/features/onboarding/flowSelection.test.ts` (all pass incl. existing), lint+tsc.
- [ ] Commit: `git add src/features/onboarding/flowSelection.ts src/features/onboarding/flowSelection.test.ts && git commit -m "feat(onboarding): country-driven simplified selection in selectFlow"`

---

### Task 5: OnboardingScreen wiring + gated completion

**Files:** Modify `src/features/onboarding/OnboardingScreen.tsx`; update existing onboarding tests that render it; Test the gate.

- [ ] Pass the applicant country into `selectFlow`:
  - add `import { useApplicantCountry } from './hooks/useApplicantCountry'`, call `const country = useApplicantCountry()` (unconditionally, with the other hooks), and change `selectFlow(app ?? {})` → `selectFlow(app ?? {}, country)`.
- [ ] Replace `OnboardingComplete` with a gated version:
```tsx
const OnboardingComplete = () => {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile(true)
  const required = useIsEmailVerificationRequired(profile?.country.id)
  const verified = useIsUserVerified(profile?.email)
  if (required.isLoading || verified.isLoading) {
    return <Typography>Your application is being processed.</Typography>
  }
  const needsEmail = required.data === true && verified.data !== true
  return (
    <Stack spacing={2} sx={{ maxWidth: 420 }}>
      <Typography>Your application is being processed. Document verification is the next step.</Typography>
      {needsEmail && <Button onClick={() => navigate({ to: '/account/verify-email' })}>Verify your email</Button>}
    </Stack>
  )
}
```
  - add imports: `useUserProfile` from `@/features/auth/api/authQueries`; `useIsEmailVerificationRequired`, `useIsUserVerified` from `./api`... (path `@/features/emailVerification/api/emailQueries`).
- [ ] Update `OnboardingScreen.completion.test.tsx`: add mocks so the gate shows the button — `vi.mock('@/features/auth/api/authQueries', () => ({ useUserProfile: () => ({ data: { country: { id: 1 }, email: 'a@b.com' } }) }))`, `vi.mock('./hooks/useApplicantCountry', () => ({ useApplicantCountry: () => undefined }))`, and mock the email queries module so `useIsEmailVerificationRequired: () => ({ data: true, isLoading: false })` and `useIsUserVerified: () => ({ data: false, isLoading: false })`. The existing assertion (button → navigate to /account/verify-email) must still pass. Add a second test: when `useIsEmailVerificationRequired` returns `{ data: false }`, the "Verify your email" button is NOT rendered.
- [ ] Run the FULL onboarding suite `npx vitest run src/features/onboarding`. Some existing tests render `OnboardingScreen` — if any now fail because `useApplicantCountry`/`useUserProfile`/the email queries are unmocked (real calls), add the minimal mocks to those test files (default to `useApplicantCountry: () => undefined`, profile undefined, queries `{ data: undefined, isLoading: false }`) so behaviour is unchanged. Fix until green.
- [ ] lint+tsc clean.
- [ ] Commit: `git add src/features/onboarding/OnboardingScreen.tsx src/features/onboarding/*.test.tsx && git commit -m "feat(onboarding): gate email verification by country + wire applicant country into selectFlow"`

---

### Task 6: Verify-screen short-circuit when already verified

**Files:** Modify `src/features/emailVerification/EmailVerificationScreen.tsx`; update its test.

- [ ] Add `const alreadyVerified = useIsUserVerified(profile?.email)` and short-circuit: when `alreadyVerified.data === true`, render the same "Email verified" confirmation and do NOT send the OTP on mount (guard the send effect with `!alreadyVerified.data`).
- [ ] Update `EmailVerificationScreen.test.tsx`: mock `useIsUserVerified` (add to the `./api/emailQueries` mock) returning `{ data: false }` for the existing tests; add a test that when `useIsUserVerified` returns `{ data: true }` the screen shows "Email verified" and `sendMutate` is NOT called.
- [ ] Run `npx vitest run src/features/emailVerification`, lint+tsc.
- [ ] Commit: `git add src/features/emailVerification/EmailVerificationScreen.tsx src/features/emailVerification/EmailVerificationScreen.test.tsx && git commit -m "feat(email-verification): skip OTP when the email is already verified"`

---

### Task 7: E2E updates

**Files:** Modify `e2e/registration.spec.ts`, `e2e/email-verification.spec.ts`

- [ ] In BOTH specs' `**/nsdata` handler, add `ok(...)` branches for the new actions: `if (action === 'getCountries') return ok([...])` (registration already has it; ensure the country object includes `isSimplifyOnboarding: false`), `if (action === 'isemail_verification_required') return ok(true)`, `if (action === 'isuserverified') return ok(false)`. (Default `ok({})` already returns for unlisted actions, but these two must return explicit booleans.)
- [ ] `registration.spec.ts`: still asserts landing in onboarding ("Personal information"); confirm it still passes with the new branches.
- [ ] `email-verification.spec.ts`: the gate now requires `isemail_verification_required: true` + `isuserverified: false` for the "Verify your email" button to show — ensure those branches return those values; keep the final assertion that the "email verified" confirmation appears after entering the 6 digits (after which `verify_otp_code` returns true).
- [ ] Run `npx playwright test e2e/registration.spec.ts e2e/email-verification.spec.ts --reporter=line` (both pass). Debug session/mocking as needed; do not weaken assertions.
- [ ] Commit: `git add e2e/registration.spec.ts e2e/email-verification.spec.ts && git commit -m "test(e2e): mock email-status endpoints and assert the country-driven gate"`

---

### Task 8: Full suite + lint gate

- [ ] `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run lint && npx tsc -p tsconfig.json --noEmit && npx vitest run && npx playwright test` — all green.
- [ ] Commit only if fixes were required.

---

## Self-review notes
- `selectFlow`'s second param is optional and the existing domain logic is preserved → existing `flowSelection` tests pass unchanged; new country cases added.
- Status queries fail-safe: `required` failure → not required (no block); `verified` failure → shows gate. Documented in the design.
- Backend-verify: `Authorize.No` + boolean payload shape of the two new endpoints (matched to legacy). IB-`simplified` flow deferred.

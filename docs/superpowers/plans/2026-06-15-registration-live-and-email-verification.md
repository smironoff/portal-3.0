# Registration (live create-account + email verification) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an unauthenticated visitor create a live account (email/password + residency), establish a session via the unauthenticated account-creating submit, land in the correct onboarding flow, and verify their email via OTP.

**Architecture:** Two new self-contained features — `src/features/registration/` (country list, tracking, the two-step create form, the create call + token handoff) and `src/features/emailVerification/` (OTP screen + send/verify calls). The shipped onboarding is untouched except a single completion-stub edit that routes to `/account/verify-email`. The account is created by `tfboCall('application','incremental_submit', params, Authorize.No)`; its envelope `session_id`/`token` become the tfbo session, mirroring the login success handler.

**Tech Stack:** React 19, TypeScript 6 (strict, no enums, arrow functions), TanStack Router + Query v5, React Hook Form + Zod v4, MUI v9, Zustand, Vitest + Testing Library, Playwright. Node 20 (prefix every command with `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null &&`).

**Conventions:** Arrow functions only. Commit with `git add <specific files>` — never `git add -A` (a stray `.claude/worktrees/` gitlink must never be staged). Do not create git worktrees.

---

## File Structure

```
src/features/registration/
  types.ts                         Country, Organization, RegisterParams, RegisterResponse
  country.ts                       domainForCountry, organizationIdForCountry, filterCountries, getLanguageId
  tracking.ts                      readTracking (ibc cookie, utmLink/source, visitorId, referrerId)
  api/countriesApi.ts              getCountries (utility/getCountries, Authorize.No)
  api/countriesQueries.ts          useCountries
  api/registerApi.ts               createLiveAccount, storeRegistrationAuth, EmailAlreadyRegisteredError
  api/registerQueries.ts           useRegister
  components/RegisterForm.tsx       two-step RHF form
  RegisterScreen.tsx                heading + form + risk disclosure
  routes/register.tsx               public /account/register
src/features/emailVerification/
  api/emailApi.ts                  sendOtpCode, verifyOtpCode, SendOtpParams
  api/emailQueries.ts              useSendOtp, useVerifyOtp
  components/OtpInput.tsx          six-digit input with paste + auto-advance
  EmailVerificationScreen.tsx      send-on-mount + verify + resend
  routes/verifyEmail.tsx           authenticated /account/verify-email
src/router/router.tsx              + RegisterRoute (public) + VerifyEmailRoute (authenticated)
src/features/onboarding/OnboardingScreen.tsx   completion stub -> /account/verify-email
e2e/registration.spec.ts
e2e/email-verification.spec.ts
```

Test files live beside their source as `*.test.ts(x)`.

---

### Task 1: Registration types + pure country helpers

**Files:**
- Create: `src/features/registration/types.ts`
- Create: `src/features/registration/country.ts`
- Test: `src/features/registration/country.test.ts`

- [ ] **Step 1: Write the types**

`src/features/registration/types.ts`:

```ts
import type { AuthTokens } from '@/api/types'

export interface Organization {
  id: number
  name: string
  guid?: string
  defaultLeverage?: string
}

export interface Country {
  id: number
  name: string
  code2: string
  code3: string
  phoneCode: number
  european: boolean
  used?: boolean
  organization: Organization
}

export interface RegisterParams {
  accountHolderEmail: string
  accountHolderPassword: string
  originCountry: number
  preferredOrganization: number
  portalAccountDomain: string
  agreeToAllTerms: boolean
  isMarketingOptOut: boolean
  accountType: 'individual'
  source: string
  brand: 'ThinkMarkets'
  preferredLanguage: number
  afsAid?: string
  utmLink?: string
  visitorId?: string
  referrerId?: string
  recaptchaResponse: string
}

export interface RegisterResponse {
  sso_token?: string
  token?: string
  applicationId?: number
  app_id?: number
  applicationStatus?: string
  tokens?: AuthTokens
}
```

- [ ] **Step 2: Write the failing test**

`src/features/registration/country.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { domainForCountry, organizationIdForCountry, filterCountries, getLanguageId } from './country'
import type { Country } from './types'

const mk = (over: Partial<Country> & { id: number; name: string; code3: string }): Country => ({
  code2: '', phoneCode: 0, european: false,
  organization: { id: 10, name: 'AU' },
  ...over,
})

describe('country helpers', () => {
  it('maps domain and organization id from the organization', () => {
    const c = mk({ id: 1, name: 'Australia', code3: 'AUS', organization: { id: 7, name: 'AU' } })
    expect(domainForCountry(c)).toBe('AU')
    expect(organizationIdForCountry(c)).toBe(7)
  })

  it('excludes Japan, drops unused, and sorts by name', () => {
    const list = [
      mk({ id: 1, name: 'Zambia', code3: 'ZMB' }),
      mk({ id: 2, name: 'Japan', code3: 'JPN' }),
      mk({ id: 3, name: 'Albania', code3: 'ALB' }),
      mk({ id: 4, name: 'Narnia', code3: 'NAR', used: false }),
    ]
    expect(filterCountries(list).map((c) => c.code3)).toEqual(['ALB', 'ZMB'])
  })

  it('getLanguageId defaults to English (1) and matches the current language', () => {
    const c = mk({ id: 1, name: 'Australia', code3: 'AUS', organization: { id: 7, name: 'AU' } })
    expect(getLanguageId(c, [], 'en')).toBe(1)
    expect(getLanguageId(c, [{ id: 5, language_code: 'de' }], 'de')).toBe(5)
  })

  it('getLanguageId forces Japanese for the TMJP domain', () => {
    const c = mk({ id: 1, name: 'Japan2', code3: 'XXX', organization: { id: 9, name: 'TMJP' } })
    expect(getLanguageId(c, [{ id: 8, language_code: 'ja' }], 'en')).toBe(8)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/registration/country.test.ts`
Expected: FAIL (cannot find module `./country`).

- [ ] **Step 4: Implement `country.ts`**

```ts
import type { Country } from './types'

export interface PreferredLanguage {
  id: number
  language_code: string
}

export const domainForCountry = (country: Country): string => country.organization.name

export const organizationIdForCountry = (country: Country): number => country.organization.id

export const filterCountries = (countries: Country[]): Country[] =>
  countries
    .filter((c) => c.used !== false && c.code3 !== 'JPN')
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

// Ported from the legacy useLanguageID: default to English (id 1); match the current
// UI language against the backend language list (the TMJP domain forces Japanese).
// TODO(verify): wire the real preferredLanguages list; callers currently pass [] -> id 1.
export const getLanguageId = (
  country: Country | undefined,
  languages: PreferredLanguage[],
  currentLanguage: string
): number => {
  const target = country?.organization?.name === 'TMJP' ? 'ja' : currentLanguage
  const match = languages.find((l) => l.language_code === target)
  return match ? match.id : 1
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/registration/country.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/registration/types.ts src/features/registration/country.ts src/features/registration/country.test.ts
git commit -m "feat(registration): types and pure country helpers"
```

---

### Task 2: Tracking reader

**Files:**
- Create: `src/features/registration/tracking.ts`
- Test: `src/features/registration/tracking.test.ts`

- [ ] **Step 1: Write the failing test**

`src/features/registration/tracking.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readTracking } from './tracking'

describe('readTracking', () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.cookie = 'ibc=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.cookie = 'referrerId=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    delete (window as { visitorId?: string }).visitorId
  })
  afterEach(() => {
    sessionStorage.clear()
  })

  it('defaults source and leaves optional fields undefined', () => {
    const t = readTracking()
    expect(t.source).toBe('TP3-LiveApp')
    expect(t.afsAid).toBeUndefined()
    expect(t.utmLink).toBeUndefined()
    expect(t.visitorId).toBeUndefined()
    expect(t.referrerId).toBeUndefined()
  })

  it('reads the ibc cookie pid, utm/source, visitorId and referrerId', () => {
    document.cookie = `ibc=${encodeURIComponent(JSON.stringify({ type: 'retail', pid: 42 }))}`
    document.cookie = 'referrerId=ref-9'
    sessionStorage.setItem('utmLink', '?utm_source=x')
    sessionStorage.setItem('parsedSource', 'CustomSource')
    ;(window as { visitorId?: string }).visitorId = 'v-1'
    const t = readTracking()
    expect(t.afsAid).toBe('42')
    expect(t.utmLink).toBe('?utm_source=x')
    expect(t.source).toBe('CustomSource')
    expect(t.visitorId).toBe('v-1')
    expect(t.referrerId).toBe('ref-9')
  })

  it('ignores a malformed ibc cookie', () => {
    document.cookie = 'ibc=not-json'
    expect(readTracking().afsAid).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/registration/tracking.test.ts`
Expected: FAIL (cannot find module `./tracking`).

- [ ] **Step 3: Implement `tracking.ts`**

```ts
export interface TrackingData {
  afsAid?: string
  utmLink?: string
  source: string
  visitorId?: string
  referrerId?: string
}

const readCookie = (name: string): string | undefined => {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

export const readTracking = (): TrackingData => {
  let afsAid: string | undefined
  const ibc = readCookie('ibc')
  if (ibc) {
    try {
      const parsed = JSON.parse(ibc) as { pid?: number }
      if (parsed.pid != null) afsAid = String(parsed.pid)
    } catch {
      // malformed cookie -> ignore
    }
  }
  return {
    afsAid,
    utmLink: sessionStorage.getItem('utmLink') ?? undefined,
    source: sessionStorage.getItem('parsedSource') ?? 'TP3-LiveApp',
    visitorId: (window as { visitorId?: string }).visitorId,
    referrerId: readCookie('referrerId'),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/registration/tracking.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/registration/tracking.ts src/features/registration/tracking.test.ts
git commit -m "feat(registration): tracking reader for IB/UTM/visitor"
```

---

### Task 3: Countries API + query

**Files:**
- Create: `src/features/registration/api/countriesApi.ts`
- Create: `src/features/registration/api/countriesQueries.ts`
- Test: `src/features/registration/api/countriesApi.test.ts`

- [ ] **Step 1: Write the failing test**

`src/features/registration/api/countriesApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const tfboCall = vi.fn()
vi.mock('@/api/client', () => ({ getHttpClient: () => ({ tfboCall }) }))

beforeEach(() => tfboCall.mockReset())

describe('getCountries', () => {
  it('calls utility/getCountries unauthenticated and returns the result list', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'OK', result: [{ id: 1, name: 'Australia' }] }] })
    const { getCountries } = await import('./countriesApi')
    const { Authorize } = await import('@/api/httpClient')
    const list = await getCountries()
    expect(tfboCall).toHaveBeenCalledWith('utility', 'getCountries', { showUnused: false }, Authorize.No)
    expect(list).toEqual([{ id: 1, name: 'Australia' }])
  })

  it('returns an empty array when the payload is empty', async () => {
    tfboCall.mockResolvedValue({ payload: [] })
    const { getCountries } = await import('./countriesApi')
    expect(await getCountries()).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/registration/api/countriesApi.test.ts`
Expected: FAIL (cannot find module `./countriesApi`).

- [ ] **Step 3: Implement `countriesApi.ts`**

```ts
import { getHttpClient } from '@/api/client'
import { Authorize } from '@/api/httpClient'
import type { Country } from '../types'

export const getCountries = async (): Promise<Country[]> => {
  const res = await getHttpClient().tfboCall<Country[]>('utility', 'getCountries', { showUnused: false }, Authorize.No)
  return res.payload?.[0]?.result ?? []
}
```

- [ ] **Step 4: Implement `countriesQueries.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { getCountries } from './countriesApi'

export const useCountries = () =>
  useQuery({ queryKey: ['countries'], queryFn: getCountries, staleTime: Infinity })
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/registration/api/countriesApi.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/registration/api/countriesApi.ts src/features/registration/api/countriesQueries.ts src/features/registration/api/countriesApi.test.ts
git commit -m "feat(registration): countries query (utility/getCountries)"
```

---

### Task 4: Create-account API + token handoff + register mutation

**Files:**
- Create: `src/features/registration/api/registerApi.ts`
- Create: `src/features/registration/api/registerQueries.ts`
- Test: `src/features/registration/api/registerApi.test.ts`

- [ ] **Step 1: Write the failing test**

`src/features/registration/api/registerApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const tfboCall = vi.fn()
const setTfbo = vi.fn()
const setAuthTokens = vi.fn()
vi.mock('@/api/client', () => ({ getHttpClient: () => ({ tfboCall }) }))
vi.mock('@/api/tokenStore', () => ({ tokenStore: { setTfbo, setAuthTokens } }))

beforeEach(() => {
  tfboCall.mockReset()
  setTfbo.mockReset()
  setAuthTokens.mockReset()
})

const params = {
  accountHolderEmail: 'a@b.com', accountHolderPassword: 'Secret12', originCountry: 1,
  preferredOrganization: 7, portalAccountDomain: 'AU', agreeToAllTerms: true,
  isMarketingOptOut: true, accountType: 'individual' as const, source: 'TP3-LiveApp',
  brand: 'ThinkMarkets' as const, preferredLanguage: 1, recaptchaResponse: 'cap',
}

describe('createLiveAccount', () => {
  it('submits incremental_submit unauthenticated and returns the envelope', async () => {
    tfboCall.mockResolvedValue({ session_id: 's', token: 't', payload: [{ status: 'OK', result: { applicationId: 9 } }] })
    const { createLiveAccount } = await import('./registerApi')
    const { Authorize } = await import('@/api/httpClient')
    const res = await createLiveAccount(params)
    expect(tfboCall).toHaveBeenCalledWith('application', 'incremental_submit', params, Authorize.No)
    expect(res.payload[0].result.applicationId).toBe(9)
  })

  it('throws EmailAlreadyRegisteredError on ALREADY_REGISTERED', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'ALREADY_REGISTERED' }] })
    const { createLiveAccount, EmailAlreadyRegisteredError } = await import('./registerApi')
    await expect(createLiveAccount(params)).rejects.toBeInstanceOf(EmailAlreadyRegisteredError)
  })

  it('throws on a non-OK status', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'SYS_ERR', message: 'boom' }] })
    const { createLiveAccount } = await import('./registerApi')
    await expect(createLiveAccount(params)).rejects.toThrow('boom')
  })
})

describe('storeRegistrationAuth', () => {
  it('stores the envelope tfbo session and any OAuth tokens', async () => {
    const { storeRegistrationAuth } = await import('./registerApi')
    storeRegistrationAuth({
      session_id: 's', token: 't',
      payload: [{ status: 'OK', result: { tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } } }],
    } as never)
    expect(setTfbo).toHaveBeenCalledWith('s', 't')
    expect(setAuthTokens).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' })
  })

  it('stores only the tfbo session when no OAuth tokens are returned', async () => {
    const { storeRegistrationAuth } = await import('./registerApi')
    storeRegistrationAuth({ session_id: 's', token: 't', payload: [{ status: 'OK', result: {} }] } as never)
    expect(setTfbo).toHaveBeenCalledWith('s', 't')
    expect(setAuthTokens).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/registration/api/registerApi.test.ts`
Expected: FAIL (cannot find module `./registerApi`).

- [ ] **Step 3: Implement `registerApi.ts`**

```ts
import { getHttpClient } from '@/api/client'
import { Authorize } from '@/api/httpClient'
import { tokenStore } from '@/api/tokenStore'
import type { APIResponse } from '@/api/envelope'
import type { RegisterParams, RegisterResponse } from '../types'

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('ALREADY_REGISTERED')
    this.name = 'EmailAlreadyRegisteredError'
  }
}

export const createLiveAccount = async (params: RegisterParams): Promise<APIResponse<RegisterResponse>> => {
  const res = await getHttpClient().tfboCall<RegisterResponse>('application', 'incremental_submit', params, Authorize.No)
  const item = res.payload?.[0]
  if (item?.status === 'ALREADY_REGISTERED') throw new EmailAlreadyRegisteredError()
  if (!item || item.status !== 'OK') {
    throw new Error(item?.message ?? `Registration failed: ${item?.status ?? 'empty response'}`)
  }
  return res
}

// The account-creating submit returns a fresh tfbo session at the envelope level
// (session_id/token); that pair authenticates subsequent tfbo calls (onboarding,
// profile). OAuth tokens, if returned, drive the Bearer header for auth/* endpoints.
export const storeRegistrationAuth = (res: APIResponse<RegisterResponse>): void => {
  if (res.session_id && res.token) tokenStore.setTfbo(res.session_id, res.token)
  const tokens = res.payload?.[0]?.result?.tokens
  if (tokens) tokenStore.setAuthTokens(tokens)
}
```

- [ ] **Step 4: Implement `registerQueries.ts`**

```ts
import { useMutation } from '@tanstack/react-query'
import { createLiveAccount } from './registerApi'
import type { RegisterParams } from '../types'

export const useRegister = () =>
  useMutation({ mutationFn: (params: RegisterParams) => createLiveAccount(params) })
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/registration/api/registerApi.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/registration/api/registerApi.ts src/features/registration/api/registerQueries.ts src/features/registration/api/registerApi.test.ts
git commit -m "feat(registration): create-account submit, token handoff, register mutation"
```

---

### Task 5: Register form (two steps)

**Files:**
- Create: `src/features/registration/components/RegisterForm.tsx`
- Test: `src/features/registration/components/RegisterForm.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/features/registration/components/RegisterForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutateAsync = vi.fn()
const navigate = vi.fn()
const setLoggedIn = vi.fn()
const storeRegistrationAuth = vi.fn()

vi.mock('../api/countriesQueries', () => ({
  useCountries: () => ({
    data: [{ id: 1, name: 'Australia', code2: 'AU', code3: 'AUS', phoneCode: 61, european: false, organization: { id: 7, name: 'AU' } }],
  }),
}))
vi.mock('../api/registerQueries', () => ({ useRegister: () => ({ mutateAsync, isPending: false }) }))
vi.mock('../api/registerApi', async () => {
  const actual = await vi.importActual<typeof import('../api/registerApi')>('../api/registerApi')
  return { ...actual, storeRegistrationAuth }
})
vi.mock('@/features/auth/hooks/useCaptcha', () => ({
  useCaptcha: () => ({ element: null, execute: async () => 'cap', reset: vi.fn() }),
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('@/state/sessionStore', () => ({ useSessionStore: { getState: () => ({ setLoggedIn }) } }))

beforeEach(() => {
  mutateAsync.mockReset()
  navigate.mockReset()
  setLoggedIn.mockReset()
  storeRegistrationAuth.mockReset()
})

const fillStepOne = async () => {
  await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
  await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Secret12')
  await userEvent.type(screen.getByLabelText(/confirm password/i), 'Secret12')
  await userEvent.click(screen.getByRole('button', { name: /next/i }))
}

describe('RegisterForm', () => {
  it('rejects a weak password', async () => {
    const { RegisterForm } = await import('./RegisterForm')
    render(<RegisterForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'weak')
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'weak')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('requires terms acceptance and creates the account on submit', async () => {
    mutateAsync.mockResolvedValue({ session_id: 's', token: 't', payload: [{ status: 'OK', result: { applicationId: 9 } }] })
    const { RegisterForm } = await import('./RegisterForm')
    render(<RegisterForm />)
    await fillStepOne()
    await userEvent.click(screen.getByLabelText(/country of residence/i))
    await userEvent.click(await screen.findByRole('option', { name: 'Australia' }))
    // submit without ticking terms -> validation error, no call
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/must accept the terms/i)).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
    // tick terms -> submit
    await userEvent.click(screen.getByLabelText(/i agree/i))
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        accountHolderEmail: 'a@b.com', accountHolderPassword: 'Secret12',
        originCountry: 1, preferredOrganization: 7, portalAccountDomain: 'AU',
        agreeToAllTerms: true, isMarketingOptOut: true, accountType: 'individual',
        recaptchaResponse: 'cap',
      })
    )
    expect(storeRegistrationAuth).toHaveBeenCalled()
    expect(setLoggedIn).toHaveBeenCalledWith(true)
    expect(navigate).toHaveBeenCalledWith({ to: '/onboarding' })
  })

  it('shows an inline email error when already registered', async () => {
    const { EmailAlreadyRegisteredError } = await import('../api/registerApi')
    mutateAsync.mockRejectedValue(new EmailAlreadyRegisteredError())
    const { RegisterForm } = await import('./RegisterForm')
    render(<RegisterForm />)
    await fillStepOne()
    await userEvent.click(screen.getByLabelText(/country of residence/i))
    await userEvent.click(await screen.findByRole('option', { name: 'Australia' }))
    await userEvent.click(screen.getByLabelText(/i agree/i))
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/already registered/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/registration/components/RegisterForm.test.tsx`
Expected: FAIL (cannot find module `./RegisterForm`).

- [ ] **Step 3: Implement `RegisterForm.tsx`**

```tsx
import { useState } from 'react'
import { useForm, FormProvider, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack, TextField, MenuItem, FormControlLabel, Checkbox } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { useCountries } from '../api/countriesQueries'
import { useRegister } from '../api/registerQueries'
import { storeRegistrationAuth, EmailAlreadyRegisteredError } from '../api/registerApi'
import { useCaptcha } from '@/features/auth/hooks/useCaptcha'
import { useSessionStore } from '@/state/sessionStore'
import { useNotificationStore } from '@/state/notificationStore'
import { filterCountries, domainForCountry, organizationIdForCountry, getLanguageId } from '../country'
import { readTracking } from '../tracking'

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number')

const schema = z
  .object({
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    password,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    countryId: z.number().int().positive('Select your country of residence'),
    agreeToTerms: z.literal(true, { message: 'You must accept the terms' }),
    marketingConsent: z.boolean(),
    ibCode: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
type Values = z.infer<typeof schema>

export const RegisterForm = () => {
  const [step, setStep] = useState(0)
  const tracking = readTracking()
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '', password: '', confirmPassword: '', countryId: 0,
      agreeToTerms: false as unknown as true, marketingConsent: false, ibCode: tracking.afsAid ?? '',
    },
  })
  const countries = filterCountries(useCountries().data ?? [])
  const register = useRegister()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)

  const goNext = async () => {
    if (await methods.trigger(['email', 'password', 'confirmPassword'])) setStep(1)
  }

  const onSubmit = async (v: Values) => {
    const country = countries.find((c) => c.id === v.countryId)
    if (!country) return
    try {
      const token = await captcha.execute()
      const res = await register.mutateAsync({
        accountHolderEmail: v.email,
        accountHolderPassword: v.password,
        originCountry: country.id,
        preferredOrganization: organizationIdForCountry(country),
        portalAccountDomain: domainForCountry(country),
        agreeToAllTerms: true,
        isMarketingOptOut: !v.marketingConsent,
        accountType: 'individual',
        source: tracking.source,
        brand: 'ThinkMarkets',
        preferredLanguage: getLanguageId(country, [], 'en'),
        afsAid: v.ibCode || tracking.afsAid,
        utmLink: tracking.utmLink,
        visitorId: tracking.visitorId,
        referrerId: tracking.referrerId,
        recaptchaResponse: token,
      })
      storeRegistrationAuth(res)
      useSessionStore.getState().setLoggedIn(true)
      navigate({ to: '/onboarding' })
    } catch (e) {
      captcha.reset()
      if (e instanceof EmailAlreadyRegisteredError) {
        setStep(0)
        methods.setError('email', { message: 'This email is already registered' })
        return
      }
      notify({ severity: 'error', message: 'auth.error.generic' })
    }
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          {step === 0 && (
            <>
              <RHFTextField name="email" label="Email" type="email" autoComplete="username" />
              <RHFTextField name="password" label="Password" type="password" autoComplete="new-password" />
              <RHFTextField name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" />
              <Button type="button" onClick={goNext}>Next</Button>
            </>
          )}
          {step === 1 && (
            <>
              <Controller
                control={methods.control}
                name="countryId"
                render={({ field, fieldState }) => (
                  <TextField
                    select
                    label="Country of residence"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  >
                    {countries.map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <RHFTextField name="ibCode" label="Introducer code (optional)" />
              <FormControlLabel
                control={
                  <Checkbox
                    onChange={(e) => methods.setValue('agreeToTerms', e.target.checked as true, { shouldValidate: true })}
                  />
                }
                // C-2 pre-production compliance blocker: link to the real T&C / Client
                // Agreement / KID documents once compliance supplies them.
                label="I agree to the Terms and Conditions"
              />
              {methods.formState.errors.agreeToTerms && (
                <Box sx={{ color: 'error.main', fontSize: 12 }}>{methods.formState.errors.agreeToTerms.message}</Box>
              )}
              <FormControlLabel
                control={<Checkbox {...methods.register('marketingConsent')} />}
                label="Send me marketing updates"
              />
              <Stack direction="row" spacing={1}>
                <Button type="button" variant="text" onClick={() => setStep(0)}>Back</Button>
                <Button type="submit" disabled={register.isPending}>Create account</Button>
              </Stack>
            </>
          )}
          {captcha.element}
        </Stack>
      </Box>
    </FormProvider>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/registration/components/RegisterForm.test.tsx`
Expected: PASS (3 tests). If the MUI Select option query differs, ensure the select renders a listbox of `option` roles on click; adjust the label match only, not the behaviour.

- [ ] **Step 5: Commit**

```bash
git add src/features/registration/components/RegisterForm.tsx src/features/registration/components/RegisterForm.test.tsx
git commit -m "feat(registration): two-step live create-account form"
```

---

### Task 6: Register screen + route + router wiring

**Files:**
- Create: `src/features/registration/RegisterScreen.tsx`
- Create: `src/features/registration/routes/register.tsx`
- Modify: `src/router/router.tsx`

- [ ] **Step 1: Implement `RegisterScreen.tsx`**

```tsx
import { Stack, Typography } from '@mui/material'
import { RegisterForm } from './components/RegisterForm'

export const RegisterScreen = () => (
  <Stack spacing={3} sx={{ maxWidth: 420, mx: 'auto', mt: 4 }}>
    <Typography variant="h4">Create your account</Typography>
    <RegisterForm />
    <Typography variant="caption" color="text.secondary">
      CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.
    </Typography>
  </Stack>
)
```

- [ ] **Step 2: Implement `routes/register.tsx`**

```tsx
import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { RegisterScreen } from '@/features/registration/RegisterScreen'

export const RegisterRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/register',
  component: RegisterScreen,
})
```

- [ ] **Step 3: Wire the route into `src/router/router.tsx`**

Add the import below the existing route imports:

```ts
import { RegisterRoute } from '@/features/registration/routes/register'
```

Add `RegisterRoute` to the root children list (a public sibling of `LoginRoute`):

```ts
const routeTree = RootRoute.addChildren([
  IndexRoute,
  LoginRoute,
  RegisterRoute,
  TwoFactorRoute,
  ResetRequestRoute,
  ResetSentRoute,
  ResetConfirmRoute,
  ResetDoneRoute,
  AuthenticatedRoute.addChildren([OnboardingRoute]),
])
```

- [ ] **Step 4: Verify the build and lint pass**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run lint && npx tsc -p tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/registration/RegisterScreen.tsx src/features/registration/routes/register.tsx src/router/router.tsx
git commit -m "feat(registration): /account/register route with risk disclosure"
```

---

### Task 7: Email verification API + queries

**Files:**
- Create: `src/features/emailVerification/api/emailApi.ts`
- Create: `src/features/emailVerification/api/emailQueries.ts`
- Test: `src/features/emailVerification/api/emailApi.test.ts`

- [ ] **Step 1: Write the failing test**

`src/features/emailVerification/api/emailApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const tfboCall = vi.fn()
vi.mock('@/api/client', () => ({ getHttpClient: () => ({ tfboCall }) }))

beforeEach(() => tfboCall.mockReset())

const params = {
  originCountry: 1, accountHolderFirstName: 'A', accountHolderLastName: 'B',
  preferredLanguage: 1, accountHolderEmail: 'a@b.com',
}

describe('email verification api', () => {
  it('sends the OTP via emailvalidation/send_verification_code authenticated', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'OK', result: true }] })
    const { sendOtpCode } = await import('./emailApi')
    const { Authorize } = await import('@/api/httpClient')
    expect(await sendOtpCode(params)).toBe(true)
    expect(tfboCall).toHaveBeenCalledWith('emailvalidation', 'send_verification_code', params, Authorize.Yes)
  })

  it('verifies the OTP via emailvalidation/verify_otp_code', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'OK', result: true }] })
    const { verifyOtpCode } = await import('./emailApi')
    const { Authorize } = await import('@/api/httpClient')
    expect(await verifyOtpCode('123456', 'a@b.com')).toBe(true)
    expect(tfboCall).toHaveBeenCalledWith('emailvalidation', 'verify_otp_code', { otpValue: '123456', accountHolderEmail: 'a@b.com' }, Authorize.Yes)
  })

  it('returns false when verification status is not OK', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'VALIDATION_ERROR' }] })
    const { verifyOtpCode } = await import('./emailApi')
    expect(await verifyOtpCode('000000', 'a@b.com')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/emailVerification/api/emailApi.test.ts`
Expected: FAIL (cannot find module `./emailApi`).

- [ ] **Step 3: Implement `emailApi.ts`**

```ts
import { getHttpClient } from '@/api/client'
import { Authorize } from '@/api/httpClient'

export interface SendOtpParams {
  originCountry: number
  accountHolderFirstName: string
  accountHolderLastName: string
  preferredLanguage: number
  accountHolderEmail: string
}

export const sendOtpCode = async (params: SendOtpParams): Promise<boolean> => {
  const res = await getHttpClient().tfboCall<boolean>('emailvalidation', 'send_verification_code', params, Authorize.Yes)
  return res.payload?.[0]?.status === 'OK'
}

export const verifyOtpCode = async (otpValue: string, email: string): Promise<boolean> => {
  const res = await getHttpClient().tfboCall<boolean>(
    'emailvalidation',
    'verify_otp_code',
    { otpValue, accountHolderEmail: email },
    Authorize.Yes
  )
  return res.payload?.[0]?.status === 'OK'
}
```

- [ ] **Step 4: Implement `emailQueries.ts`**

```ts
import { useMutation } from '@tanstack/react-query'
import { sendOtpCode, verifyOtpCode } from './emailApi'
import type { SendOtpParams } from './emailApi'

export const useSendOtp = () =>
  useMutation({ mutationFn: (params: SendOtpParams) => sendOtpCode(params) })

export const useVerifyOtp = () =>
  useMutation({ mutationFn: (v: { otp: string; email: string }) => verifyOtpCode(v.otp, v.email) })
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/emailVerification/api/emailApi.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/emailVerification/api/emailApi.ts src/features/emailVerification/api/emailQueries.ts src/features/emailVerification/api/emailApi.test.ts
git commit -m "feat(email-verification): OTP send/verify api and mutations"
```

---

### Task 8: OTP input component

**Files:**
- Create: `src/features/emailVerification/components/OtpInput.tsx`
- Test: `src/features/emailVerification/components/OtpInput.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/features/emailVerification/components/OtpInput.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OtpInput } from './OtpInput'

describe('OtpInput', () => {
  it('emits the joined value once all digits are typed', async () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} />)
    await userEvent.type(screen.getByLabelText('Digit 1'), '1')
    await userEvent.type(screen.getByLabelText('Digit 2'), '2')
    await userEvent.type(screen.getByLabelText('Digit 3'), '3')
    await userEvent.type(screen.getByLabelText('Digit 4'), '4')
    await userEvent.type(screen.getByLabelText('Digit 5'), '5')
    await userEvent.type(screen.getByLabelText('Digit 6'), '6')
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('distributes a pasted code across the fields', async () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} />)
    const first = screen.getByLabelText('Digit 1')
    first.focus()
    await userEvent.paste('987654')
    expect(onComplete).toHaveBeenCalledWith('987654')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/emailVerification/components/OtpInput.test.tsx`
Expected: FAIL (cannot find module `./OtpInput`).

- [ ] **Step 3: Implement `OtpInput.tsx`**

```tsx
import { useRef } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { Stack, TextField } from '@mui/material'

interface Props {
  length?: number
  onComplete: (value: string) => void
}

export const OtpInput = ({ length = 6, onComplete }: Props) => {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const values = useRef<string[]>(Array(length).fill(''))

  const setAt = (i: number, ch: string) => {
    values.current[i] = ch
    const el = refs.current[i]
    if (el) el.value = ch
  }

  const emit = () => {
    const joined = values.current.join('')
    if (joined.length === length && !values.current.includes('')) onComplete(joined)
  }

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    setAt(i, digit)
    if (digit && i < length - 1) refs.current[i + 1]?.focus()
    emit()
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!digits) return
    e.preventDefault()
    digits.split('').forEach((d, k) => setAt(k, d))
    refs.current[Math.min(digits.length, length - 1)]?.focus()
    emit()
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !values.current[i] && i > 0) refs.current[i - 1]?.focus()
  }

  return (
    <Stack direction="row" spacing={1}>
      {Array.from({ length }).map((_, i) => (
        <TextField
          key={i}
          inputRef={(el: HTMLInputElement | null) => { refs.current[i] = el }}
          onChange={(e) => handleChange(i, e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => handleKeyDown(i, e)}
          slotProps={{ htmlInput: { maxLength: 1, inputMode: 'numeric', 'aria-label': `Digit ${i + 1}` } }}
          sx={{ width: 48 }}
        />
      ))}
    </Stack>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/emailVerification/components/OtpInput.test.tsx`
Expected: PASS (2 tests). If MUI v9 rejects `slotProps.htmlInput`, fall back to `inputProps={{ maxLength: 1, inputMode: 'numeric', 'aria-label': \`Digit ${i + 1}\` }}` — keep the `aria-label` exactly so the tests resolve fields.

- [ ] **Step 5: Commit**

```bash
git add src/features/emailVerification/components/OtpInput.tsx src/features/emailVerification/components/OtpInput.test.tsx
git commit -m "feat(email-verification): six-digit OTP input"
```

---

### Task 9: Email verification screen + route + router wiring

**Files:**
- Create: `src/features/emailVerification/EmailVerificationScreen.tsx`
- Create: `src/features/emailVerification/routes/verifyEmail.tsx`
- Modify: `src/router/router.tsx`
- Test: `src/features/emailVerification/EmailVerificationScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/features/emailVerification/EmailVerificationScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const sendMutate = vi.fn()
const verifyMutateAsync = vi.fn()
const navigate = vi.fn()
const profile = { id: 1, firstName: 'Ann', lastName: 'Lee', email: 'a@b.com', country: { id: 1 } }

vi.mock('@/features/auth/api/authQueries', () => ({ useUserProfile: () => ({ data: profile }) }))
vi.mock('./api/emailQueries', () => ({
  useSendOtp: () => ({ mutate: sendMutate, isPending: false }),
  useVerifyOtp: () => ({ mutateAsync: verifyMutateAsync }),
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => {
  sendMutate.mockReset()
  verifyMutateAsync.mockReset()
  navigate.mockReset()
})

describe('EmailVerificationScreen', () => {
  it('sends the OTP on mount with the profile fields', async () => {
    const { EmailVerificationScreen } = await import('./EmailVerificationScreen')
    render(<EmailVerificationScreen />)
    expect(sendMutate).toHaveBeenCalledWith({
      originCountry: 1, accountHolderFirstName: 'Ann', accountHolderLastName: 'Lee',
      preferredLanguage: 1, accountHolderEmail: 'a@b.com',
    })
  })

  it('navigates to the landing route after a successful verification', async () => {
    verifyMutateAsync.mockResolvedValue(true)
    const { EmailVerificationScreen } = await import('./EmailVerificationScreen')
    render(<EmailVerificationScreen />)
    for (let i = 1; i <= 6; i++) await userEvent.type(screen.getByLabelText(`Digit ${i}`), String(i))
    expect(verifyMutateAsync).toHaveBeenCalledWith({ otp: '123456', email: 'a@b.com' })
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/onboarding' }))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/emailVerification/EmailVerificationScreen.test.tsx`
Expected: FAIL (cannot find module `./EmailVerificationScreen`).

- [ ] **Step 3: Implement `EmailVerificationScreen.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { Stack, Typography } from '@mui/material'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/Button'
import { OtpInput } from './components/OtpInput'
import { useSendOtp, useVerifyOtp } from './api/emailQueries'
import { useUserProfile } from '@/features/auth/api/authQueries'
import { useNotificationStore } from '@/state/notificationStore'
import { resolveLandingRoute } from '@/features/auth/landing'
import type { SendOtpParams } from './api/emailApi'

export const EmailVerificationScreen = () => {
  const { data: profile } = useUserProfile(true)
  const send = useSendOtp()
  const verify = useVerifyOtp()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)
  const sent = useRef(false)

  // The profile carries a language code, not the numeric id this endpoint expects;
  // default to English (id 1) as the legacy flow does. TODO(verify): map code -> id.
  const sendParams = (): SendOtpParams | undefined =>
    profile && {
      originCountry: profile.country.id,
      accountHolderFirstName: profile.firstName,
      accountHolderLastName: profile.lastName,
      preferredLanguage: 1,
      accountHolderEmail: profile.email,
    }

  useEffect(() => {
    const params = sendParams()
    if (params && !sent.current) {
      sent.current = true
      send.mutate(params)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  if (!profile) return <Typography>Loading...</Typography>

  const onComplete = async (otp: string) => {
    const ok = await verify.mutateAsync({ otp, email: profile.email }).catch(() => false)
    if (ok) {
      notify({ severity: 'success', message: 'Email verified' })
      navigate({ to: resolveLandingRoute(profile) })
    } else {
      notify({ severity: 'error', message: 'Invalid or expired code' })
    }
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 420, mx: 'auto', mt: 4 }}>
      <Typography variant="h4">Verify your email</Typography>
      <Typography>We sent a 6-digit code to {profile.email}.</Typography>
      <OtpInput onComplete={onComplete} />
      <Button variant="text" disabled={send.isPending} onClick={() => { const p = sendParams(); if (p) send.mutate(p) }}>
        Resend code
      </Button>
    </Stack>
  )
}
```

- [ ] **Step 4: Implement `routes/verifyEmail.tsx`**

```tsx
import { createRoute } from '@tanstack/react-router'
import { AuthenticatedRoute } from '@/router/routes/authenticated'
import { EmailVerificationScreen } from '@/features/emailVerification/EmailVerificationScreen'

export const VerifyEmailRoute = createRoute({
  getParentRoute: () => AuthenticatedRoute,
  path: '/account/verify-email',
  component: EmailVerificationScreen,
})
```

- [ ] **Step 5: Wire the route into `src/router/router.tsx`**

Add the import:

```ts
import { VerifyEmailRoute } from '@/features/emailVerification/routes/verifyEmail'
```

Add `VerifyEmailRoute` as a child of `AuthenticatedRoute`:

```ts
  AuthenticatedRoute.addChildren([OnboardingRoute, VerifyEmailRoute]),
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/emailVerification/EmailVerificationScreen.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/features/emailVerification/EmailVerificationScreen.tsx src/features/emailVerification/EmailVerificationScreen.test.tsx src/features/emailVerification/routes/verifyEmail.tsx src/router/router.tsx
git commit -m "feat(email-verification): /account/verify-email screen and route"
```

---

### Task 10: Onboarding completion stub routes to email verification

**Files:**
- Modify: `src/features/onboarding/OnboardingScreen.tsx`
- Test: `src/features/onboarding/OnboardingScreen.completion.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/features/onboarding/OnboardingScreen.completion.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const navigate = vi.fn()
vi.mock('./api/onboardingQueries', () => ({
  useApplication: () => ({ data: { applicationId: 1, status: 'PENDING_KYC' }, isLoading: false }),
  useQuestions: () => ({ data: [] }),
  useIncrementalSubmit: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelOne: () => ({ mutateAsync: vi.fn() }),
  useSubmitLevelTwo: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./flows/simplified/useQuestionsList', () => ({ useQuestionsList: () => [] }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => navigate.mockReset())

describe('OnboardingScreen completion', () => {
  it('offers email verification once the application is pending KYC', async () => {
    const { OnboardingScreen } = await import('./OnboardingScreen')
    render(<OnboardingScreen />)
    await userEvent.click(screen.getByRole('button', { name: /verify your email/i }))
    expect(navigate).toHaveBeenCalledWith({ to: '/account/verify-email' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/onboarding/OnboardingScreen.completion.test.tsx`
Expected: FAIL (no "Verify your email" button; the branch renders a plain Typography).

- [ ] **Step 3: Edit `OnboardingScreen.tsx`**

Add `useNavigate` to the router import at the top:

```ts
import { useNavigate } from '@tanstack/react-router'
```

Add this component above `OnboardingScreen` (next to `Level1Done`):

```tsx
const OnboardingComplete = () => {
  const navigate = useNavigate()
  return (
    <Stack spacing={2} sx={{ maxWidth: 420 }}>
      <Typography>Your application is being processed. Document verification is the next step.</Typography>
      <Button onClick={() => navigate({ to: '/account/verify-email' })}>Verify your email</Button>
    </Stack>
  )
}
```

Replace the existing pending/approved branch:

```ts
  if (status === 'PENDING_KYC' || status === 'PENDING_REVIEW' || status === 'APPROVED') {
    return <Typography>Your application is being processed. Document verification is the next step.</Typography>
  }
```

with:

```ts
  if (status === 'PENDING_KYC' || status === 'PENDING_REVIEW' || status === 'APPROVED') {
    return <OnboardingComplete />
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run src/features/onboarding/OnboardingScreen.completion.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/OnboardingScreen.tsx src/features/onboarding/OnboardingScreen.completion.test.tsx
git commit -m "feat(onboarding): route completed application to email verification"
```

---

### Task 11: E2E — registration happy path

**Files:**
- Create: `e2e/registration.spec.ts`

- [ ] **Step 1: Write the e2e spec**

`e2e/registration.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('live registration creates an account and lands in onboarding', async ({ page }) => {
  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    const ok = (result: unknown) =>
      route.fulfill({ json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] } })
    if (action === 'getCountries')
      return ok([{ id: 1, name: 'Australia', code2: 'AU', code3: 'AUS', phoneCode: 61, european: false, organization: { id: 7, name: 'AU' } }])
    if (action === 'incremental_submit') return ok({ applicationId: 9, applicationStatus: 'INCOMPLETE' })
    // Omit portalAccountDomain so the loaded app uses the simplified flow, whose first
    // step is "Personal information" (mirrors the proven auth.spec.ts pattern). This e2e
    // proves the registration -> onboarding handoff, not jurisdiction routing.
    if (action === 'getLastApplicationsInfo') return ok([{ applicationId: 9, status: 'INCOMPLETE' }])
    if (action === 'getQuestions') return ok([])
    if (action === 'get_user') return ok({ id: 1, email: 'a@b.com', firstName: 'Ann', lastName: 'Lee', country: { id: 1 }, additionalAttributes: {} })
    return ok({})
  })

  await page.goto('/account/register')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByLabel('Password', { exact: true }).fill('Secret12')
  await page.getByLabel(/confirm password/i).fill('Secret12')
  await page.getByRole('button', { name: /next/i }).click()

  await page.getByLabel(/country of residence/i).click()
  await page.getByRole('option', { name: 'Australia' }).click()
  await page.getByLabel(/i agree/i).click()
  await page.getByRole('button', { name: /create account/i }).click()

  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByText('Personal information')).toBeVisible()
})
```

- [ ] **Step 2: Run the e2e spec**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx playwright test e2e/registration.spec.ts`
Expected: PASS. (The Playwright config serves the app in `--mode test` over plain HTTP; no `.certs` needed.)

- [ ] **Step 3: Commit**

```bash
git add e2e/registration.spec.ts
git commit -m "test(registration): e2e create-account to onboarding"
```

---

### Task 12: E2E — email verification

**Files:**
- Create: `e2e/email-verification.spec.ts`

- [ ] **Step 1: Write the e2e spec**

`e2e/email-verification.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('completed onboarding leads to a successful email verification', async ({ page }) => {
  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    const ok = (result: unknown) =>
      route.fulfill({ json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] } })
    if (action === 'getLastApplicationsInfo') return ok([{ applicationId: 9, status: 'PENDING_KYC', portalAccountDomain: 'AU' }])
    if (action === 'get_user') return ok({ id: 1, email: 'a@b.com', firstName: 'Ann', lastName: 'Lee', country: { id: 1 }, additionalAttributes: {} })
    if (action === 'getQuestions') return ok([])
    if (action === 'send_verification_code') return ok(true)
    if (action === 'verify_otp_code') return ok(true)
    return ok({})
  })

  // Seed a logged-in session so the authenticated route is reachable.
  await page.addInitScript(() => {
    localStorage.setItem('_ss__', 's')
    localStorage.setItem('___t', 't')
    localStorage.setItem('__at_', 'a')
  })

  await page.goto('/onboarding')
  await page.getByRole('button', { name: /verify your email/i }).click()

  await expect(page).toHaveURL(/\/account\/verify-email/)
  await expect(page.getByText(/we sent a 6-digit code/i)).toBeVisible()
  for (let i = 1; i <= 6; i++) await page.getByLabel(`Digit ${i}`).fill(String(i))

  await expect(page).toHaveURL(/\/onboarding/)
})
```

Note: the logged-in session also requires `useSessionStore.loggedIn` to be true for the `AuthenticatedRoute` guard. If the guard reads only the Zustand store (not localStorage), add to the init script a flag the app reads on boot, or navigate via the in-app flow. Confirm against `src/router/routes/authenticated.tsx` and `SessionGuard`; if the guard hydrates `loggedIn` from token presence, the localStorage seed above is sufficient. If not, drive the test through `/account/register` first (as in Task 11) and then complete onboarding, rather than seeding storage.

- [ ] **Step 2: Run the e2e spec**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx playwright test e2e/email-verification.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/email-verification.spec.ts
git commit -m "test(email-verification): e2e onboarding completion to verified email"
```

---

### Task 13: Full suite + lint gate

**Files:** none (verification only)

- [ ] **Step 1: Run lint and typecheck**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npm run lint && npx tsc -p tsconfig.json --noEmit`
Expected: no errors. Confirm no `.claude/worktrees/` paths appear in lint output (they are ignored).

- [ ] **Step 2: Run the full unit/component suite**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx vitest run`
Expected: all tests pass, including the new registration and email-verification files.

- [ ] **Step 3: Run the full e2e suite**

Run: `source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null && npx playwright test`
Expected: all specs pass.

- [ ] **Step 4: Commit (only if any fixes were required)**

```bash
git add <specific fixed files>
git commit -m "chore(registration): suite green"
```

---

## Security / Compliance review (run after Task 13)

Dispatch the `security-compliance` agent over the diff before sign-off. Specific items to confirm:

- No PII (email, password, OTP) is sent to Sentry; the create payload and OTP fields are scrubbed by the existing filter.
- Password complexity is enforced and the password is never logged.
- T&C acceptance is required server-trippable (the checkbox cannot be bypassed); the T&C link is the tracked **C-2** placeholder (pre-production blocker).
- Marketing defaults to opt-out (`isMarketingOptOut: true` unless consent ticked) — confirm with compliance.
- The unauthenticated create payload contains only what the backend needs; no over-collection.

## Backend-verify follow-ups (track, do not block implementation)

- Exact create action name (`incremental_submit`) and the minimal accepted payload before personal info.
- The precise auth material returned by the create (envelope `session_id`/`token` vs OAuth `tokens`); confirm Bearer-authenticated `auth/*` calls work post-register, else capture the returned OAuth tokens.
- OTP `send_verification_code` / `verify_otp_code` payload shapes and required fields.
- The `preferredLanguages` list + `getLanguageId` mapping (English id 1 default today).
- Add an `emailVerified` field to `UserProfile` for the eventual login-time verification gate.

## Deferred (out of scope, tracked)

Demo account registration; social / Keycloak PKCE; EU-geo country filtering; IB country-whitelist; Capital-Index forced-AU; AU application-type and UAE org residency sub-steps; multi-country tax residency and Canada province selection.

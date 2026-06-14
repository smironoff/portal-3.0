# Auth Vertical (2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the throwaway dev sign-in with real authentication — email/password login, 2FA (TOTP), password reset, refresh-token session with a profile-driven inactivity auto-logout, and hCaptcha — ending at a `resolveLandingRoute()` seam.

**Architecture:** Feature folder `src/features/auth/` built on the Foundation. Auth API functions wrap the Foundation `httpClient` (`auth()` for `AUTH_URL`, `tfbo()` for the TFBO envelope). TanStack Query mutations/query drive the UI. RHF + Zod forms use the Foundation primitives. A lazy app-wide HTTP client singleton is added. Tests mock at the query-hook layer (component tests) and use Playwright route interception (e2e); no live backend and no MSW needed.

**Tech Stack:** React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`), TanStack Router + Query, Zustand, MUI v9, React Hook Form + Zod, `@hcaptcha/react-hcaptcha`, MSW, Vitest, Playwright. **Node pinned to 20** — every command runs under `source "$HOME/.nvm/nvm.sh" && nvm use`.

**Spec:** `docs/superpowers/specs/2026-06-14-auth-vertical-design.md`
**Legacy reference:** `/Volumes/WORK/ThinkMarkets/portal-2.0/src` (read-only).

**Exact legacy contracts (verified):**

- Login: `POST {AUTH_URL}/auth/login`, body `{ email, password, recaptchaResponse }` → `{ status, code?, tokens?, redirectURI? }`. Statuses: `OK | PENDING_APPROVAL | PENDING_REVIEW | PENDING_ID_ADDRESS | PENDING_ID | PENDING_ADDRESS | TFA_REQUIRED`. Wrong creds → `code: 'ASE-001'`.
- 2FA: `POST {AUTH_URL}/auth/tfa`, body `{ email, code, recaptchaResponse? }` → `{ status, code?, tokens? }`. Expired → `code: 'ASE-002'`.
- Password reset (both steps): TFBO `module: 'authentication', action: 'forgot_password_web'`. Step 1 params `{ email_id, response }`; step 2 params `{ password, password_reset_token, response }`. Result `{ password_reset: 'OK' | 'NOK' }`.
- Get profile: TFBO `module: 'profile', action: 'get_user'`, no params → `UserProfile`. Inactivity: `userProfile.additionalAttributes.inactivityTimeout` (string, **minutes**), fallback config `LOGOUT_AFTER_MIN`.
- Captcha: **hCaptcha** (`@hcaptcha/react-hcaptcha`), invisible, key `HCAPTCHA_KEY`.

---

## File structure

```
src/api/
  client.ts                      (lazy app-wide httpClient/authClient singleton)  [new]
src/features/auth/
  api/
    authTypes.ts                 (LoginStatus, AuthResult, reset/profile types)
    authApi.ts                   (login, verifyTwoFactor, requestPasswordReset, confirmPasswordReset, getUserProfile)
    authApi.test.ts
    aseCodes.ts                  (ASE-* -> i18n key map)
    aseCodes.test.ts
    authQueries.ts               (useLogin, useVerifyTwoFactor, useRequestPasswordReset, useConfirmPasswordReset, useUserProfile)
  hooks/
    useCaptcha.tsx               (hCaptcha invisible wrapper)
    useInactivityTimeout.ts
    useInactivityTimeout.test.ts
  components/
    LoginForm.tsx / LoginForm.test.tsx
    TwoFactorForm.tsx / TwoFactorForm.test.tsx
    PasswordResetRequestForm.tsx / .test.tsx
    PasswordResetConfirmForm.tsx / .test.tsx
  routes/
    login.tsx, twoFactor.tsx, resetRequest.tsx, resetSent.tsx, resetConfirm.tsx, resetDone.tsx
  landing.ts / landing.test.ts
  keepSignedIn.ts                (persisted flag helpers)
e2e/
  auth.spec.ts                   (login -> 2FA -> landing; reset happy path)
```

The Foundation `src/api/*`, `src/state/*`, `src/components/*` stay as shared infrastructure. Extend `src/api/types.ts` `UserProfile` with `additionalAttributes`.

---

## Task 1: App-wide HTTP client singleton

**Files:** Create `src/api/client.ts`. Test `src/api/client.test.ts`.

- [ ] **Step 1: Write the failing test**

`src/api/client.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('getHttpClient', () => {
  beforeEach(() => vi.resetModules())

  it('builds a single client lazily from config and reuses it', async () => {
    vi.doMock('@/config/configStore', () => ({
      getConfig: () => ({ API_DATA_URL: 'https://api.test/nsdata', AUTH_URL: 'https://auth.test' }),
    }))
    const { getHttpClient } = await import('./client')
    const a = getHttpClient()
    const b = getHttpClient()
    expect(a).toBe(b)
    expect(typeof a.auth).toBe('function')
    expect(typeof a.tfbo).toBe('function')
  })
})
```

- [ ] **Step 2: Run it, verify FAIL** — `npx vitest run src/api/client.test.ts` (module missing).

- [ ] **Step 3: Implement** `src/api/client.ts`:

```ts
import { getConfig } from '@/config/configStore'
import { createAuthClient, type AuthClient } from './authClient'
import { createHttpClient, type HttpClient } from './httpClient'

let httpClient: HttpClient | undefined
let authClient: AuthClient | undefined

export function getAuthClient(): AuthClient {
  if (!authClient) authClient = createAuthClient(getConfig())
  return authClient
}

export function getHttpClient(): HttpClient {
  if (!httpClient) httpClient = createHttpClient(getConfig(), getAuthClient())
  return httpClient
}
```

(If `createAuthClient`/`createHttpClient` do not already export their return types `AuthClient`/`HttpClient`, add the `export type` to those Foundation files.)

- [ ] **Step 4: Run it, verify PASS.**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(api): lazy app-wide http/auth client singleton"
```

---

## Task 2: Auth types and ASE code map

**Files:** Create `src/features/auth/api/authTypes.ts`, `src/features/auth/api/aseCodes.ts`. Modify `src/api/types.ts`. Test `src/features/auth/api/aseCodes.test.ts`.

- [ ] **Step 1: Extend `UserProfile`** in `src/api/types.ts` — add the inactivity attribute:

```ts
export type UserProfile = {
  id: number
  firstName: string
  lastName: string
  fullName: string
  email: string
  cif: string
  brand: string
  country: Country
  approved: boolean
  preferredLanguage: { code: string; name?: string } | string
  additionalAttributes?: {
    inactivityTimeout?: string // minutes, as a string
    [key: string]: unknown
  }
}
```

- [ ] **Step 2: Implement** `src/features/auth/api/authTypes.ts`:

```ts
import type { AuthTokens } from '@/api/types'

export type LoginStatus =
  | 'OK'
  | 'PENDING_APPROVAL'
  | 'PENDING_REVIEW'
  | 'PENDING_ID_ADDRESS'
  | 'PENDING_ID'
  | 'PENDING_ADDRESS'
  | 'TFA_REQUIRED'

export interface AuthResult {
  status?: LoginStatus | string
  code?: string
  tokens?: AuthTokens
  redirectURI?: string
}

export interface PasswordResetResult {
  password_reset: 'OK' | 'NOK'
}

// Login statuses that mean "credentials accepted, proceed to land".
export const LOGGED_IN_STATUSES: LoginStatus[] = [
  'OK',
  'PENDING_APPROVAL',
  'PENDING_REVIEW',
  'PENDING_ID_ADDRESS',
  'PENDING_ID',
  'PENDING_ADDRESS',
]
```

- [ ] **Step 3: Write the failing test** `src/features/auth/api/aseCodes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { aseCodeToMessageKey } from './aseCodes'

describe('aseCodeToMessageKey', () => {
  it('maps known codes', () => {
    expect(aseCodeToMessageKey('ASE-001')).toBe('auth.error.invalidCredentials')
    expect(aseCodeToMessageKey('ASE-002')).toBe('auth.error.tfaExpired')
  })
  it('falls back to a generic key for unknown codes', () => {
    expect(aseCodeToMessageKey('ASE-999')).toBe('auth.error.generic')
    expect(aseCodeToMessageKey(undefined)).toBe('auth.error.generic')
  })
})
```

Run -> FAIL.

- [ ] **Step 4: Implement** `src/features/auth/api/aseCodes.ts`:

```ts
const MAP: Record<string, string> = {
  'ASE-001': 'auth.error.invalidCredentials',
  'ASE-002': 'auth.error.tfaExpired',
  'ASE-004': 'auth.error.missingFields',
  'ASE-005': 'auth.error.userNotFound',
  'ASE-008': 'auth.error.alreadyRegistered',
  'ASE-009': 'auth.error.syncFailed',
}

export function aseCodeToMessageKey(code: string | undefined): string {
  return (code && MAP[code]) || 'auth.error.generic'
}
```

Run -> PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(auth): auth result types and ASE error-code message map"
```

---

## Task 3: Auth API functions

**Files:** Create `src/features/auth/api/authApi.ts`. Test `src/features/auth/api/authApi.test.ts`.

- [ ] **Step 1: Write the failing test** `src/features/auth/api/authApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const http = { auth: vi.fn(), tfbo: vi.fn(), request: vi.fn() }
vi.mock('@/api/client', () => ({ getHttpClient: () => http }))

beforeEach(() => {
  http.auth.mockReset()
  http.tfbo.mockReset()
})

describe('authApi', () => {
  it('login posts credentials to auth/login unauthenticated', async () => {
    http.auth.mockResolvedValue({ status: 'OK', tokens: { accessToken: 'a' } })
    const { login } = await import('./authApi')
    const res = await login('a@b.com', 'pw', 'captcha-token')
    expect(http.auth).toHaveBeenCalledWith(
      'auth/login',
      'post',
      { email: 'a@b.com', password: 'pw', recaptchaResponse: 'captcha-token' },
      1 // Authorize.No
    )
    expect(res.status).toBe('OK')
  })

  it('verifyTwoFactor posts code to auth/tfa authenticated', async () => {
    http.auth.mockResolvedValue({ status: 'OK' })
    const { verifyTwoFactor } = await import('./authApi')
    await verifyTwoFactor('a@b.com', '123456')
    expect(http.auth).toHaveBeenCalledWith(
      'auth/tfa',
      'post',
      { email: 'a@b.com', code: '123456' },
      0
    )
  })

  it('requestPasswordReset sends the TFBO forgot_password_web envelope', async () => {
    http.tfbo.mockResolvedValue({ payload: [{ result: { password_reset: 'OK' } }] })
    const { requestPasswordReset } = await import('./authApi')
    const ok = await requestPasswordReset('a@b.com', 'cap')
    expect(http.tfbo).toHaveBeenCalledWith(
      {
        payload: [
          {
            module: 'authentication',
            action: 'forgot_password_web',
            email_id: 'a@b.com',
            response: 'cap',
          },
        ],
      },
      1
    )
    expect(ok).toBe(true)
  })

  it('getUserProfile reads payload[0].result', async () => {
    http.tfbo.mockResolvedValue({ payload: [{ result: { id: 1, email: 'a@b.com' } }] })
    const { getUserProfile } = await import('./authApi')
    const p = await getUserProfile()
    expect(p.email).toBe('a@b.com')
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `src/features/auth/api/authApi.ts`:

```ts
import { getHttpClient } from '@/api/client'
import { Authorize } from '@/api/httpClient'
import type { UserProfile } from '@/api/types'
import type { AuthResult, PasswordResetResult } from './authTypes'

export function login(
  email: string,
  password: string,
  recaptchaResponse: string
): Promise<AuthResult> {
  return getHttpClient().auth<AuthResult>(
    'auth/login',
    'post',
    { email, password, recaptchaResponse },
    Authorize.No
  )
}

export function verifyTwoFactor(email: string, code: string): Promise<AuthResult> {
  return getHttpClient().auth<AuthResult>('auth/tfa', 'post', { email, code }, Authorize.Yes)
}

export async function requestPasswordReset(
  email: string,
  recaptchaResponse: string
): Promise<boolean> {
  const res = await getHttpClient().tfbo<PasswordResetResult>(
    {
      payload: [
        {
          module: 'authentication',
          action: 'forgot_password_web',
          email_id: email,
          response: recaptchaResponse,
        },
      ],
    },
    Authorize.No
  )
  return res.payload?.[0]?.result?.password_reset === 'OK'
}

export async function confirmPasswordReset(
  password: string,
  token: string,
  recaptchaResponse: string
): Promise<boolean> {
  const res = await getHttpClient().tfbo<PasswordResetResult>(
    {
      payload: [
        {
          module: 'authentication',
          action: 'forgot_password_web',
          password,
          password_reset_token: token,
          response: recaptchaResponse,
        },
      ],
    },
    Authorize.No
  )
  return res.payload?.[0]?.result?.password_reset === 'OK'
}

export async function getUserProfile(): Promise<UserProfile> {
  const res = await getHttpClient().tfbo<UserProfile>({
    payload: [{ module: 'profile', action: 'get_user' }],
  })
  const profile = res.payload?.[0]?.result
  if (!profile) throw new Error('Profile not found in response')
  return profile
}
```

- [ ] **Step 4: Run it, verify PASS.**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(auth): typed auth API (login, 2FA, reset, profile)"
```

---

## Task 4: keepSignedIn flag + landing seam

**Files:** Create `src/features/auth/keepSignedIn.ts`, `src/features/auth/landing.ts`. Test `src/features/auth/landing.test.ts`.

- [ ] **Step 1: Implement** `src/features/auth/keepSignedIn.ts`:

```ts
const KEY = 'keepLogged'

export const keepSignedIn = {
  get: () => localStorage.getItem(KEY) === 'true',
  set: (v: boolean) => localStorage.setItem(KEY, String(v)),
}
```

- [ ] **Step 2: Write the failing test** `src/features/auth/landing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveLandingRoute } from './landing'

describe('resolveLandingRoute', () => {
  it('returns the authenticated placeholder for now', () => {
    expect(resolveLandingRoute()).toBe('/hello')
  })
})
```

Run -> FAIL.

- [ ] **Step 3: Implement** `src/features/auth/landing.ts`:

```ts
import type { UserProfile } from '@/api/types'

// SEAM: later verticals replace the body with status-based routing
// (approved -> dashboard, incomplete -> onboarding, pending -> pending screen).
// For 2a it always lands on the authenticated placeholder.
export function resolveLandingRoute(_profile?: UserProfile): string {
  return '/hello'
}
```

Run -> PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(auth): keepSignedIn flag and landing-route seam"
```

---

## Task 5: Inactivity timeout hook

Replaces the legacy `CheckActivitySaga`. Timer-based (reset on activity), not polling. Disabled when keep-signed-in is set.

**Files:** Create `src/features/auth/hooks/useInactivityTimeout.ts`. Test `src/features/auth/hooks/useInactivityTimeout.test.ts`.

- [ ] **Step 1: Write the failing test** (fake timers):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useInactivityTimeout } from './useInactivityTimeout'

describe('useInactivityTimeout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('calls onTimeout after the idle period when enabled', () => {
    const onTimeout = vi.fn()
    renderHook(() => useInactivityTimeout({ minutes: 1, enabled: true, onTimeout }))
    vi.advanceTimersByTime(61_000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('does nothing when disabled (keep signed in)', () => {
    const onTimeout = vi.fn()
    renderHook(() => useInactivityTimeout({ minutes: 1, enabled: false, onTimeout }))
    vi.advanceTimersByTime(120_000)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('resets the timer on user activity', () => {
    const onTimeout = vi.fn()
    renderHook(() => useInactivityTimeout({ minutes: 1, enabled: true, onTimeout }))
    vi.advanceTimersByTime(50_000)
    window.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(50_000)
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(11_000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })
})
```

Run -> FAIL.

- [ ] **Step 2: Implement** `src/features/auth/hooks/useInactivityTimeout.ts`:

```ts
import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

export function useInactivityTimeout(opts: {
  minutes: number
  enabled: boolean
  onTimeout: () => void
}) {
  const { minutes, enabled, onTimeout } = opts
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  useEffect(() => {
    if (!enabled) return
    const ms = minutes * 60_000
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => onTimeoutRef.current(), ms)
    }
    reset()
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [minutes, enabled])
}
```

Run -> PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(auth): inactivity timeout hook (replaces CheckActivitySaga)"
```

---

## Task 6: hCaptcha hook

**Files:** Create `src/features/auth/hooks/useCaptcha.tsx`. Modify `.env.*` to add `VITE_HCAPTCHA_KEY` (the `HCAPTCHA_KEY` schema field already exists). Install `@hcaptcha/react-hcaptcha`.

- [ ] **Step 1: Install the dependency**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null
npm install @hcaptcha/react-hcaptcha
```

- [ ] **Step 2: Implement** `src/features/auth/hooks/useCaptcha.tsx`:

```tsx
import { useCallback, useMemo, useRef } from 'react'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { useConfig } from '@/config/ConfigProvider'

// Invisible hCaptcha. Returns the element to render and an async executor that
// resolves to a token (empty string when no site key is configured).
export function useCaptcha() {
  const config = useConfig()
  const ref = useRef<HCaptcha>(null)
  const siteKey = config.HCAPTCHA_KEY

  const element = useMemo(
    () => (siteKey ? <HCaptcha ref={ref} sitekey={siteKey} size="invisible" /> : null),
    [siteKey]
  )

  const execute = useCallback(async (): Promise<string> => {
    if (!siteKey || !ref.current) return ''
    const res = await ref.current.execute({ async: true })
    return res?.response ?? ''
  }, [siteKey])

  const reset = useCallback(() => ref.current?.resetCaptcha(), [])

  return { element, execute, reset }
}
```

- [ ] **Step 3: Add `VITE_HCAPTCHA_KEY`** to `.env.development`, `.env.staging`, `.env.uat`, `.env.production`, `.env.example`. Use the legacy staging key `9290d3cc-8124-48b7-a831-e54fe9a4a3cc` for dev/staging; leave production/uat to confirm (placeholder allowed). Also add `VITE_HCAPTCHA_KEY` to the `ImportMetaEnv` interface in `src/vite-env.d.ts` and ensure `readEnv()` in `configStore.ts` maps `HCAPTCHA_KEY: e.VITE_HCAPTCHA_KEY`.

- [ ] **Step 4: Verify build/lint/test, then commit**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null
npm run build && npm run lint && npm run test
git add -A && git commit -m "feat(auth): invisible hCaptcha hook and env wiring"
```

(No unit test: the hook depends on the hCaptcha widget. It is exercised via the form component tests with hCaptcha mocked.)

---

## Task 7: TanStack Query auth hooks

**Files:** Create `src/features/auth/api/authQueries.ts`. Test `src/features/auth/api/authQueries.test.tsx`.

- [ ] **Step 1: Write the failing test** (wrap in a QueryClientProvider):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const api = {
  login: vi.fn(),
  verifyTwoFactor: vi.fn(),
  getUserProfile: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}
vi.mock('./authApi', () => api)

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => Object.values(api).forEach((m) => m.mockReset()))

describe('useLogin', () => {
  it('exposes a mutation that calls authApi.login', async () => {
    api.login.mockResolvedValue({ status: 'OK' })
    const { useLogin } = await import('./authQueries')
    const { result } = renderHook(() => useLogin(), { wrapper })
    result.current.mutate({ email: 'a@b.com', password: 'p', captcha: 'c' })
    await waitFor(() => expect(api.login).toHaveBeenCalledWith('a@b.com', 'p', 'c'))
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `src/features/auth/api/authQueries.ts`:

```ts
import { useMutation, useQuery } from '@tanstack/react-query'
import * as authApi from './authApi'

export function useLogin() {
  return useMutation({
    mutationFn: (v: { email: string; password: string; captcha: string }) =>
      authApi.login(v.email, v.password, v.captcha),
  })
}

export function useVerifyTwoFactor() {
  return useMutation({
    mutationFn: (v: { email: string; code: string }) => authApi.verifyTwoFactor(v.email, v.code),
  })
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (v: { email: string; captcha: string }) =>
      authApi.requestPasswordReset(v.email, v.captcha),
  })
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: (v: { password: string; token: string; captcha: string }) =>
      authApi.confirmPasswordReset(v.password, v.token, v.captcha),
  })
}

export function useUserProfile(enabled: boolean) {
  return useQuery({ queryKey: ['userProfile'], queryFn: authApi.getUserProfile, enabled })
}
```

- [ ] **Step 4: Run it, verify PASS.**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(auth): tanstack query hooks for auth flows"
```

---

## Task 8: Login form

Handles the login mutation, status branching, token storage, session gate, profile fetch, and landing.

**Files:** Create `src/features/auth/components/LoginForm.tsx`. Test `src/features/auth/components/LoginForm.test.tsx`.

- [ ] **Step 1: Write the failing test** (mock the query hooks, captcha, router navigate, stores):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutateAsync = vi.fn()
const navigate = vi.fn()
vi.mock('../api/authQueries', () => ({ useLogin: () => ({ mutateAsync, isPending: false }) }))
vi.mock('../hooks/useCaptcha', () => ({
  useCaptcha: () => ({ element: null, execute: async () => 'cap', reset: vi.fn() }),
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => {
  mutateAsync.mockReset()
  navigate.mockReset()
})

describe('LoginForm', () => {
  it('validates required fields', async () => {
    const { LoginForm } = await import('./LoginForm')
    render(<LoginForm />)
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('submits credentials with a captcha token', async () => {
    mutateAsync.mockResolvedValue({
      status: 'OK',
      tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '' },
    })
    const { LoginForm } = await import('./LoginForm')
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret1')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(mutateAsync).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret1',
      captcha: 'cap',
    })
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `src/features/auth/components/LoginForm.tsx`:

```tsx
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack, FormControlLabel, Checkbox } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { useLogin } from '../api/authQueries'
import { useCaptcha } from '../hooks/useCaptcha'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'
import { useNotificationStore } from '@/state/notificationStore'
import { keepSignedIn } from '../keepSignedIn'
import { resolveLandingRoute } from '../landing'
import { getUserProfile } from '../api/authApi'
import { LOGGED_IN_STATUSES } from '../api/authTypes'
import { aseCodeToMessageKey } from '../api/aseCodes'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  keepSignedIn: z.boolean(),
})
type Values = z.infer<typeof schema>

export function LoginForm() {
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', keepSignedIn: false },
  })
  const login = useLogin()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)

  const onSubmit = async (v: Values) => {
    const token = await captcha.execute()
    const res = await login.mutateAsync({ email: v.email, password: v.password, captcha: token })

    if (res.status === 'TFA_REQUIRED' && res.tokens) {
      tokenStore.setAuthTokens(res.tokens)
      keepSignedIn.set(v.keepSignedIn)
      navigate({ to: '/account/login/check', search: { email: v.email } })
      return
    }
    if (res.code === 'ASE-001') {
      methods.setError('password', { message: 'Invalid email or password' })
      captcha.reset()
      return
    }
    if (res.status && LOGGED_IN_STATUSES.includes(res.status as never) && res.tokens) {
      tokenStore.setAuthTokens(res.tokens)
      keepSignedIn.set(v.keepSignedIn)
      useSessionStore.getState().setLoggedIn(true)
      const profile = await getUserProfile().catch(() => undefined)
      navigate({ to: resolveLandingRoute(profile) })
      return
    }
    notify({ severity: 'error', message: aseCodeToMessageKey(res.code) })
    captcha.reset()
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          <RHFTextField name="email" label="Email" type="email" autoComplete="username" />
          <RHFTextField
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
          />
          <FormControlLabel
            control={<Checkbox {...methods.register('keepSignedIn')} />}
            label="Keep me signed in"
          />
          <Button type="submit" disabled={login.isPending}>
            Sign in
          </Button>
          {captcha.element}
        </Stack>
      </Box>
    </FormProvider>
  )
}
```

- [ ] **Step 4: Run it, verify PASS.** (`npx vitest run src/features/auth/components/LoginForm.test.tsx`)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(auth): login form with status branching, token storage, landing"
```

---

## Task 9: Two-factor form

**Files:** Create `src/features/auth/components/TwoFactorForm.tsx`. Test `src/features/auth/components/TwoFactorForm.test.tsx`.

- [ ] **Step 1: Write the failing test** (mock verify hook, navigate, session store):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutateAsync = vi.fn()
const navigate = vi.fn()
vi.mock('../api/authQueries', () => ({
  useVerifyTwoFactor: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => {
  mutateAsync.mockReset()
  navigate.mockReset()
})

describe('TwoFactorForm', () => {
  it('submits the code and lands on success', async () => {
    mutateAsync.mockResolvedValue({
      status: 'OK',
      tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '' },
    })
    const { TwoFactorForm } = await import('./TwoFactorForm')
    render(<TwoFactorForm email="a@b.com" />)
    await userEvent.type(screen.getByLabelText(/code/i), '123456')
    await userEvent.click(screen.getByRole('button', { name: /verify/i }))
    expect(mutateAsync).toHaveBeenCalledWith({ email: 'a@b.com', code: '123456' })
  })

  it('shows an inline error on an invalid code', async () => {
    mutateAsync.mockResolvedValue({ code: 'ASE-XXX' })
    const { TwoFactorForm } = await import('./TwoFactorForm')
    render(<TwoFactorForm email="a@b.com" />)
    await userEvent.type(screen.getByLabelText(/code/i), '000000')
    await userEvent.click(screen.getByRole('button', { name: /verify/i }))
    expect(await screen.findByText(/invalid code/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `src/features/auth/components/TwoFactorForm.tsx`:

```tsx
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { useVerifyTwoFactor } from '../api/authQueries'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'
import { getUserProfile } from '../api/authApi'
import { resolveLandingRoute } from '../landing'

const schema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') })
type Values = z.infer<typeof schema>

export function TwoFactorForm({ email }: { email: string }) {
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: '' } })
  const verify = useVerifyTwoFactor()
  const navigate = useNavigate()

  const onSubmit = async (v: Values) => {
    const res = await verify.mutateAsync({ email, code: v.code })
    if (res.status === 'OK' && res.tokens) {
      tokenStore.setAuthTokens(res.tokens)
      useSessionStore.getState().setLoggedIn(true)
      const profile = await getUserProfile().catch(() => undefined)
      navigate({ to: resolveLandingRoute(profile) })
      return
    }
    if (res.code === 'ASE-002') {
      useSessionStore.getState().reset()
      tokenStore.clear()
      navigate({ to: '/account/login', search: { error: 'tfa_expired' } })
      return
    }
    methods.setError('code', { message: 'Invalid code' })
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 280 }}>
          <RHFTextField name="code" label="Authentication code" inputMode="numeric" autoFocus />
          <Button type="submit" disabled={verify.isPending}>
            Verify
          </Button>
        </Stack>
      </Box>
    </FormProvider>
  )
}
```

- [ ] **Step 4: Run it, verify PASS.**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(auth): two-factor verification form"
```

---

## Task 10: Password reset forms

**Files:** Create `src/features/auth/components/PasswordResetRequestForm.tsx`, `PasswordResetConfirmForm.tsx`. Tests for each.

- [ ] **Step 1: Write the failing test for the request form** `PasswordResetRequestForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutateAsync = vi.fn()
const navigate = vi.fn()
vi.mock('../api/authQueries', () => ({
  useRequestPasswordReset: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('../hooks/useCaptcha', () => ({
  useCaptcha: () => ({ element: null, execute: async () => 'cap', reset: vi.fn() }),
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => {
  mutateAsync.mockReset()
  navigate.mockReset()
})

describe('PasswordResetRequestForm', () => {
  it('requests a reset and advances to the sent screen', async () => {
    mutateAsync.mockResolvedValue(true)
    const { PasswordResetRequestForm } = await import('./PasswordResetRequestForm')
    render(<PasswordResetRequestForm />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: /reset|send/i }))
    expect(mutateAsync).toHaveBeenCalledWith({ email: 'a@b.com', captcha: 'cap' })
    expect(navigate).toHaveBeenCalledWith({
      to: '/account/reset/sent',
      search: { email: 'a@b.com' },
    })
  })
})
```

- [ ] **Step 2: Run it, verify FAIL.**

- [ ] **Step 3: Implement** `PasswordResetRequestForm.tsx`:

```tsx
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { useRequestPasswordReset } from '../api/authQueries'
import { useCaptcha } from '../hooks/useCaptcha'
import { useNotificationStore } from '@/state/notificationStore'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
})
type Values = z.infer<typeof schema>

export function PasswordResetRequestForm() {
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })
  const request = useRequestPasswordReset()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)

  const onSubmit = async (v: Values) => {
    const token = await captcha.execute()
    const ok = await request.mutateAsync({ email: v.email, captcha: token })
    if (ok) navigate({ to: '/account/reset/sent', search: { email: v.email } })
    else {
      notify({ severity: 'error', message: 'auth.error.resetFailed' })
      captcha.reset()
    }
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          <RHFTextField name="email" label="Email" type="email" />
          <Button type="submit" disabled={request.isPending}>
            Send reset link
          </Button>
          {captcha.element}
        </Stack>
      </Box>
    </FormProvider>
  )
}
```

- [ ] **Step 4: Run it, verify PASS.**

- [ ] **Step 5: Write the failing test for the confirm form** `PasswordResetConfirmForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mutateAsync = vi.fn()
const navigate = vi.fn()
vi.mock('../api/authQueries', () => ({
  useConfirmPasswordReset: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('../hooks/useCaptcha', () => ({
  useCaptcha: () => ({ element: null, execute: async () => 'cap', reset: vi.fn() }),
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => {
  mutateAsync.mockReset()
  navigate.mockReset()
})

describe('PasswordResetConfirmForm', () => {
  it('submits the new password with the token and advances to done', async () => {
    mutateAsync.mockResolvedValue(true)
    const { PasswordResetConfirmForm } = await import('./PasswordResetConfirmForm')
    render(<PasswordResetConfirmForm token="reset-tok" />)
    await userEvent.type(screen.getByLabelText(/new password/i), 'NewPass123')
    await userEvent.click(screen.getByRole('button', { name: /set|save|reset/i }))
    expect(mutateAsync).toHaveBeenCalledWith({
      password: 'NewPass123',
      token: 'reset-tok',
      captcha: 'cap',
    })
    expect(navigate).toHaveBeenCalledWith({ to: '/account/reset/done' })
  })
})
```

Run -> FAIL.

- [ ] **Step 6: Implement** `PasswordResetConfirmForm.tsx`:

```tsx
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { useConfirmPasswordReset } from '../api/authQueries'
import { useCaptcha } from '../hooks/useCaptcha'
import { useNotificationStore } from '@/state/notificationStore'

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type Values = z.infer<typeof schema>

export function PasswordResetConfirmForm({ token }: { token: string }) {
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '' },
  })
  const confirm = useConfirmPasswordReset()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)

  const onSubmit = async (v: Values) => {
    const captchaToken = await captcha.execute()
    const ok = await confirm.mutateAsync({ password: v.password, token, captcha: captchaToken })
    if (ok) navigate({ to: '/account/reset/done' })
    else {
      notify({ severity: 'error', message: 'auth.error.resetFailed' })
      captcha.reset()
    }
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          <RHFTextField
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
          />
          <Button type="submit" disabled={confirm.isPending}>
            Set new password
          </Button>
          {captcha.element}
        </Stack>
      </Box>
    </FormProvider>
  )
}
```

Run -> PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(auth): password reset request and confirm forms"
```

---

## Task 11: Routes, inactivity wiring, remove dev sign-in

**Files:** Create `src/features/auth/routes/*.tsx`. Modify `src/router/router.tsx`, `src/router/routes/public.tsx` (remove throwaway), `src/App.tsx` (mount inactivity watcher). Test: extend `src/router/authGuard.test.tsx` if useful.

- [ ] **Step 1: Implement the route modules.** Each wraps a feature component under the root route. `login.tsx`:

```tsx
import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { LoginForm } from '@/features/auth/components/LoginForm'

export const LoginRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/login',
  validateSearch: (s: Record<string, unknown>) => ({
    error: typeof s.error === 'string' ? s.error : undefined,
  }),
  component: LoginForm,
})
```

`twoFactor.tsx` (reads `email` from search):

```tsx
import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { TwoFactorForm } from '@/features/auth/components/TwoFactorForm'

export const TwoFactorRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/login/check',
  validateSearch: (s: Record<string, unknown>) => ({ email: String(s.email ?? '') }),
  component: function TwoFactorScreen() {
    const { email } = TwoFactorRoute.useSearch()
    return <TwoFactorForm email={email} />
  },
})
```

`resetRequest.tsx` → `PasswordResetRequestForm`; `resetSent.tsx` → a static "check your email" screen reading `email` from search; `resetConfirm.tsx` reads `token` from search and renders `PasswordResetConfirmForm token={token}`; `resetDone.tsx` → static success with a link to `/account/login`. Follow the same `createRoute` pattern with `validateSearch` where a value is read.

- [ ] **Step 2: Remove the throwaway dev sign-in.** In `src/router/routes/public.tsx`, delete the `LoginRoute` dev component (the new one lives in the feature). Keep `IndexRoute` (redirect `/` → `/account/login`). Update `src/router/router.tsx` to import the feature route modules and assemble them:

```tsx
import { createRouter } from '@tanstack/react-router'
import { Route as RootRoute } from './routes/__root'
import { IndexRoute } from './routes/public'
import { AuthenticatedRoute } from './routes/authenticated'
import { HelloRoute } from './routes/hello'
import { LoginRoute } from '@/features/auth/routes/login'
import { TwoFactorRoute } from '@/features/auth/routes/twoFactor'
import { ResetRequestRoute } from '@/features/auth/routes/resetRequest'
import { ResetSentRoute } from '@/features/auth/routes/resetSent'
import { ResetConfirmRoute } from '@/features/auth/routes/resetConfirm'
import { ResetDoneRoute } from '@/features/auth/routes/resetDone'

const routeTree = RootRoute.addChildren([
  IndexRoute,
  LoginRoute,
  TwoFactorRoute,
  ResetRequestRoute,
  ResetSentRoute,
  ResetConfirmRoute,
  ResetDoneRoute,
  AuthenticatedRoute.addChildren([HelloRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/router-core' {
  interface Register {
    router: typeof router
  }
}
```

- [ ] **Step 3: Mount the inactivity watcher.** Add a small component that runs the hook using the profile + keep-signed-in flag, rendered inside the authenticated layout (or App when logged in). Example `src/features/auth/SessionGuard.tsx`:

```tsx
import { useNavigate } from '@tanstack/react-router'
import { useConfig } from '@/config/ConfigProvider'
import { useSessionStore } from '@/state/sessionStore'
import { useUserProfile } from './api/authQueries'
import { useInactivityTimeout } from './hooks/useInactivityTimeout'
import { keepSignedIn } from './keepSignedIn'
import { tokenStore } from '@/api/tokenStore'

export function SessionGuard() {
  const loggedIn = useSessionStore((s) => s.loggedIn)
  const config = useConfig()
  const navigate = useNavigate()
  const { data: profile } = useUserProfile(loggedIn)
  const minutes = Number(
    profile?.additionalAttributes?.inactivityTimeout ?? config.LOGOUT_AFTER_MIN
  )

  useInactivityTimeout({
    minutes,
    enabled: loggedIn && !keepSignedIn.get(),
    onTimeout: () => {
      tokenStore.clear()
      useSessionStore.getState().reset()
      navigate({ to: '/account/login' })
    },
  })
  return null
}
```

Render `<SessionGuard />` inside the router tree (e.g. in `__root` component alongside `<Outlet />`).

- [ ] **Step 4: Verify build/lint/test**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null
npm run build && npm run lint && npm run test
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(auth): wire auth routes, session guard, remove dev sign-in"
```

---

## Task 12: Playwright e2e

Component tests mock the query hooks directly (Tasks 8 to 10), so no MSW is needed. The e2e drives the real UI against intercepted network responses.

**Files:** Create `e2e/auth.spec.ts`.

- [ ] **Step 1: Add the Playwright auth spec** `e2e/auth.spec.ts` (intercept `/auth/*` so no real backend is needed):

```ts
import { test, expect } from '@playwright/test'

test('login with 2FA reaches the landing screen', async ({ page }) => {
  await page.route('**/auth/login', (route) =>
    route.fulfill({
      json: {
        status: 'TFA_REQUIRED',
        tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' },
      },
    })
  )
  await page.route('**/auth/tfa', (route) =>
    route.fulfill({
      json: {
        status: 'OK',
        tokens: { accessToken: 'a2', refreshToken: 'r2', refreshTokenValidUntil: '2030' },
      },
    })
  )
  await page.route('**/nsdata', (route) =>
    route.fulfill({
      json: {
        id: 1,
        session_id: 's',
        token: 't',
        payload: [
          {
            module: 'profile',
            action: 'get_user',
            status: 'OK',
            result: { id: 1, email: 'a@b.com', additionalAttributes: {} },
          },
        ],
      },
    })
  )

  await page.goto('/account/login')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByLabel(/password/i).fill('secret1')
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/\/account\/login\/check/)
  await page.getByLabel(/code/i).fill('123456')
  await page.getByRole('button', { name: /verify/i }).click()

  await expect(page.getByText('Hello, Portal 3.0')).toBeVisible()
})
```

Note: hCaptcha is invisible and has no site key in `.env.development` unless set; with no key, `useCaptcha().execute()` resolves to `''` (Task 6), so the e2e does not need to solve a captcha. Confirm `.env.development` leaves `VITE_HCAPTCHA_KEY` empty (or unset) for the e2e run.

- [ ] **Step 2: Run the e2e**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null
npm run e2e
```

Expected: the auth flow test passes. Update or remove the old dev-sign-in `e2e/smoke.spec.ts` since that route is gone.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test(auth): Playwright login+2FA e2e"
```

---

## Task 13: Security/compliance gate and final verification

- [ ] **Step 1: Full verification**

```bash
source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null
npm run lint && npm run test && npm run build && npm run e2e
```

- [ ] **Step 2: Security/compliance review** of `src/features/auth/*` and `src/api/client.ts`. Checklist:
- No password or token value is logged (console or Sentry); captcha tokens not retained.
- `tokenStore` is the only writer of tokens; inactivity logout and `ASE-002` both fully clear tokens + reset the session.
- The reset token is read from the URL and not persisted.
- `keepSignedIn` correctly disables the inactivity watcher and nothing else weakens session security.
- No secret committed (hCaptcha site key is public).
  Resolve any blockers before sign-off.

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Confirm definition of done** against the spec (login, 2FA, reset, inactivity, captcha, dev sign-in removed, all suites green, review complete).

---

## Notes for the implementer

- **Exact profile endpoint:** the plan uses TFBO `profile.get_user` (verified in legacy `api.ts`). If the new backend differs, adjust `getUserProfile` only.
- **i18n keys:** the `auth.error.*` and form label strings should be added to `public/locales/en/common.json` (or a new `account` namespace) as you build each screen; keep them real, not placeholders.
- **Search-param typing:** TanStack Router v1 `validateSearch` is used to type `email`/`token`/`error`. Adjust to the installed API if needed.
- **Old smoke test:** Task 11 removes the dev sign-in; update or delete `e2e/smoke.spec.ts` accordingly so the suite stays green.

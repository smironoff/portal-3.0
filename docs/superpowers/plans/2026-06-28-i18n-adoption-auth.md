# i18n Adoption — Conventions + Auth Reference Migration (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the i18n conventions (per-feature namespaces, typed keys, the `useTranslation` + schema-factory pattern, scoped lint enforcement, a legacy-harvest mechanism) and migrate the auth vertical as the reference, translated across all 17 legacy languages.

**Architecture:** Auth copy lives in a new `auth` i18n namespace (`public/locales/<lang>/auth.json`); `common` already exists. The canonical English file is authored by hand; a dev-only harvest script fills the other 16 languages from the legacy portal-2.0 corpus by matching English source text. react-i18next is type-augmented from the English JSON. Auth components render via `t()` with validation built through a `(t) => schema` factory. Tests get a synchronous in-memory i18n init so existing English assertions keep passing.

**Tech Stack:** React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), i18next + react-i18next (already configured), Vitest + Testing Library, Playwright, eslint (flat config).

## Global Constraints

- **Node 20.** Windows host; use plain `npm`/`npx` (no nvm prefix).
- **Arrow functions only** (no `function` declarations).
- **British English** source copy. Preserve the EXACT existing English wording when migrating (so assertions and e2e selectors keep matching). No em or en dashes anywhere.
- **No emojis.** Formal, professional copy.
- **Typed keys:** every `t()` call must type-check; tsc fails on unknown keys.
- **Scope:** auth vertical only. Do NOT migrate onboarding/registration/dashboard/emailVerification, and do NOT modify the shared `aseCodes.ts` notification-key strings (see Task 1 note). Do NOT build a notification renderer.
- **`git add <specific files>` only**; one commit per task; verify lint + tsc + the task's tests before each commit.
- Per-task verification gate: `npm run lint && npx tsc -p tsconfig.json --noEmit` clean, plus the task's vitest/playwright run green. The repo has a global `testTimeout: 30000` in `vite.config.ts`; run vitest plain (no override).

---

### Task 1: English `auth` namespace + i18n config

**Files:**
- Create: `public/locales/en/auth.json`
- Modify: `src/i18n/i18n.ts:14` (`ns` list)
- Modify: `tsconfig.app.json` (add `resolveJsonModule`)

**Interfaces:**
- Produces: the `auth` namespace key inventory consumed by every later task. Keys are referenced as `t('login.signIn')` etc. under `useTranslation('auth')`.

- [ ] **Step 1: Create `public/locales/en/auth.json`** with the exact existing English copy:

```json
{
  "login": {
    "email": "Email",
    "password": "Password",
    "signIn": "Sign in",
    "keepSignedIn": "Keep me signed in",
    "invalidCredentials": "Invalid email or password"
  },
  "twoFactor": {
    "code": "Authentication code",
    "verify": "Verify",
    "invalidCode": "Invalid code",
    "verificationFailed": "Verification failed, please try again"
  },
  "reset": {
    "request": {
      "email": "Email",
      "submit": "Send reset link"
    },
    "confirm": {
      "password": "New password",
      "submit": "Set new password"
    },
    "sent": {
      "title": "Check your email",
      "body": "We have sent a password reset link to <1>{{email}}</1>. Please check your inbox and follow the instructions to reset your password.",
      "backToLogin": "Back to login"
    },
    "done": {
      "title": "Password reset successfully",
      "body": "Your password has been reset. You may now sign in with your new credentials.",
      "backToLogin": "Back to login"
    }
  },
  "validation": {
    "emailRequired": "Email is required",
    "emailInvalid": "Enter a valid email",
    "passwordRequired": "Password is required",
    "passwordMinLength": "Password must be at least 8 characters",
    "codeFormat": "Enter the 6-digit code"
  },
  "errors": {
    "invalidCredentials": "Invalid email or password",
    "generic": "Something went wrong. Please try again.",
    "resetFailed": "We could not process your request. Please try again.",
    "tfaExpired": "Your verification code has expired. Please sign in again.",
    "missingFields": "Some required information is missing.",
    "userNotFound": "We could not find an account for that email.",
    "alreadyRegistered": "An account already exists for that email.",
    "syncFailed": "We could not complete your request. Please try again."
  }
}
```

Note: `errors.*` exists so the corpus is complete and harvestable, but `aseCodes.ts` and the form `notify()` strings are NOT changed in this slice (they push to a store with no renderer; wiring them through `t()` belongs to the future notification-renderer slice). Leaving them avoids touching registration, which shares `aseCodes.ts`.

- [ ] **Step 2: Add the namespace to the loader.** In `src/i18n/i18n.ts:14` change:
```ts
      ns: ['common'],
```
to:
```ts
      ns: ['common', 'auth'],
```

- [ ] **Step 3: Enable JSON imports for the typed-keys file (Task 2).** In `tsconfig.app.json`, inside `compilerOptions`, add:
```json
    "resolveJsonModule": true,
```
(Place it alongside the other bundler-mode options.)

- [ ] **Step 4: Verify** — `npx tsc -p tsconfig.json --noEmit && npm run lint` (clean). The JSON is well-formed.

- [ ] **Step 5: Commit**
```bash
git add public/locales/en/auth.json src/i18n/i18n.ts tsconfig.app.json
git commit -m "feat(i18n): english auth namespace + register ns + resolveJsonModule"
```

---

### Task 2: Typed keys (react-i18next augmentation)

**Files:**
- Create: `src/i18n/resources.d.ts`

**Interfaces:**
- Consumes: `public/locales/en/common.json`, `public/locales/en/auth.json`.
- Produces: compile-time typing so `t('login.signIn')` (ns `auth`) and `common` keys are checked.

- [ ] **Step 1: Create `src/i18n/resources.d.ts`:**
```ts
import 'i18next'
import type common from '../../public/locales/en/common.json'
import type auth from '../../public/locales/en/auth.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof common
      auth: typeof auth
    }
  }
}
```

- [ ] **Step 2: Verify the augmentation compiles** — `npx tsc -p tsconfig.json --noEmit` (clean).

- [ ] **Step 3: Verify it actually rejects unknown keys.** Temporarily append to `src/i18n/resources.d.ts` a scratch check in a new file `src/i18n/_typecheck.ts`:
```ts
import i18n from 'i18next'
// @ts-expect-error unknown key must be rejected by the augmentation
i18n.t('auth:login.thisKeyDoesNotExist')
```
Run `npx tsc -p tsconfig.json --noEmit`. Expected: PASS (the `@ts-expect-error` is satisfied because the key is indeed invalid). If tsc instead errors that the `@ts-expect-error` is unused, the augmentation is not effective — fix it before proceeding. Then DELETE `src/i18n/_typecheck.ts`.

- [ ] **Step 4: Verify** — `npx tsc -p tsconfig.json --noEmit && npm run lint` clean (with `_typecheck.ts` deleted).

- [ ] **Step 5: Commit**
```bash
git add src/i18n/resources.d.ts
git commit -m "feat(i18n): type-safe translation keys via react-i18next augmentation"
```

---

### Task 3: Initialise i18n in the test setup

**Files:**
- Modify: `src/test/setup.ts`

**Interfaces:**
- Produces: a synchronously-initialised global i18n instance with English `common` + `auth` resources, so `useTranslation()` returns real English in unit tests with no provider wrapping.

- [ ] **Step 1: Replace `src/test/setup.ts`** with:
```ts
import '@testing-library/jest-dom/vitest'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from '../../public/locales/en/common.json'
import auth from '../../public/locales/en/auth.json'

// Synchronous, in-memory i18n for tests: useTranslation() resolves real English
// without the HTTP backend or a provider, so existing English assertions hold.
void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'auth'],
  defaultNS: 'common',
  resources: { en: { common, auth } },
  interpolation: { escapeValue: false },
})
```

- [ ] **Step 2: Verify no regression** — run the full suite (no auth components migrated yet, so everything must still pass): `npx vitest run`. Expected: all files pass (185 tests).

- [ ] **Step 3: Verify** — `npx tsc -p tsconfig.json --noEmit && npm run lint` clean.

- [ ] **Step 4: Commit**
```bash
git add src/test/setup.ts
git commit -m "test(i18n): initialise in-memory i18n in the vitest setup"
```

---

### Task 4: Migrate `LoginForm` (reference pattern)

**Files:**
- Modify: `src/features/auth/components/LoginForm.tsx`
- Test: `src/features/auth/components/LoginForm.test.tsx` (should keep passing unchanged)

**Interfaces:**
- Consumes: `useTranslation` from `react-i18next`; `TFunction` from `i18next`; the `auth` namespace keys.
- Produces: the canonical `(t) => schema` validation pattern reused by Tasks 5-6.

- [ ] **Step 1: Confirm the existing test passes pre-migration** — `npx vitest run src/features/auth/components/LoginForm.test.tsx` (green). It asserts `/email is required/i`, `/sign in/i`, `/email/i`, `/password/i` — all of which the migrated English must preserve.

- [ ] **Step 2: Migrate `LoginForm.tsx`.** Replace the hardcoded literals and inline schema with the namespace + factory pattern. Full file:
```tsx
import { useMemo } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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

const makeSchema = (t: TFunction<'auth'>) =>
  z.object({
    email: z.string().min(1, t('validation.emailRequired')).email(t('validation.emailInvalid')),
    password: z.string().min(1, t('validation.passwordRequired')),
    keepSignedIn: z.boolean(),
  })
type Values = z.infer<ReturnType<typeof makeSchema>>

export const LoginForm = () => {
  const { t } = useTranslation('auth')
  const schema = useMemo(() => makeSchema(t), [t])
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', keepSignedIn: false },
  })
  const login = useLogin()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)

  const onSubmit = async (v: Values) => {
    try {
      const token = await captcha.execute()
      const res = await login.mutateAsync({ email: v.email, password: v.password, captcha: token })

      if (res.status === 'TFA_REQUIRED' && res.tokens) {
        tokenStore.setAuthTokens(res.tokens)
        keepSignedIn.set(v.keepSignedIn)
        navigate({ to: '/account/login/check', search: { email: v.email } })
        return
      }
      if (res.code === 'ASE-001') {
        methods.setError('password', { message: t('login.invalidCredentials') })
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
    } catch {
      notify({ severity: 'error', message: 'auth.error.generic' })
      captcha.reset()
    }
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          <RHFTextField name="email" label={t('login.email')} type="email" autoComplete="username" />
          <RHFTextField
            name="password"
            label={t('login.password')}
            type="password"
            autoComplete="current-password"
          />
          <FormControlLabel
            control={<Checkbox {...methods.register('keepSignedIn')} />}
            label={t('login.keepSignedIn')}
          />
          <Button type="submit" disabled={login.isPending}>
            {t('login.signIn')}
          </Button>
          {captcha.element}
        </Stack>
      </Box>
    </FormProvider>
  )
}
```
(Leave the `notify(...)` message strings exactly as they were — they are out of scope per Task 1's note.)

- [ ] **Step 3: Run the test, verify it still PASSES** — `npx vitest run src/features/auth/components/LoginForm.test.tsx`. The English from `auth.json` matches the assertions.

- [ ] **Step 4: Verify** — `npx tsc -p tsconfig.json --noEmit && npm run lint` clean (typed keys check every `t()`).

- [ ] **Step 5: Commit**
```bash
git add src/features/auth/components/LoginForm.tsx
git commit -m "feat(i18n): migrate LoginForm to t() with (t)=>schema validation"
```

---

### Task 5: Migrate `TwoFactorForm`

**Files:**
- Modify: `src/features/auth/components/TwoFactorForm.tsx`
- Test: `src/features/auth/components/TwoFactorForm.test.tsx` (keep passing)

- [ ] **Step 1: Confirm the existing test passes** — `npx vitest run src/features/auth/components/TwoFactorForm.test.tsx`.

- [ ] **Step 2: Migrate `TwoFactorForm.tsx`.** Full file:
```tsx
import { useMemo } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { useVerifyTwoFactor } from '../api/authQueries'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'
import { getUserProfile } from '../api/authApi'
import { resolveLandingRoute } from '../landing'

const makeSchema = (t: TFunction<'auth'>) =>
  z.object({ code: z.string().regex(/^\d{6}$/, t('validation.codeFormat')) })
type Values = z.infer<ReturnType<typeof makeSchema>>

export const TwoFactorForm = ({ email }: { email: string }) => {
  const { t } = useTranslation('auth')
  const schema = useMemo(() => makeSchema(t), [t])
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: '' } })
  const verify = useVerifyTwoFactor()
  const navigate = useNavigate()

  const onSubmit = async (v: Values) => {
    try {
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
      methods.setError('code', { message: t('twoFactor.invalidCode') })
    } catch {
      methods.setError('code', { message: t('twoFactor.verificationFailed') })
    }
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 280 }}>
          <RHFTextField name="code" label={t('twoFactor.code')} inputMode="numeric" autoFocus />
          <Button type="submit" disabled={verify.isPending}>
            {t('twoFactor.verify')}
          </Button>
        </Stack>
      </Box>
    </FormProvider>
  )
}
```

- [ ] **Step 3: Run the test, verify PASS** — `npx vitest run src/features/auth/components/TwoFactorForm.test.tsx`. (If the existing test asserts the old label "Authentication code" or button "Verify", the preserved English matches.)

- [ ] **Step 4: Verify** — tsc + lint clean.

- [ ] **Step 5: Commit**
```bash
git add src/features/auth/components/TwoFactorForm.tsx
git commit -m "feat(i18n): migrate TwoFactorForm to t()"
```

---

### Task 6: Migrate the two password-reset forms

**Files:**
- Modify: `src/features/auth/components/PasswordResetRequestForm.tsx`, `src/features/auth/components/PasswordResetConfirmForm.tsx`
- Tests: `PasswordResetRequestForm.test.tsx`, `PasswordResetConfirmForm.test.tsx` (keep passing)

- [ ] **Step 1: Confirm both tests pass pre-migration** — `npx vitest run src/features/auth/components/PasswordResetRequestForm.test.tsx src/features/auth/components/PasswordResetConfirmForm.test.tsx`.

- [ ] **Step 2: Migrate `PasswordResetRequestForm.tsx`.** Full file:
```tsx
import { useMemo } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { useRequestPasswordReset } from '../api/authQueries'
import { useCaptcha } from '../hooks/useCaptcha'
import { useNotificationStore } from '@/state/notificationStore'

const makeSchema = (t: TFunction<'auth'>) =>
  z.object({ email: z.string().min(1, t('validation.emailRequired')).email(t('validation.emailInvalid')) })
type Values = z.infer<ReturnType<typeof makeSchema>>

export const PasswordResetRequestForm = () => {
  const { t } = useTranslation('auth')
  const schema = useMemo(() => makeSchema(t), [t])
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })
  const request = useRequestPasswordReset()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)

  const onSubmit = async (v: Values) => {
    try {
      const token = await captcha.execute()
      const ok = await request.mutateAsync({ email: v.email, captcha: token })
      if (ok) navigate({ to: '/account/reset/sent', search: { email: v.email } })
      else {
        notify({ severity: 'error', message: 'auth.error.resetFailed' })
        captcha.reset()
      }
    } catch {
      notify({ severity: 'error', message: 'auth.error.resetFailed' })
      captcha.reset()
    }
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          <RHFTextField name="email" label={t('reset.request.email')} type="email" />
          <Button type="submit" disabled={request.isPending}>
            {t('reset.request.submit')}
          </Button>
          {captcha.element}
        </Stack>
      </Box>
    </FormProvider>
  )
}
```

- [ ] **Step 3: Migrate `PasswordResetConfirmForm.tsx`.** Full file:
```tsx
import { useMemo } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { useConfirmPasswordReset } from '../api/authQueries'
import { useCaptcha } from '../hooks/useCaptcha'
import { useNotificationStore } from '@/state/notificationStore'

const makeSchema = (t: TFunction<'auth'>) =>
  z.object({ password: z.string().min(8, t('validation.passwordMinLength')) })
type Values = z.infer<ReturnType<typeof makeSchema>>

export const PasswordResetConfirmForm = ({ token }: { token: string }) => {
  const { t } = useTranslation('auth')
  const schema = useMemo(() => makeSchema(t), [t])
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '' } })
  const confirm = useConfirmPasswordReset()
  const captcha = useCaptcha()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)

  const onSubmit = async (v: Values) => {
    try {
      const captchaToken = await captcha.execute()
      const ok = await confirm.mutateAsync({ password: v.password, token, captcha: captchaToken })
      if (ok) navigate({ to: '/account/reset/done' })
      else {
        notify({ severity: 'error', message: 'auth.error.resetFailed' })
        captcha.reset()
      }
    } catch {
      notify({ severity: 'error', message: 'auth.error.resetFailed' })
      captcha.reset()
    }
  }

  return (
    <FormProvider {...methods}>
      <Box component="form" onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          <RHFTextField name="password" label={t('reset.confirm.password')} type="password" autoComplete="new-password" />
          <Button type="submit" disabled={confirm.isPending}>
            {t('reset.confirm.submit')}
          </Button>
          {captcha.element}
        </Stack>
      </Box>
    </FormProvider>
  )
}
```

- [ ] **Step 4: Run both tests, verify PASS** — `npx vitest run src/features/auth/components/PasswordResetRequestForm.test.tsx src/features/auth/components/PasswordResetConfirmForm.test.tsx`.

- [ ] **Step 5: Verify** — tsc + lint clean.

- [ ] **Step 6: Commit**
```bash
git add src/features/auth/components/PasswordResetRequestForm.tsx src/features/auth/components/PasswordResetConfirmForm.tsx
git commit -m "feat(i18n): migrate password-reset request/confirm forms to t()"
```

---

### Task 7: Migrate the reset screens (copy)

**Files:**
- Modify: `src/features/auth/routes/resetSent.tsx`, `src/features/auth/routes/resetDone.tsx`
- Create: `src/features/auth/routes/resetSent.test.tsx`, `src/features/auth/routes/resetDone.test.tsx`

The `login`, `twoFactor`, `resetRequest`, and `resetConfirm` route files contain no user-facing copy (they only wire forms) — leave them unchanged. Only `resetSent` and `resetDone` have inline copy. The `reset.sent.body` key uses a `<1>{{email}}</1>` placeholder rendered via the `<Trans>` component to preserve the bold email.

- [ ] **Step 1: Write failing render tests.** Create `src/features/auth/routes/resetSent.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return { ...actual, Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }
})

describe('ResetSentScreen', () => {
  it('renders the check-your-email copy with the address', async () => {
    const mod = await import('./resetSent')
    const Screen = mod.ResetSentRoute.options.component as () => React.ReactElement
    // stub the route search to supply the email
    vi.spyOn(mod.ResetSentRoute, 'useSearch').mockReturnValue({ email: 'a@b.com' } as never)
    render(<Screen />)
    expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    expect(screen.getByText(/a@b.com/)).toBeInTheDocument()
    expect(screen.getByText(/back to login/i)).toBeInTheDocument()
  })
})
```
Create `src/features/auth/routes/resetDone.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return { ...actual, Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }
})

describe('ResetDoneScreen', () => {
  it('renders the success copy', async () => {
    const mod = await import('./resetDone')
    const Screen = mod.ResetDoneRoute.options.component as () => React.ReactElement
    render(<Screen />)
    expect(screen.getByRole('heading', { name: /password reset successfully/i })).toBeInTheDocument()
    expect(screen.getByText(/back to login/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them, verify they FAIL** (current screens use a non-exported component; the tests reference `ResetSentRoute.options.component`). `npx vitest run src/features/auth/routes/resetSent.test.tsx src/features/auth/routes/resetDone.test.tsx`. If the screens render but assertions about copy already pass (copy unchanged), the tests may pass immediately — that is acceptable; the point is they exercise the migrated screens. If they error on `useSearch` mock, adjust the mock to the real API shape (do not weaken the copy assertions).

- [ ] **Step 3: Migrate `resetSent.tsx`.** Full file:
```tsx
import { createRoute, Link } from '@tanstack/react-router'
import { Trans, useTranslation } from 'react-i18next'
import { Route as RootRoute } from '@/router/routes/__root'
import { Box, Typography } from '@mui/material'

// eslint-disable-next-line react-refresh/only-export-components
const ResetSentScreen = () => {
  const { t } = useTranslation('auth')
  const { email } = ResetSentRoute.useSearch()
  return (
    <Box sx={{ maxWidth: 400 }}>
      <Typography variant="h5" gutterBottom>
        {t('reset.sent.title')}
      </Typography>
      <Typography>
        <Trans i18nKey="reset.sent.body" t={t} values={{ email }} components={{ 1: <strong /> }} />
      </Typography>
      <Typography sx={{ mt: 2 }}>
        <Link to="/account/login" search={{ error: undefined }}>{t('reset.sent.backToLogin')}</Link>
      </Typography>
    </Box>
  )
}

export const ResetSentRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/reset/sent',
  validateSearch: (s: Record<string, unknown>) => ({ email: String(s.email ?? '') }),
  component: ResetSentScreen,
})
```

- [ ] **Step 4: Migrate `resetDone.tsx`.** Full file:
```tsx
import { createRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Route as RootRoute } from '@/router/routes/__root'
import { Box, Typography } from '@mui/material'

// eslint-disable-next-line react-refresh/only-export-components
const ResetDoneScreen = () => {
  const { t } = useTranslation('auth')
  return (
    <Box sx={{ maxWidth: 400 }}>
      <Typography variant="h5" gutterBottom>
        {t('reset.done.title')}
      </Typography>
      <Typography>{t('reset.done.body')}</Typography>
      <Typography sx={{ mt: 2 }}>
        <Link to="/account/login" search={{ error: undefined }}>{t('reset.done.backToLogin')}</Link>
      </Typography>
    </Box>
  )
}

export const ResetDoneRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/reset/done',
  component: ResetDoneScreen,
})
```

- [ ] **Step 5: Run the tests, verify PASS.** If the `ResetSentRoute.options.component`/`useSearch` access pattern proves awkward in the test environment, simplify the test to import and render the screen component another way (e.g. export the screen component for testing) WITHOUT weakening the three copy assertions. Keep both tests green.

- [ ] **Step 6: Verify** — tsc + lint clean.

- [ ] **Step 7: Commit**
```bash
git add src/features/auth/routes/resetSent.tsx src/features/auth/routes/resetDone.tsx src/features/auth/routes/resetSent.test.tsx src/features/auth/routes/resetDone.test.tsx
git commit -m "feat(i18n): migrate reset-sent/reset-done screens to t()"
```

---

### Task 8: Harvest legacy translations for 16 languages

**Files:**
- Create: `scripts/i18n-harvest.mjs`
- Create (generated): `public/locales/<lang>/auth.json` for the 16 non-English languages
- Create/Modify (generated): `public/locales/<lang>/common.json` for the 16 languages (copy the existing English `common.json` content as a baseline if no match, so the namespace loads in every language)

**Interfaces:**
- Produces: per-language `auth.json` files harvested from legacy by English-source match.

- [ ] **Step 1: Create `scripts/i18n-harvest.mjs`** (dev-only Node ESM; not imported by the app):
```js
// Harvest legacy portal-2.0 translations into portal-3.0 by matching English source text.
// Usage: node scripts/i18n-harvest.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LEGACY = 'C:/Work/ThinkMarkets/portal-2.0/public/locales'
const LANGS = ['ar','cs','de','el','es','id','it','ja','ms-MY','pl','pt-BR','th','tr','vi','zh-Hans','zh-Hant']
const NS = ['auth', 'common']

const flatten = (obj, prefix, out) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else if (typeof v === 'string') out[key] = v
  }
  return out
}

// Build, per language, an index: englishValue -> translatedValue (first match wins).
const enIndexByLang = {}
const enLegacy = {}
for (const file of readdirSync(join(LEGACY, 'en'))) {
  if (!file.endsWith('.json')) continue
  flatten(JSON.parse(readFileSync(join(LEGACY, 'en', file), 'utf8')), '', enLegacy)
}
// enLegacy: legacyKeyPath -> englishValue. Invert to englishValue -> legacyKeyPath.
const keyByEnglish = {}
for (const [kp, val] of Object.entries(enLegacy)) if (!(val in keyByEnglish)) keyByEnglish[val] = kp

for (const lang of LANGS) {
  const langFlat = {}
  const dir = join(LEGACY, lang)
  if (!existsSync(dir)) continue
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    flatten(JSON.parse(readFileSync(join(dir, file), 'utf8')), '', langFlat)
  }
  // englishValue -> translated, via the legacy key path
  const idx = {}
  for (const [eng, kp] of Object.entries(keyByEnglish)) {
    if (kp in langFlat) idx[eng] = langFlat[kp]
  }
  enIndexByLang[lang] = idx
}

const setDeep = (obj, path, value) => {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] ?? {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

const missing = {}
for (const ns of NS) {
  const enNs = JSON.parse(readFileSync(join(ROOT, 'public/locales/en', `${ns}.json`), 'utf8'))
  const enFlat = flatten(enNs, '', {})
  for (const lang of LANGS) {
    const out = {}
    const idx = enIndexByLang[lang] ?? {}
    for (const [keyPath, enVal] of Object.entries(enFlat)) {
      const translated = idx[enVal]
      if (translated != null) setDeep(out, keyPath, translated)
      else {
        setDeep(out, keyPath, enVal) // English fallback so the file is structurally complete
        ;(missing[lang] ??= []).push(`${ns}.${keyPath}`)
      }
    }
    const outDir = join(ROOT, 'public/locales', lang)
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, `${ns}.json`), JSON.stringify(out, null, 2) + '\n', 'utf8')
  }
}

console.log('Harvest complete. English-only fallbacks (need translation):')
for (const [lang, keys] of Object.entries(missing)) console.log(`  ${lang}: ${keys.length} -> ${keys.join(', ')}`)
```

- [ ] **Step 2: Run it** — `node scripts/i18n-harvest.mjs`. Read the stdout: note which keys fell back to English (expected for portal-3.0-specific phrasings). This is informational, not a failure.

- [ ] **Step 3: Sanity-check output** — open `public/locales/de/auth.json` and confirm common terms are German where legacy had them (e.g. the email/password labels), English where not matched. Confirm all 16 language dirs now have `auth.json` and `common.json`.

- [ ] **Step 4: Verify** — `npx tsc -p tsconfig.json --noEmit && npm run lint` clean (the JSON files are not type-checked, but the script must lint clean as a `.mjs` — if eslint does not cover `.mjs`, that is fine).

- [ ] **Step 5: Commit**
```bash
git add scripts/i18n-harvest.mjs public/locales
git commit -m "feat(i18n): harvest legacy translations for auth+common across 16 languages"
```

---

### Task 9: Locale completeness test + scoped lint enforcement

**Files:**
- Create: `src/i18n/locales.test.ts`
- Modify: `eslint.config.js`
- Modify: `package.json` (add `eslint-plugin-i18next` dev dependency)

- [ ] **Step 1: Write the completeness test** `src/i18n/locales.test.ts`. It asserts every translated locale's key set is a SUBSET of the English key set (no orphan/typo keys), for both namespaces, across all 16 languages, and that each language file exists:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const LANGS = ['ar','cs','de','el','es','id','it','ja','ms-MY','pl','pt-BR','th','tr','vi','zh-Hans','zh-Hant']
const NS = ['auth', 'common']
const root = process.cwd()

const flatten = (o: Record<string, unknown>, p = '', out: Record<string, string> = {}) => {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k
    if (v && typeof v === 'object') flatten(v as Record<string, unknown>, key, out)
    else if (typeof v === 'string') out[key] = v
  }
  return out
}
const load = (lang: string, ns: string) =>
  JSON.parse(readFileSync(join(root, 'public/locales', lang, `${ns}.json`), 'utf8')) as Record<string, unknown>

describe('locale completeness', () => {
  for (const ns of NS) {
    const enKeys = new Set(Object.keys(flatten(load('en', ns))))
    for (const lang of LANGS) {
      it(`${lang}/${ns}.json exists and has no keys outside the English set`, () => {
        expect(existsSync(join(root, 'public/locales', lang, `${ns}.json`))).toBe(true)
        const langKeys = Object.keys(flatten(load(lang, ns)))
        const orphans = langKeys.filter((k) => !enKeys.has(k))
        expect(orphans).toEqual([])
      })
    }
  }
})
```

- [ ] **Step 2: Run it, verify PASS** — `npx vitest run src/i18n/locales.test.ts`. (Harvest output mirrors the English structure, so key sets match exactly.)

- [ ] **Step 3: Add the lint dependency** — `npm install -D eslint-plugin-i18next`.

- [ ] **Step 4: Add a scoped override to `eslint.config.js`.** Import the plugin at the top:
```js
import i18next from 'eslint-plugin-i18next'
```
Then append a new config object to the array returned by `defineConfig([...])`, AFTER the existing main config object:
```js
  {
    files: ['src/features/auth/**/*.{ts,tsx}'],
    plugins: { i18next },
    rules: {
      // Flag hardcoded user-facing strings in JSX. Scoped to auth (the migrated
      // vertical); each later i18n slice widens this glob to its feature.
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },
```

- [ ] **Step 5: Run lint, verify it PASSES on auth** — `npm run lint`. The migrated auth files have no literal JSX text. If the rule flags a legitimate non-UI string (e.g. an attribute or a test literal) due to the option not matching the installed plugin version, set the option to the version's equivalent that restricts to JSX rendered text (e.g. `{ markupOnly: true }` or `{ onlyAttribute: [] }`) — the intent is "JSX text only," and you must NOT disable the rule or broaden it to silence it. If a specific non-UI line genuinely must be allowed, use a narrowly-scoped `// eslint-disable-next-line` with a reason.

- [ ] **Step 6: Verify** — `npx tsc -p tsconfig.json --noEmit && npm run lint && npx vitest run src/i18n/locales.test.ts` clean/green.

- [ ] **Step 7: Commit**
```bash
git add src/i18n/locales.test.ts eslint.config.js package.json package-lock.json
git commit -m "test(i18n): locale completeness check + scoped no-literal lint for auth"
```

---

### Task 10: Full verification gate

- [ ] **Step 1: Run the whole suite** — `npm run lint && npx tsc -p tsconfig.json --noEmit && npx vitest run && npx playwright test` (all green). The e2e `auth.spec.ts` must still pass with no changes, since the rendered English is identical.

- [ ] **Step 2:** If any fixes were required, commit them with a clear message. Otherwise, no commit.

- [ ] **Step 3: Confirm definition of done** against the spec: `auth` namespace exists for all 17 languages (en authored, 16 harvested with English fallback where unmatched); typed keys enforced by tsc; all auth components and the reset screens render via `t()`; validation uses the `(t) => schema` pattern; lint rule active and scoped to `src/features/auth/**`; i18n initialised in test setup; all suites green.

---

## Self-review notes

- **Spec coverage:** namespaces (Task 1), typed keys (Task 2), test-setup init (Task 3), auth component migration (Tasks 4-6), reset screens (Task 7), harvest 17 languages (Task 8), completeness check + scoped enforcement (Task 9), gate (Task 10). All design sections map to tasks.
- **Preserve English wording:** every migrated key copies the exact prior English literal, so existing unit assertions and the e2e selectors keep matching — called out in Global Constraints and each migration task.
- **Out-of-scope boundaries honoured:** `aseCodes.ts` and `notify()` message strings are explicitly left unchanged (Task 1 note + Task 4 Step 2 note); no notification renderer is built; only auth is migrated. The lint rule is scoped to `src/features/auth/**` so the ~50 un-migrated strings elsewhere do not fail the build.
- **Type consistency:** the `makeSchema(t: TFunction<'auth'>)` factory with `type Values = z.infer<ReturnType<typeof makeSchema>>` is identical across Tasks 4-6. `useTranslation('auth')` namespace is consistent; keys referenced (`login.*`, `twoFactor.*`, `reset.*`, `validation.*`) all exist in the Task 1 `auth.json`.
- **Harvest determinism:** the script avoids `Date.now()`/randomness and is idempotent; output is committed. The completeness test guards against structural drift between English and translations.

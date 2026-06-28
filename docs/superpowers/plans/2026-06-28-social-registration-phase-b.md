# Social Registration (Google and Apple) - Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user register or sign in with Google or Apple via Keycloak identity-brokered OAuth, completing a short data-collection step for new users and reusing the existing onboarding flow.

**Architecture:** A full-page PKCE redirect to Keycloak (`kc_idp_hint=google|apple`) returns to a `/account/callback` route, which exchanges the code for tokens, calls `/auth/profile/status`, and branches: returning users land via the existing landing logic; new users complete `/account/social-registration` (country + consent, plus name/DOB only when the token lacks them) and create the application through the same `submitInitialApplication` seam built in Phase A. Only the auth-establishment half is social-specific.

**Tech Stack:** React 19, TypeScript (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), TanStack Router + Query, Zustand, React Hook Form + Zod, MUI v9, Vitest, Playwright. Web Crypto API for PKCE.

## Global Constraints

- Keycloak config is read from `getConfig()` (`@/config/configStore`): `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `AUTH_URL`. Never hardcode host, realm, or client id. (Verified UAT values: host `uat-auth-new.thinkmarkets.com`, realm `thinkmarkets`, client `web-app`.)
- PKCE with `code_challenge_method=S256`; `kc_idp_hint` is `google` or `apple`; `scope=openid profile email`.
- Redirect URI is always `` `${window.location.origin}/account/callback` ``. (Live dev on `portal-test` is blocked until the backend allow-lists that URI; the e2e mocks the endpoints so it is unaffected.)
- The `id_token` (not the access token) is the bearer credential for `socialRegister` and `checkProfileStatus`; these are direct `fetch` calls, not the shared `httpClient.auth()` (which sends the access token).
- The `socialDraft` is held in memory only (Zustand), never written to `localStorage`. The established session uses the same `tokenStore` as the email/password flow.
- The application-create step reuses `submitInitialApplication` (Phase A) unchanged. The social create omits `accountHolderPassword` and `recaptchaResponse` (the provider OAuth is the human check; confirm against the backend at build time).
- House style (regulated financial institution): British English, formal tone, no emojis, no em or en dashes anywhere in code, comments, or copy.

---

## File structure

New:
- `src/features/auth/social/keycloakBroker.ts` - PKCE generation, auth-URL builder, code-for-token exchange, id_token claim decoding.
- `src/features/auth/social/pkceStore.ts` - sessionStorage handoff of the PKCE session between initiate and callback.
- `src/features/auth/social/initiateSocialLogin.ts` - generates PKCE, persists it, redirects to Keycloak.
- `src/features/auth/social/SocialButton.tsx` and `SocialButtonsSection.tsx` - the social buttons.
- `src/features/auth/api/socialApi.ts` - `socialRegister` and `checkProfileStatus` (bearer id_token, direct fetch).
- `src/features/auth/components/SocialCallback.tsx` and `src/features/auth/routes/callback.tsx` - the `/account/callback` handler and route.
- `src/features/registration/components/SocialRegistrationForm.tsx` and `src/features/registration/routes/socialRegistration.tsx` - the `/account/social-registration` screen and route.

Modified:
- `src/features/auth/api/authTypes.ts` - add `SocialRegisterParams`, `ProfileStatus`.
- `src/features/registration/state/registrationStore.ts` - add `socialDraft`, `setSocialDraft`, `clearSocial`.
- `src/features/registration/api/createAccount.ts` - add `createSocialAccount`.
- `src/features/registration/RegisterScreen.tsx` and `src/features/auth/components/LoginForm.tsx` - render `SocialButtonsSection`.
- `src/router/router.tsx` - register the two new routes.

---

## Task 1: Keycloak broker - PKCE, auth URL, claim decoding

**Files:**
- Create: `src/features/auth/social/keycloakBroker.ts`
- Test: `src/features/auth/social/keycloakBroker.test.ts`

**Interfaces:**
- Consumes: `getConfig()` from `@/config/configStore` (fields `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`).
- Produces:
  - `type SocialProvider = 'google' | 'apple'`
  - `generateCodeVerifier(): string`
  - `deriveCodeChallenge(verifier: string): Promise<string>`
  - `buildAuthUrl(params: { provider: SocialProvider; redirectUri: string; state: string; codeChallenge: string }): string`
  - `interface SocialClaims { email: string; firstName?: string; lastName?: string }`
  - `decodeIdTokenClaims(idToken: string): SocialClaims`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/auth/social/keycloakBroker.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/config/configStore', () => ({
  getConfig: () => ({
    KEYCLOAK_URL: 'https://kc.test',
    KEYCLOAK_REALM: 'thinkmarkets',
    KEYCLOAK_CLIENT_ID: 'web-app',
    AUTH_URL: 'https://auth.test',
  }),
}))

import {
  generateCodeVerifier,
  deriveCodeChallenge,
  buildAuthUrl,
  decodeIdTokenClaims,
} from './keycloakBroker'

const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('keycloakBroker', () => {
  it('derives the S256 challenge per the RFC 7636 test vector', async () => {
    const challenge = await deriveCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('generateCodeVerifier returns a 43-char base64url string', () => {
    const v = generateCodeVerifier()
    expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('buildAuthUrl includes client, S256, scope, state and the provider hint', () => {
    const url = new URL(
      buildAuthUrl({ provider: 'google', redirectUri: 'https://app.test/account/callback', state: 'st8', codeChallenge: 'chal' })
    )
    expect(url.origin + url.pathname).toBe('https://kc.test/realms/thinkmarkets/protocol/openid-connect/auth')
    expect(url.searchParams.get('client_id')).toBe('web-app')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/account/callback')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('openid profile email')
    expect(url.searchParams.get('code_challenge')).toBe('chal')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe('st8')
    expect(url.searchParams.get('kc_idp_hint')).toBe('google')
  })

  it('decodeIdTokenClaims reads name and email', () => {
    const token = `h.${b64url({ email: 'a@b.com', given_name: 'Ada', family_name: 'Lovelace' })}.s`
    expect(decodeIdTokenClaims(token)).toEqual({ email: 'a@b.com', firstName: 'Ada', lastName: 'Lovelace' })
  })

  it('decodeIdTokenClaims falls back to preferred_username and reports missing names', () => {
    const token = `h.${b64url({ preferred_username: 'relay@privaterelay.appleid.com' })}.s`
    expect(decodeIdTokenClaims(token)).toEqual({
      email: 'relay@privaterelay.appleid.com',
      firstName: undefined,
      lastName: undefined,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/social/keycloakBroker.test.ts`
Expected: FAIL with "Cannot find module './keycloakBroker'".

- [ ] **Step 3: Write the implementation**

```typescript
// src/features/auth/social/keycloakBroker.ts
import { getConfig } from '@/config/configStore'

export type SocialProvider = 'google' | 'apple'

const base64UrlEncode = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const generateCodeVerifier = (): string => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes.buffer)
}

export const deriveCodeChallenge = async (verifier: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(digest)
}

export const buildAuthUrl = (params: {
  provider: SocialProvider
  redirectUri: string
  state: string
  codeChallenge: string
}): string => {
  const cfg = getConfig()
  const query = new URLSearchParams({
    client_id: cfg.KEYCLOAK_CLIENT_ID,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
    state: params.state,
    kc_idp_hint: params.provider,
  })
  return `${cfg.KEYCLOAK_URL}/realms/${cfg.KEYCLOAK_REALM}/protocol/openid-connect/auth?${query.toString()}`
}

export interface SocialClaims {
  email: string
  firstName?: string
  lastName?: string
}

// Apple may place the email in preferred_username (private relay) and omits the
// name after the first authorisation, so both are optional and fall back.
export const decodeIdTokenClaims = (idToken: string): SocialClaims => {
  const segment = idToken.split('.')[1] ?? ''
  const json = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
  return {
    email: (json.email as string) || (json.preferred_username as string) || '',
    firstName: (json.given_name as string) || undefined,
    lastName: (json.family_name as string) || undefined,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/social/keycloakBroker.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/social/keycloakBroker.ts src/features/auth/social/keycloakBroker.test.ts
git commit -m "feat(social): keycloak broker PKCE, auth URL, and claim decoding"
```

---

## Task 2: Keycloak broker - token exchange

**Files:**
- Modify: `src/features/auth/social/keycloakBroker.ts`
- Test: `src/features/auth/social/keycloakBroker.exchange.test.ts`

**Interfaces:**
- Consumes: `getConfig()`; `AuthTokens` from `@/api/types` (`{ accessToken; refreshToken; idToken?; refreshTokenValidUntil }`).
- Produces: `exchangeCodeForTokens(code: string, codeVerifier: string, redirectUri: string): Promise<AuthTokens>`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/auth/social/keycloakBroker.exchange.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/config/configStore', () => ({
  getConfig: () => ({
    KEYCLOAK_URL: 'https://kc.test',
    KEYCLOAK_REALM: 'thinkmarkets',
    KEYCLOAK_CLIENT_ID: 'web-app',
    AUTH_URL: 'https://auth.test',
  }),
}))

import { exchangeCodeForTokens } from './keycloakBroker'

describe('exchangeCodeForTokens', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('posts the PKCE form and maps the Keycloak response to AuthTokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'AT',
        refresh_token: 'RT',
        id_token: 'IT',
        refresh_expires_in: 3600,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const tokens = await exchangeCodeForTokens('the-code', 'the-verifier', 'https://app.test/account/callback')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://kc.test/realms/thinkmarkets/protocol/openid-connect/token')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('the-code')
    expect(body.get('code_verifier')).toBe('the-verifier')
    expect(body.get('redirect_uri')).toBe('https://app.test/account/callback')
    expect(body.get('client_id')).toBe('web-app')
    expect(tokens).toEqual({
      accessToken: 'AT',
      refreshToken: 'RT',
      idToken: 'IT',
      refreshTokenValidUntil: '2026-01-01T01:00:00.000Z',
    })
  })

  it('throws when the exchange is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) }))
    await expect(exchangeCodeForTokens('c', 'v', 'r')).rejects.toThrow('Token exchange failed (HTTP 400)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/social/keycloakBroker.exchange.test.ts`
Expected: FAIL with "exchangeCodeForTokens is not a function".

- [ ] **Step 3: Append the implementation to `keycloakBroker.ts`**

```typescript
// add to src/features/auth/social/keycloakBroker.ts
import type { AuthTokens } from '@/api/types'

interface KeycloakTokenResponse {
  access_token: string
  refresh_token: string
  id_token: string
  refresh_expires_in: number
}

export const exchangeCodeForTokens = async (
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<AuthTokens> => {
  const cfg = getConfig()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: cfg.KEYCLOAK_CLIENT_ID,
    code_verifier: codeVerifier,
  })
  const res = await fetch(`${cfg.KEYCLOAK_URL}/realms/${cfg.KEYCLOAK_REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Token exchange failed (HTTP ${res.status})`)
  const json = (await res.json()) as KeycloakTokenResponse
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    idToken: json.id_token,
    refreshTokenValidUntil: new Date(Date.now() + json.refresh_expires_in * 1000).toISOString(),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/social/keycloakBroker.exchange.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/social/keycloakBroker.ts src/features/auth/social/keycloakBroker.exchange.test.ts
git commit -m "feat(social): keycloak PKCE code-for-token exchange"
```

---

## Task 3: PKCE session store and initiateSocialLogin

**Files:**
- Create: `src/features/auth/social/pkceStore.ts`
- Create: `src/features/auth/social/initiateSocialLogin.ts`
- Test: `src/features/auth/social/pkceStore.test.ts`
- Test: `src/features/auth/social/initiateSocialLogin.test.ts`

**Interfaces:**
- Consumes: `generateCodeVerifier`, `deriveCodeChallenge`, `buildAuthUrl`, `SocialProvider` from `./keycloakBroker`.
- Produces:
  - `interface PkceSession { codeVerifier: string; state: string; provider: SocialProvider }`
  - `savePkce(s: PkceSession): void`
  - `consumePkce(): PkceSession | null`  (reads and clears)
  - `socialCallbackUri(): string` (`` `${window.location.origin}/account/callback` ``)
  - `initiateSocialLogin(provider: SocialProvider): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/features/auth/social/pkceStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { savePkce, consumePkce } from './pkceStore'

describe('pkceStore', () => {
  beforeEach(() => sessionStorage.clear())

  it('round-trips and clears on consume', () => {
    savePkce({ codeVerifier: 'v', state: 's', provider: 'apple' })
    expect(consumePkce()).toEqual({ codeVerifier: 'v', state: 's', provider: 'apple' })
    expect(consumePkce()).toBeNull()
  })

  it('returns null when nothing is stored', () => {
    expect(consumePkce()).toBeNull()
  })
})
```

```typescript
// src/features/auth/social/initiateSocialLogin.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/config/configStore', () => ({
  getConfig: () => ({
    KEYCLOAK_URL: 'https://kc.test',
    KEYCLOAK_REALM: 'thinkmarkets',
    KEYCLOAK_CLIENT_ID: 'web-app',
    AUTH_URL: 'https://auth.test',
  }),
}))

import { initiateSocialLogin } from './initiateSocialLogin'
import { consumePkce } from './pkceStore'

describe('initiateSocialLogin', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('persists the PKCE session and redirects to the Keycloak auth URL', async () => {
    const assign = vi.fn()
    // jsdom location.assign is not implemented; replace it
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.test', assign },
      writable: true,
    })

    await initiateSocialLogin('google')

    expect(assign).toHaveBeenCalledTimes(1)
    const url = new URL(assign.mock.calls[0][0] as string)
    expect(url.searchParams.get('kc_idp_hint')).toBe('google')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/account/callback')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')

    const saved = consumePkce()
    expect(saved?.provider).toBe('google')
    expect(saved?.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(url.searchParams.get('state')).toBe(saved?.state)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/auth/social/pkceStore.test.ts src/features/auth/social/initiateSocialLogin.test.ts`
Expected: FAIL with "Cannot find module './pkceStore'" / "'./initiateSocialLogin'".

- [ ] **Step 3: Write the implementations**

```typescript
// src/features/auth/social/pkceStore.ts
import type { SocialProvider } from './keycloakBroker'

const KEY = 'pkce'

export interface PkceSession {
  codeVerifier: string
  state: string
  provider: SocialProvider
}

export const savePkce = (session: PkceSession): void => {
  sessionStorage.setItem(KEY, JSON.stringify(session))
}

export const consumePkce = (): PkceSession | null => {
  const raw = sessionStorage.getItem(KEY)
  sessionStorage.removeItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PkceSession
  } catch {
    return null
  }
}
```

```typescript
// src/features/auth/social/initiateSocialLogin.ts
import {
  generateCodeVerifier,
  deriveCodeChallenge,
  buildAuthUrl,
  type SocialProvider,
} from './keycloakBroker'
import { savePkce } from './pkceStore'

export const socialCallbackUri = (): string => `${window.location.origin}/account/callback`

export const initiateSocialLogin = async (provider: SocialProvider): Promise<void> => {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await deriveCodeChallenge(codeVerifier)
  const state = generateCodeVerifier()
  savePkce({ codeVerifier, state, provider })
  window.location.assign(buildAuthUrl({ provider, redirectUri: socialCallbackUri(), state, codeChallenge }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/auth/social/pkceStore.test.ts src/features/auth/social/initiateSocialLogin.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/social/pkceStore.ts src/features/auth/social/initiateSocialLogin.ts src/features/auth/social/pkceStore.test.ts src/features/auth/social/initiateSocialLogin.test.ts
git commit -m "feat(social): PKCE session handoff and initiateSocialLogin redirect"
```

---

## Task 4: Social auth API - socialRegister and checkProfileStatus

**Files:**
- Modify: `src/features/auth/api/authTypes.ts`
- Create: `src/features/auth/api/socialApi.ts`
- Test: `src/features/auth/api/socialApi.test.ts`

**Interfaces:**
- Consumes: `getConfig()` (`AUTH_URL`); `AuthResult` from `./authTypes`.
- Produces (in `authTypes.ts`):
  - `interface SocialRegisterParams { email_id: string; first_name: string; last_name: string; country: number; account_holder_title?: string; brand: string; source?: string }`
  - `interface ProfileStatus { needsCompletion: boolean; missing?: string[] }`
- Produces (in `socialApi.ts`):
  - `checkProfileStatus(idToken: string): Promise<ProfileStatus>` (GET, bearer id_token)
  - `socialRegister(idToken: string, params: SocialRegisterParams): Promise<AuthResult>` (POST, bearer id_token, no password)

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/auth/api/socialApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/config/configStore', () => ({ getConfig: () => ({ AUTH_URL: 'https://auth.test' }) }))

import { checkProfileStatus, socialRegister } from './socialApi'

describe('socialApi', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('checkProfileStatus GETs with the id_token bearer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ needsCompletion: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const status = await checkProfileStatus('ID-TOKEN')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://auth.test/auth/profile/status')
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBe('Bearer ID-TOKEN')
    expect(status).toEqual({ needsCompletion: true })
  })

  it('checkProfileStatus throws when not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }))
    await expect(checkProfileStatus('x')).rejects.toThrow('Profile status failed (HTTP 401)')
  })

  it('socialRegister POSTs the bearer id_token body with no password', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'OK', tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await socialRegister('ID-TOKEN', {
      email_id: 'a@b.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      country: 158,
      account_holder_title: 'Mr',
      brand: 'ThinkMarkets',
      source: 'TP3-LiveApp',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://auth.test/auth/register')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer ID-TOKEN')
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      email_id: 'a@b.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      country: 158,
      account_holder_title: 'Mr',
      brand: 'ThinkMarkets',
      source: 'TP3-LiveApp',
    })
    expect(body.password).toBeUndefined()
    expect(result.status).toBe('OK')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/api/socialApi.test.ts`
Expected: FAIL with "Cannot find module './socialApi'".

- [ ] **Step 3: Add the types and the implementation**

Append to `src/features/auth/api/authTypes.ts`:

```typescript
export interface SocialRegisterParams {
  email_id: string
  first_name: string
  last_name: string
  country: number
  account_holder_title?: string
  brand: string
  source?: string
}

export interface ProfileStatus {
  needsCompletion: boolean
  missing?: string[]
}
```

```typescript
// src/features/auth/api/socialApi.ts
import { getConfig } from '@/config/configStore'
import type { AuthResult, ProfileStatus, SocialRegisterParams } from './authTypes'

// The auth-adapter validates the Keycloak id_token as a bearer credential. We
// use the id_token (not the access token) because Apple access tokens issued
// through Keycloak can lack sub/email. These are direct fetches, not the shared
// httpClient.auth() which sends the access token.
export const checkProfileStatus = async (idToken: string): Promise<ProfileStatus> => {
  const res = await fetch(`${getConfig().AUTH_URL}/auth/profile/status`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Profile status failed (HTTP ${res.status})`)
  return (await res.json()) as ProfileStatus
}

export const socialRegister = async (
  idToken: string,
  params: SocialRegisterParams
): Promise<AuthResult> => {
  const res = await fetch(`${getConfig().AUTH_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    credentials: 'include',
    body: JSON.stringify(params),
  })
  return (await res.json()) as AuthResult
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/api/socialApi.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/api/authTypes.ts src/features/auth/api/socialApi.ts src/features/auth/api/socialApi.test.ts
git commit -m "feat(social): socialRegister and checkProfileStatus (bearer id_token)"
```

---

## Task 5: registrationStore social draft

**Files:**
- Modify: `src/features/registration/state/registrationStore.ts`
- Test: `src/features/registration/state/registrationStore.social.test.ts`

**Interfaces:**
- Consumes: `AuthTokens` from `@/api/types`; `SocialProvider` from `@/features/auth/social/keycloakBroker`.
- Produces (added to the existing store):
  - `interface SocialDraft { provider: SocialProvider; idToken: string; keycloakTokens: AuthTokens; email: string; firstName?: string; lastName?: string }`
  - `socialDraft: SocialDraft | null`
  - `setSocialDraft(d: SocialDraft): void`
  - `clearSocial(): void`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/registration/state/registrationStore.social.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useRegistrationStore, type SocialDraft } from './registrationStore'

const sample: SocialDraft = {
  provider: 'apple',
  idToken: 'IT',
  keycloakTokens: { accessToken: 'a', refreshToken: 'r', idToken: 'IT', refreshTokenValidUntil: '2030' },
  email: 'a@b.com',
}

describe('registrationStore social draft', () => {
  beforeEach(() => useRegistrationStore.getState().clearSocial())

  it('sets and clears the social draft', () => {
    useRegistrationStore.getState().setSocialDraft(sample)
    expect(useRegistrationStore.getState().socialDraft).toEqual(sample)
    useRegistrationStore.getState().clearSocial()
    expect(useRegistrationStore.getState().socialDraft).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/registration/state/registrationStore.social.test.ts`
Expected: FAIL with "clearSocial is not a function".

- [ ] **Step 3: Extend the store**

Edit `src/features/registration/state/registrationStore.ts` to add the imports, the `SocialDraft` type, the state fields, and the actions (keep the existing `draft`/`setDraft`/`clear` intact):

```typescript
import { create } from 'zustand'
import type { AuthTokens } from '@/api/types'
import type { SocialProvider } from '@/features/auth/social/keycloakBroker'

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

// In-memory only: holds the Keycloak id_token and tokens between the social
// callback and the social-registration screen. Never persisted to localStorage.
export interface SocialDraft {
  provider: SocialProvider
  idToken: string
  keycloakTokens: AuthTokens
  email: string
  firstName?: string
  lastName?: string
}

interface RegistrationState {
  draft: RegistrationDraft | null
  socialDraft: SocialDraft | null
  setDraft: (d: RegistrationDraft) => void
  clear: () => void
  setSocialDraft: (d: SocialDraft) => void
  clearSocial: () => void
}

// In-memory only: holds the password between the registration screen and the
// Personal Information screen. Never persisted to localStorage.
export const useRegistrationStore = create<RegistrationState>((set) => ({
  draft: null,
  socialDraft: null,
  setDraft: (draft) => set({ draft }),
  clear: () => set({ draft: null }),
  setSocialDraft: (socialDraft) => set({ socialDraft }),
  clearSocial: () => set({ socialDraft: null }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/registration/state/registrationStore.social.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/registration/state/registrationStore.ts src/features/registration/state/registrationStore.social.test.ts
git commit -m "feat(social): in-memory social draft in the registration store"
```

---

## Task 6: createSocialAccount seam

**Files:**
- Modify: `src/features/registration/api/createAccount.ts`
- Test: `src/features/registration/api/createSocialAccount.test.ts`

**Interfaces:**
- Consumes: `socialRegister` from `@/features/auth/api/socialApi`; `submitInitialApplication` (existing, same file); `tokenStore`, `useSessionStore`; `SocialDraft` from `../state/registrationStore`.
- Produces:
  - `interface CreateSocialAccountInput { social: SocialDraft; originCountry: number; preferredOrganization: number; portalAccountDomain: string; preferredLanguage: number; firstName: string; lastName: string; title: string; agreeToAllTerms: boolean; isMarketingOptOut: boolean; day?: number; month?: number; year?: number }`
  - `createSocialAccount(input: CreateSocialAccountInput): Promise<{ applicationId: number }>`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/registration/api/createSocialAccount.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const socialRegister = vi.fn()
const submitLevelOne = vi.fn()
const setAuthTokens = vi.fn()
const setLoggedIn = vi.fn()

vi.mock('@/features/auth/api/socialApi', () => ({ socialRegister }))
vi.mock('@/features/onboarding/api/onboardingApi', () => ({ submitLevelOne }))
vi.mock('@/api/tokenStore', () => ({ tokenStore: { setAuthTokens, hasValidSession: () => false } }))
vi.mock('@/state/sessionStore', () => ({ useSessionStore: { getState: () => ({ setLoggedIn }) } }))

import { createSocialAccount } from './createAccount'
import type { SocialDraft } from '../state/registrationStore'

const social: SocialDraft = {
  provider: 'apple',
  idToken: 'IT',
  keycloakTokens: { accessToken: 'KA', refreshToken: 'KR', idToken: 'IT', refreshTokenValidUntil: '2030' },
  email: 'a@b.com',
}

const baseInput = {
  social,
  originCountry: 158,
  preferredOrganization: 14,
  portalAccountDomain: 'TMLC',
  preferredLanguage: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  title: 'Mr',
  agreeToAllTerms: true,
  isMarketingOptOut: false,
}

describe('createSocialAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    submitLevelOne.mockResolvedValue({ applicationId: 42 })
  })

  it('registers, stores returned portal tokens, sets logged in, and creates the application without a password', async () => {
    socialRegister.mockResolvedValue({ status: 'OK', tokens: { accessToken: 'PA', refreshToken: 'PR', refreshTokenValidUntil: '2031' } })

    const result = await createSocialAccount({ ...baseInput, day: 1, month: 2, year: 1990 })

    expect(socialRegister).toHaveBeenCalledWith('IT', {
      email_id: 'a@b.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      country: 158,
      account_holder_title: 'Mr',
      brand: 'ThinkMarkets',
      source: 'TP3-LiveApp',
    })
    expect(setAuthTokens).toHaveBeenCalledWith({ accessToken: 'PA', refreshToken: 'PR', refreshTokenValidUntil: '2031' })
    expect(setLoggedIn).toHaveBeenCalledWith(true)
    const payload = submitLevelOne.mock.calls[0][0]
    expect(payload.accountHolderPassword).toBeUndefined()
    expect(payload.recaptchaResponse).toBeUndefined()
    expect(payload.accountHolderDayOfBirth).toBe(1)
    expect(payload.accountType).toBe('individual')
    expect(result).toEqual({ applicationId: 42 })
  })

  it('falls back to the Keycloak tokens when the register response carries none', async () => {
    socialRegister.mockResolvedValue({ status: 'OK' })
    await createSocialAccount(baseInput)
    expect(setAuthTokens).toHaveBeenCalledWith(social.keycloakTokens)
  })

  it('throws and does not create the application when the register returns an error code', async () => {
    socialRegister.mockResolvedValue({ status: 'ASE-008', code: 'ASE-008' })
    await expect(createSocialAccount(baseInput)).rejects.toThrow('Social registration failed: ASE-008')
    expect(submitLevelOne).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/registration/api/createSocialAccount.test.ts`
Expected: FAIL with "createSocialAccount is not a function".

- [ ] **Step 3: Add `createSocialAccount` to `createAccount.ts`**

Append (do not change `submitInitialApplication` or `createSimplifiedAccount`):

```typescript
import { socialRegister } from '@/features/auth/api/socialApi'
import type { SocialDraft } from '../state/registrationStore'

export interface CreateSocialAccountInput {
  social: SocialDraft
  originCountry: number
  preferredOrganization: number
  portalAccountDomain: string
  preferredLanguage: number
  firstName: string
  lastName: string
  title: string
  agreeToAllTerms: boolean
  isMarketingOptOut: boolean
  day?: number
  month?: number
  year?: number
}

export const createSocialAccount = async (
  input: CreateSocialAccountInput
): Promise<{ applicationId: number }> => {
  // 1) Establish auth (social). The Keycloak tokens are already in hand from the
  // callback exchange; the auth-adapter trusts the id_token bearer.
  const auth = await socialRegister(input.social.idToken, {
    email_id: input.social.email,
    first_name: input.firstName,
    last_name: input.lastName,
    country: input.originCountry,
    account_holder_title: input.title,
    brand: 'ThinkMarkets',
    source: 'TP3-LiveApp',
  })
  if (auth.code && auth.status !== 'OK') {
    throw new Error(`Social registration failed: ${auth.code}`)
  }
  tokenStore.setAuthTokens(auth.tokens ?? input.social.keycloakTokens)
  useSessionStore.getState().setLoggedIn(true)

  // 2) Create the application (shared step). No password, no recaptcha on the
  // social path (the provider OAuth is the human check).
  const applicationId = await submitInitialApplication({
    accountHolderEmail: input.social.email,
    originCountry: input.originCountry,
    preferredOrganization: input.preferredOrganization,
    portalAccountDomain: input.portalAccountDomain,
    preferredLanguage: input.preferredLanguage,
    accountHolderFirstName: input.firstName,
    accountHolderLastName: input.lastName,
    accountHolderTitle: input.title,
    ...(input.day ? { accountHolderDayOfBirth: input.day } : {}),
    ...(input.month ? { accountHolderMonthOfBirth: input.month } : {}),
    ...(input.year ? { accountHolderYearOfBirth: input.year } : {}),
    agreeToAllTerms: input.agreeToAllTerms,
    isMarketingOptOut: input.isMarketingOptOut,
    accountType: 'individual',
    accountTradingTypes: [1],
    brand: 'ThinkMarkets',
    source: 'TP3-LiveApp',
  })
  return { applicationId }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/registration/api/createSocialAccount.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/registration/api/createAccount.ts src/features/registration/api/createSocialAccount.test.ts
git commit -m "feat(social): createSocialAccount seam reusing submitInitialApplication"
```

---

## Task 7: Social buttons and placement on register and login

**Files:**
- Create: `src/features/auth/social/SocialButton.tsx`
- Create: `src/features/auth/social/SocialButtonsSection.tsx`
- Modify: `src/features/registration/RegisterScreen.tsx`
- Modify: `src/features/auth/components/LoginForm.tsx`
- Test: `src/features/auth/social/SocialButtonsSection.test.tsx`

**Interfaces:**
- Consumes: `initiateSocialLogin`, `SocialProvider` from the social module.
- Produces: `SocialButton({ provider })`, `SocialButtonsSection()`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/auth/social/SocialButtonsSection.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const initiateSocialLogin = vi.fn().mockResolvedValue(undefined)
vi.mock('./initiateSocialLogin', () => ({ initiateSocialLogin }))

import { SocialButtonsSection } from './SocialButtonsSection'

describe('SocialButtonsSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders a Google and an Apple button', () => {
    render(<SocialButtonsSection />)
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with apple/i })).toBeInTheDocument()
  })

  it('initiates the chosen provider on click', async () => {
    render(<SocialButtonsSection />)
    await userEvent.click(screen.getByRole('button', { name: /continue with apple/i }))
    expect(initiateSocialLogin).toHaveBeenCalledWith('apple')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/social/SocialButtonsSection.test.tsx`
Expected: FAIL with "Cannot find module './SocialButtonsSection'".

- [ ] **Step 3: Write the components and wire them in**

```typescript
// src/features/auth/social/SocialButton.tsx
import { Button } from '@mui/material'
import { initiateSocialLogin } from './initiateSocialLogin'
import type { SocialProvider } from './keycloakBroker'

const LABELS: Record<SocialProvider, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
}

export const SocialButton = ({ provider }: { provider: SocialProvider }) => (
  <Button fullWidth variant="outlined" onClick={() => void initiateSocialLogin(provider)}>
    {LABELS[provider]}
  </Button>
)
```

```typescript
// src/features/auth/social/SocialButtonsSection.tsx
import { Stack, Divider } from '@mui/material'
import { SocialButton } from './SocialButton'

export const SocialButtonsSection = () => (
  <Stack spacing={1}>
    <Divider>or</Divider>
    <SocialButton provider="google" />
    <SocialButton provider="apple" />
  </Stack>
)
```

Edit `src/features/registration/RegisterScreen.tsx` to render the section under the form:

```typescript
import { Stack, Typography } from '@mui/material'
import { RegisterForm } from './components/RegisterForm'
import { SocialButtonsSection } from '@/features/auth/social/SocialButtonsSection'

export const RegisterScreen = () => (
  <Stack spacing={3} sx={{ maxWidth: 420, mx: 'auto', mt: 4 }}>
    <Typography variant="h4">Create your account</Typography>
    <RegisterForm />
    <SocialButtonsSection />
    <Typography variant="caption" color="text.secondary">
      CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.
    </Typography>
  </Stack>
)
```

Edit `src/features/auth/components/LoginForm.tsx`: add the import and render the section inside the `Stack`, after the submit `Button` and before `{captcha.element}`:

```typescript
import { SocialButtonsSection } from '@/features/auth/social/SocialButtonsSection'
```

```typescript
            <Button type="submit" disabled={login.isPending}>
              {t('login.signIn')}
            </Button>
            <SocialButtonsSection />
            <Box sx={{ textAlign: 'center' }}>
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/features/auth/social/SocialButtonsSection.test.tsx src/features/auth/components/LoginForm.test.tsx`
Expected: PASS (the new section tests pass; the existing LoginForm test still passes because the section only adds buttons).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/social/SocialButton.tsx src/features/auth/social/SocialButtonsSection.tsx src/features/auth/social/SocialButtonsSection.test.tsx src/features/registration/RegisterScreen.tsx src/features/auth/components/LoginForm.tsx
git commit -m "feat(social): social buttons on the register and login screens"
```

---

## Task 8: Social callback screen and route

**Files:**
- Create: `src/features/auth/components/SocialCallback.tsx`
- Create: `src/features/auth/routes/callback.tsx`
- Modify: `src/router/router.tsx`
- Test: `src/features/auth/components/SocialCallback.test.tsx`

**Interfaces:**
- Consumes: `consumePkce` (`../social/pkceStore`), `exchangeCodeForTokens`, `decodeIdTokenClaims` (`../social/keycloakBroker`), `socialCallbackUri` (`../social/initiateSocialLogin`), `checkProfileStatus` (`../api/socialApi`), `tokenStore`, `useSessionStore`, `getUserProfile` (`../api/authApi`), `resolveLandingRoute` (`../landing`), `useRegistrationStore.setSocialDraft`.
- Produces: `SocialCallback` component; `CallbackRoute` at `/account/callback`.

**Notes for the implementer:**
- Use a `useRef` guard so the async effect runs once (React 19 strict-mode double-invoke). This mirrors the one-shot effect pattern used elsewhere in the codebase.
- On any failure (error param, missing/mismatched state, thrown exchange, empty id_token) render an inline error with a link back to `/account/register`. Do not auto-navigate on error, so the message stays visible. There is no global notification renderer yet (same limitation as Phase A).

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/auth/components/SocialCallback.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

const exchangeCodeForTokens = vi.fn()
const decodeIdTokenClaims = vi.fn()
vi.mock('../social/keycloakBroker', () => ({ exchangeCodeForTokens, decodeIdTokenClaims }))

const checkProfileStatus = vi.fn()
vi.mock('../api/socialApi', () => ({ checkProfileStatus }))

const consumePkce = vi.fn()
vi.mock('../social/pkceStore', () => ({ consumePkce }))
vi.mock('../social/initiateSocialLogin', () => ({ socialCallbackUri: () => 'https://app.test/account/callback' }))

const setAuthTokens = vi.fn()
vi.mock('@/api/tokenStore', () => ({ tokenStore: { setAuthTokens, hasValidSession: () => false } }))
const setLoggedIn = vi.fn()
vi.mock('@/state/sessionStore', () => ({ useSessionStore: { getState: () => ({ setLoggedIn }) } }))
vi.mock('../api/authApi', () => ({ getUserProfile: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../landing', () => ({ resolveLandingRoute: () => '/onboarding' }))

const setSocialDraft = vi.fn()
vi.mock('@/features/registration/state/registrationStore', () => ({
  useRegistrationStore: (sel: (s: unknown) => unknown) => sel({ setSocialDraft }),
}))

import { SocialCallback } from './SocialCallback'

const setUrl = (search: string) =>
  Object.defineProperty(window, 'location', { value: { href: `https://app.test/account/callback${search}` }, writable: true })

const tokens = { accessToken: 'KA', refreshToken: 'KR', idToken: 'IT', refreshTokenValidUntil: '2030' }

describe('SocialCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consumePkce.mockReturnValue({ codeVerifier: 'v', state: 'st', provider: 'apple' })
    exchangeCodeForTokens.mockResolvedValue(tokens)
  })

  it('returning user: stores tokens, logs in, lands', async () => {
    setUrl('?code=c&state=st')
    checkProfileStatus.mockResolvedValue({ needsCompletion: false })
    render(<SocialCallback />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/onboarding' }))
    expect(setAuthTokens).toHaveBeenCalledWith(tokens)
    expect(setLoggedIn).toHaveBeenCalledWith(true)
    expect(setSocialDraft).not.toHaveBeenCalled()
  })

  it('new user: seeds the social draft and routes to social registration', async () => {
    setUrl('?code=c&state=st')
    checkProfileStatus.mockResolvedValue({ needsCompletion: true })
    decodeIdTokenClaims.mockReturnValue({ email: 'a@b.com', firstName: undefined, lastName: undefined })
    render(<SocialCallback />)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/account/social-registration' }))
    expect(setSocialDraft).toHaveBeenCalledWith({
      provider: 'apple',
      idToken: 'IT',
      keycloakTokens: tokens,
      email: 'a@b.com',
      firstName: undefined,
      lastName: undefined,
    })
    expect(setLoggedIn).not.toHaveBeenCalled()
  })

  it('state mismatch: shows an error and does not navigate', async () => {
    setUrl('?code=c&state=WRONG')
    render(<SocialCallback />)
    await waitFor(() => expect(screen.getByText(/could not complete/i)).toBeInTheDocument())
    expect(navigate).not.toHaveBeenCalled()
    expect(exchangeCodeForTokens).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/components/SocialCallback.test.tsx`
Expected: FAIL with "Cannot find module './SocialCallback'".

- [ ] **Step 3: Write the component and route, and register the route**

```typescript
// src/features/auth/components/SocialCallback.tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link as RouterLink } from '@tanstack/react-router'
import { Stack, Typography, Link } from '@mui/material'
import { consumePkce } from '../social/pkceStore'
import { exchangeCodeForTokens, decodeIdTokenClaims } from '../social/keycloakBroker'
import { socialCallbackUri } from '../social/initiateSocialLogin'
import { checkProfileStatus } from '../api/socialApi'
import { getUserProfile } from '../api/authApi'
import { resolveLandingRoute } from '../landing'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'
import { useRegistrationStore } from '@/features/registration/state/registrationStore'

export const SocialCallback = () => {
  const navigate = useNavigate()
  const setSocialDraft = useRegistrationStore((s) => s.setSocialDraft)
  const [error, setError] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const run = async () => {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')
      const hasError = url.searchParams.get('error')
      const pkce = consumePkce()
      if (hasError || !code || !pkce || returnedState !== pkce.state) {
        setError(true)
        return
      }
      try {
        const tokens = await exchangeCodeForTokens(code, pkce.codeVerifier, socialCallbackUri())
        const idToken = tokens.idToken ?? ''
        const status = await checkProfileStatus(idToken)
        if (!status.needsCompletion) {
          tokenStore.setAuthTokens(tokens)
          useSessionStore.getState().setLoggedIn(true)
          const profile = await getUserProfile().catch(() => undefined)
          navigate({ to: resolveLandingRoute(profile) })
          return
        }
        const claims = decodeIdTokenClaims(idToken)
        setSocialDraft({
          provider: pkce.provider,
          idToken,
          keycloakTokens: tokens,
          email: claims.email,
          firstName: claims.firstName,
          lastName: claims.lastName,
        })
        navigate({ to: '/account/social-registration' })
      } catch {
        setError(true)
      }
    }
    void run()
  }, [navigate, setSocialDraft])

  if (error) {
    return (
      <Stack spacing={2} sx={{ maxWidth: 420, mx: 'auto', mt: 4 }}>
        <Typography>We could not complete your sign in. Please try again.</Typography>
        <Link component={RouterLink} to="/account/register" underline="hover">
          Back to sign in
        </Link>
      </Stack>
    )
  }
  return <Typography sx={{ mt: 4, textAlign: 'center' }}>Completing your sign in...</Typography>
}
```

```typescript
// src/features/auth/routes/callback.tsx
import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { SocialCallback } from '@/features/auth/components/SocialCallback'

export const CallbackRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/callback',
  component: SocialCallback,
})
```

Edit `src/router/router.tsx`: add the import and place `CallbackRoute` in the flat children array alongside `RegisterRoute`:

```typescript
import { CallbackRoute } from '@/features/auth/routes/callback'
```

```typescript
const routeTree = RootRoute.addChildren([
  IndexRoute,
  LoginRoute,
  RegisterRoute,
  PersonalInformationRoute,
  CallbackRoute,
  TwoFactorRoute,
  ResetRequestRoute,
  ResetSentRoute,
  ResetConfirmRoute,
  ResetDoneRoute,
  AuthenticatedRoute.addChildren([OnboardingRoute, VerifyEmailRoute, dashboardRouteTree]),
])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/components/SocialCallback.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/components/SocialCallback.tsx src/features/auth/components/SocialCallback.test.tsx src/features/auth/routes/callback.tsx src/router/router.tsx
git commit -m "feat(social): /account/callback handler with returning/new-user branch"
```

---

## Task 9: Social registration screen and route

**Files:**
- Create: `src/features/registration/components/SocialRegistrationForm.tsx`
- Create: `src/features/registration/routes/socialRegistration.tsx`
- Modify: `src/router/router.tsx`
- Test: `src/features/registration/components/SocialRegistrationForm.test.tsx`

**Interfaces:**
- Consumes: `useCountries` (`../api/countriesQueries`), `filterCountries`, `domainForCountry`, `organizationIdForCountry`, `getLanguageId` (`../country`), `useRegistrationStore` (`socialDraft`, `clearSocial`), `useOnboardingStore` (`patch`), `createSocialAccount` (`../api/createAccount`).
- Produces: `SocialRegistrationForm` component; `SocialRegistrationRoute` at `/account/social-registration`.

**Notes for the implementer:**
- Guard: if `socialDraft` is null, redirect to `/account/register` in an effect.
- Name/DOB fields are shown only when the draft lacks names (`!socialDraft.firstName || !socialDraft.lastName`). Build the Zod schema from that boolean so the fields are required exactly when shown.
- Derive `preferredLanguage` with `getLanguageId(country, [], 'en')`, matching `RegisterForm`.
- On a create failure, set a form-level error in a `Box` (not on an individual field).

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/registration/components/SocialRegistrationForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

vi.mock('../api/countriesQueries', () => ({
  useCountries: () => ({
    data: [{ id: 158, name: 'Nigeria', code2: 'NG', code3: 'NGA', used: true, organization: { id: 14, name: 'TMLC' }, isSimplifyOnboarding: true }],
  }),
}))

const createSocialAccount = vi.fn()
vi.mock('../api/createAccount', () => ({ createSocialAccount }))

const patch = vi.fn()
vi.mock('@/features/onboarding/state/onboardingStore', () => ({
  useOnboardingStore: (sel: (s: unknown) => unknown) => sel({ patch }),
}))

let socialDraft: unknown = {
  provider: 'apple',
  idToken: 'IT',
  keycloakTokens: { accessToken: 'a', refreshToken: 'r', idToken: 'IT', refreshTokenValidUntil: '2030' },
  email: 'a@b.com',
  firstName: undefined,
  lastName: undefined,
}
const clearSocial = vi.fn()
vi.mock('../state/registrationStore', () => ({
  useRegistrationStore: (sel: (s: unknown) => unknown) => sel({ socialDraft, clearSocial }),
}))

import { SocialRegistrationForm } from './SocialRegistrationForm'

describe('SocialRegistrationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createSocialAccount.mockResolvedValue({ applicationId: 7 })
  })

  it('collects name and DOB when the token lacks names, then creates and routes to onboarding', async () => {
    render(<SocialRegistrationForm />)
    // name fields visible because firstName/lastName are undefined
    await userEvent.type(screen.getByLabelText(/first name/i), 'Ada')
    await userEvent.type(screen.getByLabelText(/last name/i), 'Lovelace')
    await userEvent.type(screen.getByLabelText(/^day$/i), '1')
    await userEvent.type(screen.getByLabelText(/^month$/i), '2')
    await userEvent.type(screen.getByLabelText(/^year$/i), '1990')
    // select country
    await userEvent.click(screen.getByLabelText(/country of residence/i))
    await userEvent.click(await screen.findByRole('option', { name: 'Nigeria' }))
    await userEvent.click(screen.getByLabelText(/i agree to the terms/i))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/onboarding' }))
    const arg = createSocialAccount.mock.calls[0][0]
    expect(arg.originCountry).toBe(158)
    expect(arg.portalAccountDomain).toBe('TMLC')
    expect(arg.preferredOrganization).toBe(14)
    expect(arg.firstName).toBe('Ada')
    expect(arg.day).toBe(1)
    expect(clearSocial).toHaveBeenCalled()
    expect(patch).toHaveBeenCalledWith(expect.objectContaining({ applicationId: 7, originCountry: 158 }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/registration/components/SocialRegistrationForm.test.tsx`
Expected: FAIL with "Cannot find module './SocialRegistrationForm'".

- [ ] **Step 3: Write the component, route, and register the route**

```typescript
// src/features/registration/components/SocialRegistrationForm.tsx
import { useEffect, useMemo, useState } from 'react'
import { useForm, FormProvider, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { Box, Stack, TextField, MenuItem, FormControlLabel, Checkbox } from '@mui/material'
import { RHFTextField } from '@/components/RHFTextField'
import { Button } from '@/components/Button'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { useCountries } from '../api/countriesQueries'
import { filterCountries, domainForCountry, organizationIdForCountry, getLanguageId } from '../country'
import { useRegistrationStore } from '../state/registrationStore'
import { useOnboardingStore } from '@/features/onboarding/state/onboardingStore'
import { createSocialAccount } from '../api/createAccount'

const CURRENT_YEAR = new Date().getFullYear()

const makeSchema = (needsName: boolean) => {
  const nameField = needsName ? z.string().min(1, 'Required') : z.string().optional()
  const dob = (max: number) =>
    needsName ? z.coerce.number().int().min(1).max(max) : z.coerce.number().int().min(1).max(max).optional()
  return z.object({
    countryId: z.number().int().positive('Select your country of residence'),
    agreeToTerms: z.literal(true, { message: 'You must accept the terms' }),
    marketingConsent: z.boolean(),
    firstName: nameField,
    lastName: nameField,
    day: dob(31),
    month: dob(12),
    year: needsName ? z.coerce.number().int().min(1900).max(CURRENT_YEAR) : z.coerce.number().int().min(1900).max(CURRENT_YEAR).optional(),
  })
}

export const SocialRegistrationForm = () => {
  const navigate = useNavigate()
  const social = useRegistrationStore((s) => s.socialDraft)
  const clearSocial = useRegistrationStore((s) => s.clearSocial)
  const seedOnboarding = useOnboardingStore((s) => s.patch)
  const { data: countryData } = useCountries()
  const countries = useMemo(() => filterCountries(countryData ?? []), [countryData])
  const needsName = !social?.firstName || !social?.lastName
  const [submitError, setSubmitError] = useState(false)

  const methods = useForm({
    resolver: zodResolver(makeSchema(needsName)),
    defaultValues: { countryId: 0, marketingConsent: false, firstName: '', lastName: '' },
  })

  useEffect(() => {
    if (!social) navigate({ to: '/account/register' })
  }, [social, navigate])

  const onSubmit = methods.handleSubmit(async (v) => {
    if (!social) return
    const country = countries.find((c) => c.id === v.countryId)
    if (!country) return
    setSubmitError(false)
    try {
      const firstName = social.firstName ?? (v.firstName as string) ?? ''
      const lastName = social.lastName ?? (v.lastName as string) ?? ''
      const portalAccountDomain = domainForCountry(country)
      const { applicationId } = await createSocialAccount({
        social,
        originCountry: country.id,
        preferredOrganization: organizationIdForCountry(country),
        portalAccountDomain,
        preferredLanguage: getLanguageId(country, [], 'en'),
        firstName,
        lastName,
        title: 'Mr',
        agreeToAllTerms: true,
        isMarketingOptOut: !v.marketingConsent,
        day: v.day as number | undefined,
        month: v.month as number | undefined,
        year: v.year as number | undefined,
      })
      seedOnboarding({
        applicationId,
        originCountry: country.id,
        portalAccountDomain,
        accountHolderFirstName: firstName,
        accountHolderLastName: lastName,
        ...(v.day ? { accountHolderDayOfBirth: v.day as number } : {}),
        ...(v.month ? { accountHolderMonthOfBirth: v.month as number } : {}),
        ...(v.year ? { accountHolderYearOfBirth: v.year as number } : {}),
      })
      clearSocial()
      navigate({ to: '/onboarding' })
    } catch {
      setSubmitError(true)
    }
  })

  return (
    <AuthCard title="Complete your registration">
      <FormProvider {...methods}>
        <Box component="form" onSubmit={onSubmit} noValidate>
          <Stack spacing={2} sx={{ maxWidth: 360 }}>
            {needsName && (
              <>
                <RHFTextField name="firstName" label="First name" />
                <RHFTextField name="lastName" label="Last name" />
                <RHFTextField name="day" label="Day" type="number" />
                <RHFTextField name="month" label="Month" type="number" />
                <RHFTextField name="year" label="Year" type="number" />
              </>
            )}
            <Controller
              control={methods.control}
              name="countryId"
              render={({ field, fieldState }) => (
                <TextField
                  select
                  id="countryId"
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
            {/* C-2 pre-production compliance blocker: link the real T&C / Client Agreement / KID documents once compliance supplies them. */}
            <Controller
              control={methods.control}
              name="agreeToTerms"
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox checked={field.value === true} onChange={(e) => field.onChange(e.target.checked)} onBlur={field.onBlur} />
                  }
                  label="I agree to the Terms and Conditions"
                />
              )}
            />
            {methods.formState.errors.agreeToTerms && (
              <Box sx={{ color: 'error.main', fontSize: 12 }}>{methods.formState.errors.agreeToTerms.message as string}</Box>
            )}
            <FormControlLabel
              control={<Checkbox {...methods.register('marketingConsent')} />}
              label="Send me marketing updates"
            />
            {submitError && (
              <Box sx={{ color: 'error.main', fontSize: 12 }}>We could not create your account. Please try again.</Box>
            )}
            <Button type="submit">Continue</Button>
          </Stack>
        </Box>
      </FormProvider>
    </AuthCard>
  )
}
```

```typescript
// src/features/registration/routes/socialRegistration.tsx
import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from '@/router/routes/__root'
import { SocialRegistrationForm } from '@/features/registration/components/SocialRegistrationForm'

export const SocialRegistrationRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/social-registration',
  component: SocialRegistrationForm,
})
```

Edit `src/router/router.tsx`: add the import and place `SocialRegistrationRoute` in the flat children array:

```typescript
import { SocialRegistrationRoute } from '@/features/registration/routes/socialRegistration'
```

```typescript
  RegisterRoute,
  PersonalInformationRoute,
  CallbackRoute,
  SocialRegistrationRoute,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/registration/components/SocialRegistrationForm.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/registration/components/SocialRegistrationForm.tsx src/features/registration/components/SocialRegistrationForm.test.tsx src/features/registration/routes/socialRegistration.tsx src/router/router.tsx
git commit -m "feat(social): /account/social-registration screen and route"
```

---

## Task 10: End-to-end social flow (callback onward)

**Files:**
- Create: `e2e/registration-social.spec.ts`

**Notes for the implementer:**
- The initiate step is a full-page redirect to Keycloak, which Playwright cannot complete. Drive the flow from the callback onward: pre-seed the PKCE session with `page.addInitScript`, then `page.goto` the callback URL with a matching `state`.
- Mock the Keycloak token endpoint (`**/protocol/openid-connect/token`), `**/auth/profile/status`, `**/auth/register`, and `**/nsdata` (the existing action-branch pattern from `e2e/registration-simplified.spec.ts`).
- Build a fake Apple id_token whose payload has no `given_name`/`family_name` so the new-user path shows the name fields.

- [ ] **Step 1: Write the e2e spec**

```typescript
// e2e/registration-social.spec.ts
import { test, expect } from '@playwright/test'

// Minimal JWT with a base64url payload (header/sig are not validated client-side).
const b64url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const appleIdToken = `h.${b64url({ preferred_username: 'relay@privaterelay.appleid.com' })}.s`

const seedPkce = (state: string) => `
  sessionStorage.setItem('pkce', JSON.stringify({ codeVerifier: 'v', state: '${state}', provider: 'apple' }))
`

const mockNsdata = async (page: import('@playwright/test').Page) => {
  await page.route('**/protocol/openid-connect/token', (route) =>
    route.fulfill({ json: { access_token: 'AT', refresh_token: 'RT', id_token: appleIdToken, refresh_expires_in: 3600 } })
  )
  await page.route('**/auth/register', (route) =>
    route.fulfill({ json: { status: 'OK', tokens: { accessToken: 'PA', refreshToken: 'PR', refreshTokenValidUntil: '2030' } } })
  )
  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    const ok = (result: unknown) =>
      route.fulfill({ json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] } })
    if (action === 'getCountries')
      return ok([{ id: 158, name: 'Nigeria', code2: 'NG', code3: 'NGA', used: true, organization: { id: 14, name: 'TMLC' }, isSimplifyOnboarding: true }])
    if (action === 'simplified_submit_level_one') return ok({ applicationId: 999 })
    if (action === 'check_application_statuses') return ok([{ application_status: 'INCOMPLETE' }])
    if (action === 'getLastApplicationsInfo') return ok([])
    if (action === 'getQuestions') return ok([])
    if (action === 'get_user') return ok({ id: 1, email: 'a@b.com', country: { id: 158 }, additionalAttributes: {} })
    return ok({})
  })
}

test('new Apple user: callback collects missing details and reaches onboarding', async ({ page }) => {
  await page.addInitScript(seedPkce('st'))
  await page.route('**/auth/profile/status', (route) => route.fulfill({ json: { needsCompletion: true } }))
  await mockNsdata(page)

  await page.goto('/account/callback?code=c&state=st')
  await expect(page.getByRole('heading', { name: /complete your registration/i })).toBeVisible()

  await page.getByLabel(/first name/i).fill('Ada')
  await page.getByLabel(/last name/i).fill('Lovelace')
  await page.getByLabel(/^day$/i).fill('1')
  await page.getByLabel(/^month$/i).fill('2')
  await page.getByLabel(/^year$/i).fill('1990')
  await page.getByLabel(/country of residence/i).click()
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByLabel(/i agree to the terms/i).click()
  await page.getByRole('button', { name: /continue/i }).click()

  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByText(/loading your application/i)).toHaveCount(0)
})

test('returning social user: callback lands without the registration screen', async ({ page }) => {
  await page.addInitScript(seedPkce('st'))
  await page.route('**/auth/profile/status', (route) => route.fulfill({ json: { needsCompletion: false } }))
  await mockNsdata(page)

  await page.goto('/account/callback?code=c&state=st')

  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByRole('heading', { name: /complete your registration/i })).toHaveCount(0)
})
```

- [ ] **Step 2: Run the spec**

Run: `npx playwright test e2e/registration-social.spec.ts --reporter=line`
Expected: PASS (2 tests). If a selector does not match the rendered DOM, adjust the selector to the actual markup (do not weaken the URL or no-strand assertions).

- [ ] **Step 3: Commit**

```bash
git add e2e/registration-social.spec.ts
git commit -m "test(e2e): social callback to onboarding (new and returning user)"
```

---

## Task 11: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Run the whole suite**

Run: `npm run lint && npx tsc -p tsconfig.json --noEmit && npx vitest run && npx playwright test`
Expected: all green.

- [ ] **Step 2: Fix any failures**

If anything fails, fix the root cause (do not weaken assertions) and re-run. Commit each fix with a descriptive message.

---

## Open items to confirm during the build (from the spec verification)

- **Returning-user token model:** the design stores the Keycloak tokens via `setAuthTokens` for returning users and reuses them (or the register response tokens) for new users. Confirm with one real social login in the UAT browser, or with the backend, that the Keycloak tokens drive the TFBO `/cportal/nsdata` session correctly. If the backend requires a portal-token exchange instead, adjust the returning-user branch in `SocialCallback` only.
- **Social create payload:** confirm the backend accepts `simplified_submit_level_one` for a social applicant with no `recaptchaResponse` and no `accountHolderPassword`.
- **Dev redirect URI:** local dev on `portal-test` is blocked until the backend allow-lists `https://portal-test.thinkmarkets.com/account/callback` for the `web-app` client. The e2e is unaffected (endpoints are mocked).

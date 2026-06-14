# Auth Vertical (2a) Design

**Date:** 2026-06-14
**Status:** Approved (pending written-spec review)
**Sub-project:** 2a — Authentication (first slice of the original "Auth + onboarding/KYC" vertical)

## Context

Portal 3.0 is the modern rebuild of the legacy `portal-2.0` CFD brokerage portal
(see `docs/superpowers/specs/2026-06-14-portal-3.0-foundation-design.md`). The
Foundation (app shell, routing, MUI theme, state, typed auth/API client, i18n,
Sentry) is complete and on `main`, with a throwaway dev sign-in standing in for
real authentication.

The original sub-project 2 ("Auth + onboarding/KYC") is three subsystems. It is
decomposed into:

- **2a — Authentication** (this document): get an existing user logged in and landed.
- **2b — Registration + onboarding application** (incl. social login, email verification).
- **2c — KYC document verification** (SumSub, TrustDock, GreenID, Jumio, GBG).

This spec covers **2a only**.

## Goal

Replace the throwaway dev sign-in with real authentication: an existing user can
log in with email/password, complete 2FA when required, reset a forgotten
password, and remain signed in subject to a profile-driven inactivity timeout.
The slice ends at a `resolveLandingRoute()` seam that lands on an authenticated
placeholder; real status-based landing (dashboard vs onboarding) is filled in by
later verticals.

## Scope

**In scope:** email/password login; 2FA (TOTP); password reset (multi-step);
refresh-token session continuation; profile-driven inactivity auto-logout with
"keep me signed in"; reCAPTCHA v3 on login and reset.

**Out of scope (deferred):** social login (Keycloak PKCE) and registration →
2b; email verification (OTP) → 2b, because its send-code call needs signup data
(name, country, language); full post-login preload (accounts, transactions, IB,
loyalty) → Dashboard vertical; status-based landing destinations → later
verticals (2a provides the routing seam only).

## Decisions (confirmed)

| Area                 | Decision                                                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slice scope          | Core auth only: login, 2FA, password reset, session/inactivity, captcha                                                                                                                   |
| Session continuation | Refresh token (Foundation auth client). **No client-side password storage** (drops the legacy encrypted email+password; compliance win)                                                   |
| "Keep me signed in"  | Persisted flag that **disables** the inactivity auto-logout. Does not change token storage (tokens always in localStorage, surviving restarts up to refresh-token validity, as in legacy) |
| Inactivity timeout   | Period from `userProfile.inactivityTimeout`; **default fallback from env config** (`VITE_LOGOUT_AFTER_MIN`)                                                                               |
| Post-login behaviour | Establish session + fetch user profile, then `resolveLandingRoute()` → single authenticated placeholder (stub)                                                                            |
| Email verification   | Moved to 2b (registration-coupled)                                                                                                                                                        |
| Forms                | React Hook Form + Zod (Foundation primitives)                                                                                                                                             |
| Data layer           | TanStack Query mutations (login/2fa/reset) + query (profile)                                                                                                                              |
| Captcha              | hCaptcha (invisible) on login + reset                                                                                                                                                     |
| Folder convention    | `src/features/auth/` (establishes the feature-folder pattern for verticals)                                                                                                               |
| Tests                | Vitest units; component tests + integration via MSW; Playwright smoke via `/auth/*` route interception (no real backend)                                                                  |

## Architecture

### File structure

```
src/features/auth/
  api/
    authApi.ts             (login, verifyTwoFactor, requestPasswordReset,
                            confirmPasswordReset, getUserProfile - built on httpClient)
    authQueries.ts         (TanStack Query mutations + useUserProfile query)
    authApi.test.ts
  components/
    LoginForm.tsx
    TwoFactorForm.tsx
    PasswordResetRequestForm.tsx
    PasswordResetConfirmForm.tsx
    *.test.tsx
  hooks/
    useInactivityTimeout.ts   (replaces legacy CheckActivitySaga)
    useCaptcha.ts             (reCAPTCHA v3 wrapper)
    useInactivityTimeout.test.ts
  routes/
    login.tsx                 (/account/login)
    twoFactor.tsx             (/account/login/check)
    resetRequest.tsx          (/account/reset)
    resetSent.tsx             (/account/reset/sent)
    resetConfirm.tsx          (/account/reset/new)
    resetDone.tsx             (/account/reset/done)
  landing.ts                  (resolveLandingRoute seam)
  landing.test.ts
```

The Foundation's shared `src/api/`, `src/state/`, `src/theme/`, `src/components/`
remain cross-cutting infrastructure. The feature folder groups everything
specific to authentication so it can be understood and tested as a unit.

### API layer (`src/features/auth/api/authApi.ts`)

Functions built on the Foundation `httpClient` (which already attaches the
Bearer token, sends cookies, and handles refresh-and-retry):

- `login(email, password, recaptchaToken)` → `POST {AUTH_URL}/auth/login`
  (Authorize.No). Returns `{ status, tokens?, ... }`.
- `verifyTwoFactor(email, code)` → `POST {AUTH_URL}/auth/tfa` (Authorize.Yes).
- `requestPasswordReset(email, recaptchaToken)` → TFBO
  `/authentication/forgot_password_web`.
- `confirmPasswordReset(password, token, recaptchaToken)` → TFBO
  `/authentication/forgot_password_web`.
- `getUserProfile()` → user fetch (exact endpoint confirmed during planning from
  legacy `Api.getUser()`).

All requests reach the dev server's own origin and are forwarded by the dev
proxy (`/auth`, `/cportal`).

### Data flow on login

1. `LoginForm` submits → `useLogin` mutation calls `authApi.login`.
2. On `OK` / `PENDING_*`: `tokenStore.setAuthTokens(...)` + `tokenStore.setTfbo(...)`,
   open the session gate (`useSessionStore.setLoggedIn(true)`), fetch the user
   profile, then `resolveLandingRoute(profile)` → navigate.
3. On `TFA_REQUIRED`: navigate to `/account/login/check` (interim token already
   stored so the `/auth/tfa` call is authorised).
4. On `NOT_AUTHORIZED`: inline field error (wrong email/password). Other statuses:
   toast via `notificationStore`.

### 2FA

`TwoFactorForm` (6-digit code) → `useVerifyTwoFactor` mutation → `authApi.verifyTwoFactor`.
On `OK`: store final tokens, open gate, land. On expired (`ASE-002`): clear
session, return to login with a notice. On invalid: inline retry.

### Password reset

Four routed steps: request (email + captcha) → "check your email" → set new
password (token read from the URL of the emailed link + captcha) → done → back
to login. The reset token is read from the route URL, not from a backend-pushed
store value.

### Session & inactivity

- Session continuation uses the refresh token (Foundation auth client); no
  password is stored.
- `useInactivityTimeout` listens for user activity (pointer/keyboard), and when
  idle beyond `userProfile.inactivityTimeout` (fallback `VITE_LOGOUT_AFTER_MIN`)
  triggers logout: clear tokens, reset the session store, redirect to
  `/account/login`.
- "Keep me signed in" is a persisted flag (localStorage); when set, the
  inactivity watcher is disabled.
- The Foundation's `TokenExpired` teardown already handles refresh failure.

### Captcha

`useCaptcha` wraps **hCaptcha** (`@hcaptcha/react-hcaptcha`, invisible size),
executed on login and reset submits, returning a token passed to the API call.
(The legacy code comments say "reCAPTCHA" but it implements hCaptcha.) Uses the
existing optional `HCAPTCHA_KEY` config field, supplied via `VITE_HCAPTCHA_KEY`
in the `.env.*` files (the staging key exists in the legacy config). The captcha
script loads only on the public auth screens.

### Landing seam (`src/features/auth/landing.ts`)

`resolveLandingRoute(profile)` returns the post-login destination. For 2a it
returns a single authenticated placeholder route. Later verticals replace the
body with the real status-based mapping (approved → dashboard, incomplete →
onboarding, pending → pending screen). The placeholder route reuses or replaces
the Foundation's `/hello` stub.

## Error handling

- Inline (form field) errors for invalid login credentials (auth `code` `ASE-001`)
  and invalid 2FA code.
- Toast notifications (`notificationStore`) for unexpected statuses and network
  errors.
- Legacy `ASE-*` codes mapped to i18n message keys; the mapping table lives in
  the auth feature and is unit-tested.
- `SessionExpiredError` (Foundation) surfaces as a redirect to login with a
  notice.

## Testing

- **Unit (Vitest):** auth api functions (mocked fetch), mutation status handling,
  `resolveLandingRoute`, the ASE-code message map, and `useInactivityTimeout`
  (fake timers: idle past timeout logs out; activity resets; keep-signed-in
  disables).
- **Component:** each form (RHF validation, submit, error display) with **MSW**
  mocking the auth endpoints.
- **E2E (Playwright):** a smoke test intercepting `/auth/*` to drive
  login → 2FA → landing, and a password-reset happy path, without a real backend.

## Compliance

New authentication and token-handling code triggers the **security/compliance
review gate** before sign-off, as with the Foundation auth layer: confirm no
credentials are logged, captcha tokens are not retained, the inactivity logout
reliably clears tokens, and no secret is committed (the hCaptcha site key is
public).

## Definition of done

- Login form authenticates a real (or MSW-mocked) user; tokens stored; session
  gate opened; profile fetched; lands on the authenticated placeholder.
- 2FA challenge handled (required → verify → land; expired → re-login; invalid →
  retry).
- Password reset request → confirm → done flow works end to end.
- Inactivity auto-logout fires after the profile/env timeout; "keep me signed in"
  disables it; both covered by tests.
- hCaptcha executes on login and reset.
- The throwaway dev sign-in is removed; guarded routes redirect to the real login.
- Lint, unit tests, component tests, and the Playwright smoke pass under Node 20.
- Security/compliance review completed.

## Risks and notes

- **Exact endpoints:** `getUserProfile` and the precise password-reset
  request/response envelopes are confirmed against the legacy `api.ts` during
  planning, not invented.
- **Backend availability:** flows are developed against MSW mocks and the dev
  proxy to the UAT backend; tests never depend on live UAT credentials.
- **resolveLandingRoute is a deliberate stub** — the status-based routing is
  intentionally deferred to the verticals that own those destinations.

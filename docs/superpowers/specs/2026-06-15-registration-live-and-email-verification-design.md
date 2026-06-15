# Registration Slice 1 (live create-account + email verification) Design

**Date:** 2026-06-15
**Status:** Approved (pending written-spec review)
**Sub-project:** Registration — the live (real) account create flow plus the email OTP verification gate, feeding directly into the onboarding GeneralFlow/SimplifiedFlow already on `main`.

## Context

The Portal 3.0 onboarding engine and four flows (Simplified, GeneralFlow AU, TMCY/EU,
UK) are built and on `main`. They assume an **authenticated** session and an **existing**
application: `OnboardingScreen` loads the application via an authenticated
`tfboCall('application', 'getLastApplicationsInfo', {}, Authorize.Yes)` and routes by the
returned `portalAccountDomain` through `selectFlow`. The `AppInfo` type carries no
registration fields (no email/password/origin-country/terms/marketing/tracking).

There is currently no way for a brand-new applicant to obtain a session and an
application. Registration fills that gap. In the legacy portal the live account is created
by the **first unauthenticated** `incremental_submit`, whose response carries
`sso_token` + `token`; the user is authenticated from that point. This slice ports that
behaviour into a self-contained registration feature so onboarding stays unchanged.

## Goal

An unauthenticated visitor completes a two-step live create-account form (credentials +
residency), the account is created, the session is established, and the visitor lands in
the correct onboarding flow for their jurisdiction. After onboarding completes, an email
OTP verification screen confirms their address.

## Decisions (confirmed)

| Area | Decision |
| ---- | -------- |
| Slice scope | Live email/password create-account + email OTP verification. Demo and social/Keycloak deferred to their own slices. |
| Account-creation seam | **Registration owns creation**: registration itself fires the unauthenticated account-creating submit, stores the returned auth material, sets logged-in, and navigates to `/onboarding`. Onboarding is unchanged. |
| Create call | `tfboCall('application', 'incremental_submit', params, Authorize.No)` (legacy unauthenticated variant). Response carries `sso_token`, `token`, `applicationId`, `applicationStatus`. |
| Token handoff | Mirror the login success handler: `tokenStore.setTfbo(sso_token, token)` (and `tokenStore.setAuthTokens` if OAuth tokens are also returned) then `useSessionStore.getState().setLoggedIn(true)`. |
| Country list | New `useCountries` → `tfboCall('utility', 'getCountries', { showUnused: false }, Authorize.No)`, returning the rich `Country` type with `organization: { id, name, guid, defaultLeverage }`. |
| Domain / org mapping | `portalAccountDomain = country.organization.name`; `preferredOrganization = country.organization.id`. These drive the existing `selectFlow`. |
| Country filtering (this slice) | Exclude `JPN` by default. IB code is collected (manual + `ibc` cookie prefill) and sent as `afsAid`. |
| Email verification | Self-contained `/account/verify-email` (authenticated) screen; `sendOtp` on mount reads `email`/`firstName`/`lastName`/`country.id`/`preferredLanguage` from the user profile; 6-digit OTP verified via `verifyOtpCode`. Entered after onboarding completion (a one-line edit to the onboarding terminal stub). |
| Marketing consent | Default **opt-out** (`isMarketingOptOut: true` unless the user ticks consent). Flagged for compliance confirmation. |

## Scope

**In scope:**

- `src/features/registration/`: rich `Country`/`Organization` types, `useCountries`,
  `tracking.ts` (IB/UTM/visitor/referrer), pure `country.ts` helpers, `RegisterForm`
  (`CredentialsStep` + `ResidencyStep`), the `createLiveAccount` call + `useRegister`
  mutation, the response→token-storage handler, `RegisterScreen`, and the public
  `/register` route.
- `src/features/emailVerification/`: `sendOtpCode` / `verifyOtpCode` calls + mutations,
  the `OtpInput` component, `EmailVerificationScreen`, and the authenticated
  `/account/verify-email` route.
- Router wiring for both routes; a one-line edit to the onboarding completion stub to
  route to `/account/verify-email`.

**Out of scope (deferred, flagged):**

- Demo account registration (`registerDemo` → WebTrader redirect).
- Social / Keycloak PKCE login & registration.
- EU-geo country filtering, IB country-whitelist, Capital-Index forced-AU.
- The AU application-type selector and UAE org-selector residency sub-steps.
- Multi-country tax residency and Canada province/territory selection.
- Login-time email-verification gating (needs a dashboard and an `emailVerified` profile
  field); this slice only wires the post-onboarding entry.

## Architecture

### File structure

```
src/features/registration/
  types.ts                         (Country, Organization, RegisterParams, RegisterResponse)
  country.ts / country.test.ts     (domainForCountry, organizationIdForCountry, filterCountries, getLanguageId)
  tracking.ts / tracking.test.ts   (readTracking: ibc cookie, utmLink/source, visitorId, referrerId)
  api/countriesApi.ts              (getCountries — utility/getCountries, Authorize.No)
  api/countriesQueries.ts          (useCountries)
  api/registerApi.ts               (createLiveAccount — application/incremental_submit, Authorize.No; storeRegistrationAuth handler)
  api/registerApi.test.ts
  api/registerQueries.ts           (useRegister)
  components/CredentialsStep.tsx
  components/ResidencyStep.tsx
  components/RegisterForm.tsx / RegisterForm.test.tsx
  RegisterScreen.tsx
  routes/register.tsx
src/features/emailVerification/
  api/emailApi.ts                  (sendOtpCode — emailvalidation/send_verification_code; verifyOtpCode — emailvalidation/verify_otp_code)
  api/emailQueries.ts              (useSendOtp, useVerifyOtp)
  api/emailApi.test.ts
  components/OtpInput.tsx / OtpInput.test.tsx
  EmailVerificationScreen.tsx / EmailVerificationScreen.test.tsx
  routes/verifyEmail.tsx
src/router/router.tsx              (+ RegisterRoute public, VerifyEmailRoute authenticated)
src/features/onboarding/...        (one-line terminal-stub edit -> navigate /account/verify-email)
e2e/registration.spec.ts
e2e/email-verification.spec.ts
```

### Types (`registration/types.ts`)

The rich `Country` (ported from legacy, trimmed to fields this slice needs) plus
`Organization { id, name, guid, defaultLeverage }` where `name` is the
`portalAccountDomain` string. `RegisterParams` is the create-submit payload (the fields
listed in the data-flow below). `RegisterResponse` captures the documented legacy fields:
`sso_token`, `token`, `applicationId`, `app_id`, `applicationStatus`, optional `tokens`.

### Pure helpers (`registration/country.ts`)

- `domainForCountry(country) = country.organization.name`
- `organizationIdForCountry(country) = country.organization.id`
- `filterCountries(countries)`: returns countries with `used !== false`, excluding
  `code3 === 'JPN'`, sorted by `name`.
- `getLanguageId(country)`: ported from the legacy `getLanguageId`; flagged to verify.
  Never throws; falls back to the English language id when unknown.

These are pure and unit-tested in isolation.

### Tracking (`registration/tracking.ts`)

`readTracking()` returns `{ afsAid?, utmLink?, source, visitorId?, referrerId? }` read from:
the `ibc` cookie (`{ type, pid }` → `afsAid = String(pid)`), `sessionStorage` (`utmLink`,
`parsedSource` → `source`, default `'TP3-LiveApp'`), `window.visitorId`, and the
`referrerId` cookie. Pure and unit-tested with mocked `document.cookie` / `sessionStorage`.

### Create call (`registration/api/registerApi.ts`)

- `createLiveAccount(params)`: `getHttpClient().tfboCall<RegisterResponse>('application',
  'incremental_submit', params, Authorize.No)`, unwrapping the envelope (status must be
  `OK`; `ALREADY_REGISTERED` surfaces as a typed error the form maps to an inline
  email-field message).
- `storeRegistrationAuth(res)`: a pure handler that calls
  `tokenStore.setTfbo(res.sso_token, res.token)` and, when `res.tokens` is present,
  `tokenStore.setAuthTokens(res.tokens)`. Unit-tested.

### Register form (`registration/components/RegisterForm.tsx`)

RHF + Zod, house style (`RHFTextField`, `FormProvider`, MUI `Stack`). Two steps held in
local state:

- `CredentialsStep`: `email` (required, valid email), `password` (complexity: min 8, upper
  + lower + digit), `confirmPassword` (must match). Next → step 2.
- `ResidencyStep`: `country` (select from `filterCountries(useCountries())`), `agreeToTerms`
  (required checkbox, with the C-2 T&C link placeholder), `marketingConsent` (checkbox,
  default false), `ibCode` (optional numeric, prefilled from the `ibc` cookie).

On submit: `captcha.execute()` → build `RegisterParams` → `useRegister().mutateAsync` →
`storeRegistrationAuth(res)` → `useSessionStore.getState().setLoggedIn(true)` →
`navigate({ to: '/onboarding' })`. On failure: `notify` + `captcha.reset()`;
`ALREADY_REGISTERED` → `setError('email', …)`.

### Email verification (`emailVerification/`)

- `sendOtpCode(profile)`: `tfboCall('emailvalidation', 'send_verification_code',
  { originCountry, accountHolderFirstName, accountHolderLastName, preferredLanguage,
  accountHolderEmail }, Authorize.Yes)`.
- `verifyOtpCode(otpValue, email)`: `tfboCall('emailvalidation', 'verify_otp_code',
  { otpValue, accountHolderEmail: email }, Authorize.Yes)`.
- `OtpInput`: six numeric inputs, paste-splits across fields, auto-advances focus, emits
  the joined value on completion.
- `EmailVerificationScreen`: loads the profile (`useUserProfile`), `useSendOtp` once on
  mount, renders `OtpInput` + a resend control; on verify success notifies and navigates
  to the landing route.

### Routing

```ts
// public — child of RootRoute
export const RegisterRoute = createRoute({ getParentRoute: () => RootRoute, path: '/account/register', component: RegisterScreen })
// authenticated — child of AuthenticatedRoute
export const VerifyEmailRoute = createRoute({ getParentRoute: () => AuthenticatedRoute, path: '/account/verify-email', component: EmailVerificationScreen })
```

`router.tsx` adds `RegisterRoute` to the root children and `VerifyEmailRoute` under
`AuthenticatedRoute`. The onboarding completion stub navigates to `/account/verify-email`.

## Data flow

```
/account/register (public, useCountries loaded)
  CredentialsStep -> ResidencyStep
  submit:
    token = captcha.execute()
    params = {
      accountHolderEmail, accountHolderPassword,
      originCountry: country.id,
      preferredOrganization: country.organization.id,
      portalAccountDomain: country.organization.name,
      agreeToAllTerms: true,
      isMarketingOptOut: !marketingConsent,
      accountType: 'individual',
      source, brand: 'ThinkMarkets',
      preferredLanguage: getLanguageId(country),
      afsAid?, utmLink?, visitorId?, referrerId?,
      recaptchaResponse: token,
    }
    res = createLiveAccount(params)            // application/incremental_submit, Authorize.No
    storeRegistrationAuth(res)                 // tokenStore.setTfbo(+setAuthTokens)
    useSessionStore.setLoggedIn(true)
    navigate('/onboarding')
        |
        v
/onboarding (UNCHANGED) -> loads app -> selectFlow(portalAccountDomain) -> flow completes
        |
        v
/account/verify-email (authed)
  useSendOtp(profile) on mount
  OtpInput -> verifyOtpCode(otp, email) -> success -> navigate(resolveLandingRoute(profile))
```

## Error handling

- Country query failure → an error state on the residency step (cannot select a country),
  retry available.
- Create-submit non-`OK` envelope → thrown by `unwrap`; the form notifies and resets the
  captcha. `ALREADY_REGISTERED` → inline email error.
- OTP send failure → notify + a manual resend control. OTP verify mismatch → inline error,
  the input clears for retry.
- `getLanguageId` and `filterCountries` never throw on unexpected data.
- Email (PII) is never attached to Sentry events; reuse the existing scrub.

## Testing

- **Unit:** `country.ts` (domain/org mapping; `filterCountries` excludes `JPN` and sorts;
  `getLanguageId` fallback); `tracking.ts` (cookie/sessionStorage/visitorId reads, defaults);
  `storeRegistrationAuth` (sets tfbo, conditionally sets auth tokens); `RegisterForm`
  validation (email format, password complexity, confirm match, T&C required); `OtpInput`
  (paste-split, auto-advance, completion value); `emailApi` payload shapes.
- **Integration:** register happy path (mocked create-submit) stores tokens, flips
  `loggedIn`, navigates `/onboarding`; `ALREADY_REGISTERED` inline error; email
  send-on-mount + verify-success navigation.
- **E2E (`--mode test`, plain HTTP):** `/account/register` → fill both steps → mocked
  create → lands `/onboarding`; `/account/verify-email` → enter OTP → success.

## Compliance

- T&C acceptance is a **required** checkbox; its link reuses the tracked **C-2** T&C/KID
  document placeholder (pre-production compliance blocker).
- Marketing defaults to **opt-out** (`isMarketingOptOut: true` unless consent ticked) —
  flagged for compliance confirmation.
- Password complexity enforced at registration.
- No fabricated values: `getLanguageId` and the language ids are ported from legacy and
  flagged to verify; the exact create-submit action, returned token shape, and OTP payloads
  are backend-verify follow-ups.
- The security/compliance review gate applies before sign-off.

## Definition of done

- An unauthenticated visitor completes `/account/register`, the account is created via the
  unauthenticated `incremental_submit`, the session is established (tokens stored,
  `loggedIn` true), and they land in the correct onboarding flow for their country's
  `organization.name`.
- After onboarding completion the visitor reaches `/account/verify-email`, an OTP is sent, and a
  correct code verifies the address.
- `country.ts`, `tracking.ts`, `storeRegistrationAuth`, `RegisterForm`, `OtpInput`, and the
  email API are unit-tested; integration and e2e cover the happy paths and the
  `ALREADY_REGISTERED` case.
- Lint, unit/component/integration tests, and the e2e pass under Node 20.
- Onboarding code is unchanged apart from the one-line completion-stub navigation.
- Security/compliance review completed; deferred and backend-verify items tracked.

## Risks and notes

- **Token shape on create:** the legacy `IncrementalSubmitResponse` exposes `sso_token` +
  `token`; whether the live create also returns Keycloak OAuth tokens (for the `Bearer`
  header used by REST/auth calls) is unconfirmed. `storeRegistrationAuth` stores the tfbo
  pair and conditionally any `tokens`; if `Bearer`-authenticated calls fail post-register,
  the backend contract for the returned token set must be confirmed. Backend-verify.
- **Minimal create payload:** whether the backend accepts a create `incremental_submit`
  before personal info (name/DOB) is unconfirmed; if it requires more, the create may need
  to defer to the onboarding personal step (which would reopen the onboarding entry —
  explicitly out of scope here). Backend-verify.
- **`getLanguageId` / language ids:** ported from legacy; confirm the country→language id
  mapping with backend.
- **`emailVerified` profile field:** absent from the current `UserProfile`; needed for the
  eventual login-time gate. Deferred with the dashboard slice.
- **Deferred filters/sub-steps** (EU-geo, IB whitelist, Capital-Index, AU/UAE sub-steps)
  are explicit, tracked follow-ups.

# Social Registration (Google and Apple) - Phase B Design

**Date:** 2026-06-28
**Status:** Approved for planning
**Effort:** Registration/onboarding reconciliation. **Phase B of 2** (Phase A = email/password Simplified path, merged: `docs/superpowers/specs/2026-06-28-simplified-registration-onboarding-reconciliation-design.md`).
**Reference:** Legacy portal-2.0 social flow (read-only research). Key legacy files: `services/keycloakAuth.ts`, `ui-4.0/components/SocialButton/*`, `components/Container/Onboarding/SocialRegistration/index.tsx`, `utils/api.ts`.

## Overview

Phase A reconciled the email/password Simplified path and left a deliberate seam: `submitInitialApplication(payload)` creates the application once auth is established, and the auth-establishment step is pluggable so a social path can swap only that half. Phase B fills that seam for Google and Apple registration.

The verified legacy approach uses **no client-side provider SDK**. It delegates all provider OAuth to **Keycloak acting as an identity broker** via a PKCE authorisation-code redirect with `kc_idp_hint=google|apple`. The browser exchanges the returned code for tokens directly with Keycloak, then asks the portal auth-adapter whether the user needs registration (`GET /auth/profile/status`). New users complete a short data-collection screen and create an application through the same `simplified_submit_level_one` call as the email/password path; returning users are routed straight to their post-login landing.

## Goal

A new user can register with Google or Apple and proceed into the existing onboarding flow, and a returning social user can sign in, both against the real backend, matching the legacy screen order and endpoints.

## Decisions (settled during brainstorming)

- **Providers:** Google and Apple, both built fully in this slice.
- **Auth approach:** Keycloak identity-broker (PKCE redirect with `kc_idp_hint`); no provider SDKs or secrets in the SPA.
- **Redirect UX:** Full-page redirect only (no popup, no cross-window messaging); a `/account/callback` route handles the return. Works identically on desktop and mobile.
- **Login branch:** This slice includes the returning-user login branch, not only new-user registration. The same social button serves both; the branch is intrinsic to the callback.
- **Collection screen:** A dedicated `/account/social-registration` screen, separate from the Phase A `/account/personal-information` screen.

## Non-goals

- Demo social registration (`{AUTH_URL}/auth/register/demo`).
- Facebook and other providers (legacy supports them via the same `kc_idp_hint`, but this slice is scoped to Google and Apple).
- Account-linking UX (linking a social identity onto an existing email/password account). This is backend-driven and not built here.
- Changes to the onboarding flows themselves (`SimplifiedFlow`/`GeneralFlow`) beyond reusing them unchanged.

## Architecture

The browser delegates provider authentication to Keycloak; only the application-create half is shared with Phase A. The flow has four boundaries: initiate, provider auth (external), callback, and collection.

### 1. Initiate (public, from `/account/register` and the login screen)

The social buttons render on both the registration entry screen and the login screen. On click:

- Generate a PKCE `code_verifier` (high-entropy random string) and derive `code_challenge` using SHA-256 (S256), via the Web Crypto API.
- Generate a random `state` value for CSRF protection.
- Persist `{ codeVerifier, state, provider, returnTo }` in `sessionStorage` (survives the full-page redirect; cleared after the callback consumes it).
- Full-page navigate to:
  `{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/auth?client_id={KEYCLOAK_CLIENT_ID}&redirect_uri={origin}/account/callback&response_type=code&scope=openid profile email&code_challenge={challenge}&code_challenge_method=S256&state={state}&kc_idp_hint={provider}`.

`provider` is `google` or `apple`. No provider client IDs live in the front-end; those are configured in Keycloak's identity-provider settings.

### 2. Provider auth (external)

Keycloak runs the provider-specific OAuth dance server-side and redirects the browser back to `{origin}/account/callback?code={code}&state={state}` (or with `error`/`error_description` on failure or cancellation).

### 3. Callback (`/account/callback`, public)

- Read `{ codeVerifier, state, provider, returnTo }` from `sessionStorage`; clear them.
- If Keycloak returned `error`, route back to `/account/register` with an inline message.
- Validate that the returned `state` equals the stored `state`; on mismatch, reject as a possible CSRF and route back to `/account/register` with a generic error.
- Exchange the code for tokens directly with Keycloak:
  `POST {KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token`, `Content-Type: application/x-www-form-urlencoded`, body `grant_type=authorization_code&code={code}&redirect_uri={origin}/account/callback&client_id={KEYCLOAK_CLIENT_ID}&code_verifier={codeVerifier}`. Returns `{ access_token, refresh_token, id_token, expires_in, ... }`.
- Call `GET {AUTH_URL}/auth/profile/status` with `Authorization: Bearer {id_token}`. Returns `{ needsCompletion: boolean, missing?: string[] }`.
- Branch:
  - `needsCompletion === false` (**returning user**): establish the portal session and route to the post-login landing, reusing the Phase A post-login landing logic (`/dashboard` for approved users, onboarding otherwise). See open question 1 on the exact token/session model.
  - `needsCompletion === true` (**new user**): decode the id_token claims, seed a social draft, and route to `/account/social-registration`.

The id_token is preferred over the access_token for all bearer calls. Apple access tokens issued through Keycloak may lack `sub`/`email`, which causes auth-adapter 401s; the id_token is reliably populated.

### 4. Social registration (`/account/social-registration`, public)

Guard: if there is no social draft (no id_token in the store), redirect to `/account/register`.

Collects only what the provider token does not supply:

- **Country of residence** (required). Derives `preferredOrganization`, `portalAccountDomain`, and `preferredLanguage` using the same country-to-domain logic as Phase A.
- **Terms consent** (`agreeToAllTerms`, required) and **marketing opt-out** (`isMarketingOptOut`) per the existing consent block.
- **Name, date of birth, title** are collected **only when the id_token lacks `given_name` or `family_name`** (the Apple-first-authorisation case). When the token supplies the name, these fields are not shown.

On submit, call the create-account seam (below), then navigate to `/onboarding`.

### 5. Onboarding (`/onboarding`, authenticated)

Unchanged from Phase A. The social create has set tokens and `loggedIn`, seeded name/DOB and `applicationId` into the onboarding store, and the user enters the same `SimplifiedFlow`/`GeneralFlow` selected by the country. There is no separate social onboarding path.

## The create-account seam (extends Phase A)

Phase A's shared half is reused untouched:

```
submitInitialApplication(payload: Partial<AppInfo>): Promise<number>   // existing, unchanged
```

Phase B adds the social auth-establishment half:

1. **Establish auth (social).** `socialRegister(idToken, params)` posts to the portal auth-adapter with the Keycloak id_token as a bearer credential (no password). On success it returns the portal `AuthTokens`; store them via `tokenStore.setAuthTokens` and set `sessionStore.loggedIn = true`.
2. **Create the application (shared).** `submitInitialApplication(appInfoPayload)` with the same `AppInfo` shape as the email/password path: `accountHolderEmail`, `originCountry`, `preferredOrganization`, `portalAccountDomain`, `preferredLanguage`, name and DOB fields, `accountHolderTitle`, `agreeToAllTerms`, `isMarketingOptOut`, `accountType: 'individual'`, `accountTradingTypes: [1]`, `brand: 'ThinkMarkets'`, `source`. There is no `recaptchaResponse` on the social path (the provider OAuth is the human check); confirm this against the backend during verification.

A new orchestrating function, `createSocialAccount(input)`, performs steps 1 and 2 and returns `{ applicationId }`. The two seams sit side by side: `createSimplifiedAccount` (email/password, Phase A) and `createSocialAccount` (social, Phase B), both ending in the shared `submitInitialApplication`.

## API changes

- **Add** `socialRegister(idToken: string, params: SocialRegisterParams): Promise<AuthResult>` in the auth api: `POST {AUTH_URL}/auth/register`, `Authorization: Bearer {idToken}`, body field names exactly: `email_id`, `first_name`, `last_name`, `country` (originCountry id), `account_holder_title` (optional), `brand`, `source` (optional), `visitorId` (optional). No `password`. Returns `{ status, tokens?, code?, description? }` like the email/password `registerUser`.
- **Add** `checkProfileStatus(idToken: string): Promise<{ needsCompletion: boolean; missing?: string[] }>`: `GET {AUTH_URL}/auth/profile/status`, `Authorization: Bearer {idToken}`.
- **Add** a Keycloak broker module (no portal-api dependency): build-auth-URL, PKCE generation, code-for-token exchange, id_token claim decoding.
- **Reuse** `submitInitialApplication` (`simplified_submit_level_one`) and the Phase A post-login landing logic.

## Components and files

New:

- `src/features/auth/social/keycloakBroker.ts` - PKCE generation (Web Crypto S256), `buildAuthUrl(provider, redirectUri)`, `exchangeCodeForTokens(code, codeVerifier, redirectUri)`, `decodeIdTokenClaims(idToken)` (email falls back to `preferred_username`; name from `given_name`/`family_name`).
- `src/features/auth/social/SocialButtonsSection.tsx` and `SocialButton.tsx` - rendered on `/account/register` and the login screen.
- `src/features/auth/components/SocialCallback.tsx` and `src/features/auth/routes/callback.tsx` - the `/account/callback` handler (state validation, token exchange, profile-status branch).
- `src/features/registration/components/SocialRegistrationForm.tsx` and `src/features/registration/routes/socialRegistration.tsx` - the `/account/social-registration` screen.

Modified:

- `src/features/auth/api/authApi.ts` and `authTypes.ts` - add `socialRegister`, `checkProfileStatus`, and their param/result types.
- `src/features/registration/api/createAccount.ts` - add `createSocialAccount`.
- `src/features/registration/state/registrationStore.ts` - add an in-memory `socialDraft` (`idToken`, decoded claims, provider); never persisted to localStorage.
- `src/router.tsx` - register `/account/callback` and `/account/social-registration` routes (both public).

## Data flow and state

Between the callback and the social-registration screen, a `socialDraft` holds the id_token, decoded claims (email, optional name), and provider. It lives only in memory (Zustand), never localStorage, and is cleared after the create succeeds. The PKCE `codeVerifier` and `state` live in `sessionStorage` only between initiate and callback, and are cleared once the callback consumes them.

**Security note (regulated context):** the id_token is a bearer credential. It is held in memory for the brief window between callback and create, and is not written to localStorage. Standard risk disclosure and consent requirements for the registration screens are inherited from the existing flow.

## Error handling

- Keycloak returns `error`/`error_description` (user cancelled, access denied): route to `/account/register` with an inline message; do not advance.
- `state` mismatch: reject as a possible CSRF; route to `/account/register` with a generic error.
- Code-for-token exchange failure: inline error on the callback transition; route back to `/account/register`.
- `checkProfileStatus` failure: surface an inline error and allow a retry; do not silently strand. (Legacy logs and defaults `needsCompletion` to false; portal-3.0 should not assume a logged-in state on an errored check.)
- `socialRegister` non-OK (ASE codes such as already-registered): inline error on the social-registration screen; stay on the screen.
- There is no notification renderer yet, so all errors are surfaced inline, consistent with Phase A.

## Testing

- **Unit:** PKCE builder derives the S256 challenge correctly; `decodeIdTokenClaims` reads email from `preferred_username` when `email` is absent and reports missing names; the callback branch routes correctly for both `needsCompletion` outcomes; `socialRegister` posts the correct bearer-authenticated body with no password; `checkProfileStatus` posts the bearer id_token; `createSocialAccount` calls `socialRegister` then `submitInitialApplication` in order, stores tokens, sets `loggedIn`; `SocialRegistrationForm` shows name/DOB only when the token lacks names and otherwise hides them; the social-registration guard redirects when there is no social draft.
- **e2e (Playwright, mocked):** stub the Keycloak token endpoint, `/auth/profile/status`, `/auth/register` (bearer), and `simplified_submit_level_one`. Drive the new-user path (Apple, names missing in the token, so the screen collects them) through to `/onboarding`, and the returning-user path (`needsCompletion: false`) through to the post-login landing. The full-page redirect to Keycloak is mocked at the route boundary; the real Keycloak cannot be driven in Playwright.
- **Live (manual):** verify the open questions below against UAT before and during the build, as was done for Phase A.

## Live UAT verification (2026-06-28)

Probed the real UAT auth infrastructure directly (read-only, no credentials, no client data). Results, with the corrections they imply:

**Confirmed:**

- **Host:** the real auth and Keycloak host is `https://uat-auth-new.thinkmarkets.com` (both the portal-3.0 dev proxy and the legacy proxy target it for `/auth` and `/realms`). The OIDC discovery document at `…/realms/thinkmarkets/.well-known/openid-configuration` returns HTTP 200 and lists S256 in `code_challenge_methods_supported`, so PKCE S256 is supported.
- **Realm:** `thinkmarkets` (correct in our env).
- **Google and Apple brokers are both enabled.** With a valid PKCE challenge, the correct client, and an allow-listed redirect URI, `…/openid-connect/auth?...&kc_idp_hint=google` returns `303 → …/realms/thinkmarkets/broker/google/login`, and `kc_idp_hint=apple` returns `303 → …/broker/apple/login`. A control hint of `facebookX` returned the plain login page (HTTP 200, no broker redirect), confirming the broker redirect fires only for genuinely configured providers.
- **`/auth/profile/status` exists** on `uat-auth-new`: without a bearer it returns `HTTP 401 {"code":"ASE-002","description":"Unauthorized"}`. The new-vs-returning gate is real and bearer-protected, and the auth-adapter validates the bearer token.

**Corrections to the current config (must fix before the social flow can work):**

1. **Client id is `web-app`, not `portal-web`.** On `uat-auth-new`, `client_id=portal-web` returns HTTP 400 "Client not found"; `client_id=web-app` returns the login form (HTTP 200). The current `.env.uat` and `.env.development` set `VITE_KEYCLOAK_CLIENT_ID=portal-web`, which is wrong for the Keycloak browser flow. (It does not affect the auth-adapter REST endpoints, which is why email/password registration still works.) Legacy `config.dev.json` confirms `KEYCLOAK_CLIENT_ID: "web-app"`.
2. **`.env.uat` host is wrong.** It sets `AUTH_URL`/`KEYCLOAK_URL` to `uat-auth.thinkmarkets.com` (no `-new`), which returns 404 for the realm and `/auth/profile/status`. The correct host is `uat-auth-new.thinkmarkets.com`. The file already carries a `# TODO confirm UAT URLs with backend` note. (Dev mode is unaffected because the dev proxy targets `uat-auth-new` directly.)
3. **Redirect URI allow-list.** The `web-app` client accepts `https://portal-uat.thinkmarkets.com/account/callback`, `https://portal-staging.thinkmarkets.com/account/callback`, and the production origin, but **rejects `https://portal-test.thinkmarkets.com/account/callback`** (the local dev origin) with "Invalid parameter: redirect_uri". Local dev testing of the social flow is therefore blocked until the backend/Keycloak team allow-lists the `portal-test` callback URI for the `web-app` client (or we test against an allow-listed origin).

## Open questions (remaining after verification)

1. **Session/token model for the returning-user branch (primary residual item).** The auth-adapter accepts the Keycloak id_token as a bearer credential (proven by `/auth/profile/status`), and legacy simply sets logged-in for returning users without a separate token-exchange call, which implies the Keycloak tokens from the code exchange become the session and are stored for subsequent auth-adapter and TFBO calls. What is not yet proven headlessly is the exact `tokenStore` wiring: whether the Keycloak `access_token`/`id_token` drive the TFBO `/cportal/nsdata` session the same way the email/password portal tokens do, and whether the social `/auth/register` returns its own portal tokens to store instead. Resolve with one real social login in the UAT browser (a real Google/Apple account is required; this cannot be driven in Playwright) or a backend confirmation, before coding the callback branch.
2. **`simplified_submit_level_one` for a social applicant.** Legacy `buildAppInfo` sends no `recaptchaResponse` on the social create, so the provider OAuth is expected to satisfy the human check. Confirm against the backend during the build that the social create omits `recaptchaResponse` and needs no field the email/password path omits.

## Definition of done

- Social buttons on `/account/register` and the login screen initiate a Keycloak PKCE redirect with `kc_idp_hint` for Google and Apple.
- `/account/callback` validates `state`, exchanges the code for tokens, calls `/auth/profile/status`, and branches: returning users reach their post-login landing; new users reach `/account/social-registration`.
- `/account/social-registration` collects country and consent, conditionally collects name/DOB/title when the token lacks names, creates the account via bearer `/auth/register` + `simplified_submit_level_one`, and authenticates the user.
- A new Google or Apple user reaches the onboarding steps; a returning social user reaches their landing, both against the real backend.
- The create-account seam reuses `submitInitialApplication` unchanged; only the auth-establishment half is social-specific.
- The id_token is never persisted to localStorage.
- All suites green (lint, tsc, vitest, playwright).

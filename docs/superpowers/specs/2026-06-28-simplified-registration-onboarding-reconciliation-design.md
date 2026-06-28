# Simplified Registration + Onboarding Reconciliation — Phase A (email/password) Design

**Date:** 2026-06-28
**Status:** Approved for planning
**Effort:** Registration/onboarding reconciliation with legacy + real backend. **Phase A of 2** (Phase B = social Google/Apple registration, separate spec).
**Reference:** `docs/superpowers/research/2026-06-28-legacy-registration-onboarding-flow.md` (legacy map + live verification).

## Overview

portal-3.0's registration creates the account by calling `application/incremental_submit` at the country-selection step. Verified against the real UAT backend, that call returns **SYS_ERR**: it is the wrong action, sent before name/DOB exist, and with no prior auth user. The correct, live-verified sequence is:

1. `POST {AUTH_URL}/auth/register` — creates the auth (Keycloak) user and returns tokens.
2. `application/simplified_submit_level_one` (Authorize.Yes, using those tokens) — creates the application. **Confirmed live**: returned `{ applicationId: 10508821 }` for a Nigeria/TMLC applicant.

A second live-confirmed bug: when `getLastApplicationsInfo` is empty (a brand-new application), `loadApplication` returns `undefined`, which both trips a TanStack "data cannot be undefined" error and strands `OnboardingScreen` on "Loading your application…".

This phase reconciles the **email/password Simplified path** (TMLC / `isSimplifyOnboarding` countries, e.g. Nigeria) with that real flow, and introduces a **create-account seam** so social (Phase B) plugs in without rework.

## Goal

A new user registering with a Simplified-flow country can create an account and proceed through Simplified onboarding against the real backend, matching legacy's screen order and endpoints.

## Non-goals

- **Social Google/Apple registration** — Phase B (separate spec); only the shared seam is designed here.
- General / UK / AU (appropriateness) flows.
- Reworking the email-verification gate beyond ensuring it does not block the simplified create (NG has `forceEmailValidate: false`).
- Document/KYC upload, dashboard.

## Architecture — the auth boundary drives the structure

The account is not authenticated until `/auth/register` returns tokens, so the create cannot happen inside the auth-guarded `/onboarding`. Three phases, matching legacy:

### 1. Registration (`/account/register`, public)
`RegisterForm` collects **email, password, country** (+ derived `preferredOrganization`, `portalAccountDomain`, `preferredLanguage`, `agreeToAllTerms`, `isMarketingOptOut`). On "Continue/Next":
- **No backend call.** Store the collected data in a registration draft (the onboarding Zustand store, in memory; the password is never persisted to localStorage).
- Navigate to `/account/personal-information`.
- **Remove** the `createLiveAccount` (`incremental_submit`) call and the `storeRegistrationAuth`-from-`incremental_submit` token handling.

### 2. Personal Information (`/account/personal-information`, NEW, public)
Collects `accountHolderFirstName`, `accountHolderLastName`, DOB (`accountHolderDayOfBirth/MonthOfBirth/YearOfBirth`), and `accountHolderTitle` (default `Mr`). Guard: if the registration draft has no email, redirect to `/account/register`. On submit:
- Run the invisible captcha → `recaptchaResponse`.
- Call the **create-account seam** (below). On success: tokens are stored, `sessionStore.loggedIn = true`, the draft is seeded with name/DOB + the returned `applicationId`.
- Navigate to `/onboarding`.

### 3. Onboarding (`/onboarding`, authenticated)
Unchanged structure (`SimplifiedFlow`). Because the draft already has name/DOB, the step engine's `getStartingStep` skips the completed `PersonalInfo` step and starts at **phone → platform → terms**, then Level 2. Two fixes:
- **Per-step submit action:** use `simplified_submit_level_one` for each Level 1 step advance and `simplified_submit_level_two` for each Level 2 step (matching legacy), instead of the current `application_submit`/incremental call between steps.
- **Empty-application tolerance:** `loadApplication` must never return `undefined` (return `null`); `OnboardingScreen` must not strand when the form blob is empty — it drives `selectFlow` and the flow from the registration draft (which carries `portalAccountDomain`/`originCountry`) and the `check_application_statuses` status.

## The create-account seam (shared with Phase B)

A single service/hook, e.g. `createSimplifiedAccount`, with two responsibilities:
1. **Establish auth.** Phase A: `registerUser({ email_id, password, first_name, last_name, country, account_holder_title, preferred_language_code, brand, source })` → `POST {AUTH_URL}/auth/register` (Authorize.No) → store the returned tokens (`tokenStore.setAuthTokens`) + `sessionStore.setLoggedIn(true)`. *(Phase B swaps this half for a social `socialRegister(idToken, …)` exchange.)*
2. **Create the application.** `simplified_submit_level_one` (Authorize.Yes) with the full payload: `accountHolderEmail`, `accountHolderPassword`, `originCountry`, `accountHolderFirstName`, `accountHolderLastName`, DOB fields, `accountHolderTitle`, `agreeToAllTerms`, `brand: 'ThinkMarkets'`, `source`, `preferredLanguage`, `accountType: 'individual'`, `accountTradingTypes: [1]`, `isMarketingOptOut`, `recaptchaResponse`.

Returns `{ applicationId }`. The auth-establishment step is the only part that differs between email/password (Phase A) and social (Phase B); the application-create step is shared. The seam exposes the auth step as a pluggable function so Phase B does not touch the create-app half.

## API changes

- **Add** `registerUser(params): Promise<AuthResult>` in the auth api → `POST {AUTH_URL}/auth/register`, Authorize.No, body field names exactly: `email_id`, `password`, `first_name`, `last_name`, `country` (originCountry id), `account_holder_title`, `preferred_language_code`, `brand`, `source`. Returns `{ status, tokens }` like `login`.
- **Reuse** the existing `submitLevelOne` / `submitLevelTwo` (`simplified_submit_level_one`/`_two`) onboarding-api functions.
- **Remove** the registration `createLiveAccount` (`incremental_submit`) path and `storeRegistrationAuth`'s dependency on the `incremental_submit` envelope.
- **Fix** `loadApplication` to return `null` (not `undefined`) on an empty/non-array payload.

## Data flow / state

The registration draft (email, password, originCountry, preferredOrganization, portalAccountDomain, preferredLanguage, agreeToAllTerms, isMarketingOptOut) is held in the onboarding Zustand store between `/account/register` and `/account/personal-information`, then augmented with name/DOB at the create step. **Security:** the password lives only in memory (store), never in localStorage; it is cleared after the create succeeds. (Legacy holds it in redux similarly.)

## Error handling

- `/auth/register` failure (e.g. email already registered → ASE code) → show an inline error on the Personal Information (or back on registration) screen; do not advance. (Note: there is no notification renderer yet, so errors must be surfaced inline, not via the notification store.)
- `simplified_submit_level_one` non-OK → inline error, stay on the screen, reset captcha; the auth user may exist but the app does not — re-submit is safe (idempotent create by email).
- Onboarding: empty `getLastApplicationsInfo` is normal for a fresh app — proceed from the draft, never strand.

## Testing

- **Unit:** `registerUser` posts the correct `auth/register` body; the `createSimplifiedAccount` seam calls register then `simplified_submit_level_one` in order, stores tokens, sets `loggedIn`, seeds the draft; `RegisterForm` makes no backend call and navigates to `/account/personal-information` with the draft set; the Personal Information screen runs the seam and navigates to `/onboarding`; `loadApplication` returns `null` (not `undefined`) on empty; `OnboardingScreen` does not strand on an empty form blob; `SimplifiedFlow` uses `simplified_submit_level_one`/`_two` per step.
- **e2e (Playwright, mocked nsdata/auth):** register with a Simplified-country → personal information → create (mock `auth/register` OK + `simplified_submit_level_one` → applicationId) → land on `/onboarding` showing the next step (phone), with `getLastApplicationsInfo` mocked empty and `check_application_statuses` → INCOMPLETE.
- **Live (manual):** the create sequence is already verified against UAT; re-confirm the end-to-end UI path once built.

## Open questions (carry into the plan / resolve during build)

1. Minimum required fields for `simplified_submit_level_one` at create vs at completion (`completed: true`) — we have a working create set; completion/Level-2 may need more.
2. `accountTradingTypes: [1]` — confirm the correct value(s) per the backend.
3. Email-verification gate (`isemail_verification_required`) interaction with the simplified completion for forced-email countries (NG is not forced; documented for later).
4. `domainForCountry`/`organizationIdForCountry` correctness for TMLC (live test used originCountry 158 / org 14 / TMLC successfully).

## Definition of done

- Registration makes no backend call; collects email/pw/country and routes to Personal Information.
- The Personal Information screen creates the account via `/auth/register` + `simplified_submit_level_one` and authenticates the user.
- An empty `getLastApplicationsInfo` no longer strands onboarding; the Simplified flow proceeds (phone → platform → terms → Level 2) via `simplified_submit_level_*`.
- The create-account seam isolates the auth-establishment step so Phase B (social) can plug in.
- A new user with a Simplified-flow country can register and reach the onboarding steps against the real backend.
- All suites green (lint, tsc, vitest, playwright).

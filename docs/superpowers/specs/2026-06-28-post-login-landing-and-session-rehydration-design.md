# Post-login Landing (real application status) + Session Rehydration Design

**Date:** 2026-06-28 (revised after inspecting real UAT traffic)
**Status:** Approved for planning
**Type:** Bug fix (auth/onboarding -> dashboard handoff)

## Overview

Two confirmed bugs prevent an approved user from reaching the dashboard. Both root causes were verified against real UAT responses (HAR capture + a live `check_application_statuses` call for an approved test account).

- **Bug B (primary):** After login an approved user lands on `/onboarding`. The real backend does **not** return an application lifecycle status on `getLastApplicationsInfo` — that call returns the application *form data* plus `completed`/`appropriatenessLevel` only. The actual status lives in a separate call, **`check_application_statuses`** (module `application`), which portal-3.0 never makes. `OnboardingScreen` reads `app.status` (absent), defaults it to `INCOMPLETE`, and shows the onboarding flow. (The mocked tests passed only because they fabricated a `status` field.)
- **Bug A (secondary):** `sessionStore.loggedIn` is an in-memory flag set only during the login/2FA/register flows and never rehydrated from persisted tokens on boot (`sessionStore.ts:10`). A full page load (typing `/dashboard`, or refreshing any authenticated route) resets it to `false`, so `AuthenticatedRoute` (`authenticated.tsx:9`) redirects to login despite valid tokens.

### Verified real responses
`check_application_statuses` (approved test account, array; last item = latest):
```json
[{ "application_id": "10508621", "application_type": "individual",
   "application_status": "APPROVED", "organization_id": "14",
   "appropriateness_level": "PASS", "preKycRequired": true,
   "client_boarded_green_id": false, "green_id_status": "" }]
```
`getLastApplicationsInfo` returns the form blob: `applicationId`, `completed: true`, `appropriatenessLevel: "PASS"`, `accountHolder*`, `accountType`, `selectedPlatform`, ... and **no** status field. `get_user` also returns `approved: true`, but per the chosen approach the status source is `check_application_statuses` (the application-level lifecycle, matching legacy `landUser`).

## Goal

Approved users land on `/dashboard` after login (even with a newer in-progress application); non-approved users are routed by their *real* application status; a valid persisted session survives reloads / direct navigation.

## Non-goals

- Porting the full legacy `landUser` graph (accounts/`userApps`/IB/demo/`landingPage`, pre-KYC document sub-states). We adopt its application-status decision, not its account model.
- New onboarding status branches beyond those that already exist (`DENIED`/`FAILED`, `LEVEL1_APPROVED`, `PENDING_KYC`/`PENDING_REVIEW`, default flow). `preKycRequired`/green-id handling is out of scope.
- `keepSignedIn`-conditioned persistence semantics (token validity alone governs rehydration).

## Bug B — real application status

### Data layer (reuse `getLastApplicationsInfo`, add `check_application_statuses`)
- Keep `loadApplication()` (form blob from `getLastApplicationsInfo`) — still needed for the draft, `applicationId`, and `selectFlow` (`portalAccountDomain` etc.).
- Add `loadApplicationStatuses(): Promise<ApplicationStatusResponse[]>` -> `tfboCall('application', 'check_application_statuses', {}, Authorize.Yes)`; returns the array (`[]` on a non-array payload).
- New type `ApplicationStatusResponse` (snake_case from the backend): `application_id: string`, `application_type: string`, `application_status: string`, `organization_id: string`, `appropriateness_level: string`, `preKycRequired: boolean`, `client_boarded_green_id: boolean`, `green_id_status: string`.

### Decision (in `OnboardingScreen`)
- `hasApproved = statuses.some((s) => s.application_status === 'APPROVED')`.
- `latestStatus = statuses[statuses.length - 1]?.application_status`.
- Render order:
  1. While either the form load or the status load is pending -> loading.
  2. `hasApproved` -> redirect `/dashboard` (the existing `ApprovedRedirect`). This is the confirmed rule: any approved application wins, even alongside a newer incomplete one.
  3. Otherwise branch on `latestStatus` (the real status) using the form `app` for `applicationId`/draft/`selectFlow`:
     - `DENIED` / `FAILED` -> not-approved message
     - `LEVEL1_APPROVED` (and draft not completed) -> resume level two (`Level1Done`)
     - `PENDING_KYC` / `PENDING_REVIEW` -> processing / verify (`OnboardingComplete`)
     - otherwise (`INCOMPLETE`, unknown, or no status) -> flow selection (`SimplifiedFlow` / `GeneralFlow` / unsupported)

The previous reliance on `app.status` is removed; status now comes from `check_application_statuses`. `resolveLandingRoute` stays `/onboarding` (the single decision point remains `OnboardingScreen`).

## Bug A — session rehydration

- Add `tokenStore.hasValidSession(): boolean` — true when a refresh token is present **and** `validUntil` parses to a future date. Missing token / empty / unparseable / past -> false.
- `sessionStore`'s initial `loggedIn` derives from `tokenStore.hasValidSession()` at store creation, restoring an authenticated session across reloads. `setLoggedIn`, `reset`, logout, and the inactivity timeout are unchanged.

## Architecture

Unchanged flow: login -> `resolveLandingRoute(profile)` (still `/onboarding`) -> `OnboardingScreen` dispatches. `OnboardingScreen` stays the single landing decision point; it now reads the real status from `check_application_statuses` (in addition to the form blob it already loads). No new route.

## Error handling

- Status load fails -> `statuses` `[]` -> `hasApproved` false, `latestStatus` undefined -> onboarding flow (safe; a transient failure shows loading then onboarding rather than wrongly exposing a dashboard).
- Session rehydration failure -> `loggedIn` false (fail-safe; the existing refresh-on-API-call path still applies).

## Testing

- **Unit — `tokenStore.hasValidSession()`:** future `validUntil` + refresh token -> true; expired -> false; missing token -> false; empty/garbage `validUntil` -> false.
- **Unit — `sessionStore` rehydration:** valid token seeded -> fresh import yields `loggedIn === true`; none -> false; past `validUntil` -> false (seed localStorage, `vi.resetModules()`, dynamic import).
- **Unit — `loadApplicationStatuses`:** posts `check_application_statuses` with `Authorize.Yes` and returns the array; non-array payload -> `[]`.
- **Unit — `OnboardingScreen`:** statuses `[{ application_status: 'APPROVED' }]` (and `[APPROVED, INCOMPLETE]`) -> redirect `/dashboard`; `[{ application_status: 'PENDING_KYC' }]` -> processing; `[{ application_status: 'INCOMPLETE' }]` -> flow. Update existing OnboardingScreen/SimplifiedFlow test mocks to supply `useApplicationStatuses`.
- **e2e:** approved user (mock `check_application_statuses` -> `[{ application_status: 'APPROVED' }]`) logs in -> `/dashboard`. Existing onboarding/auth specs add a `check_application_statuses` branch returning a non-approved status (e.g. `INCOMPLETE`) so they still land on onboarding.

## Definition of done

- portal-3.0 calls `check_application_statuses`; `OnboardingScreen` redirects to `/dashboard` when any application is `APPROVED`, and routes non-approved users by their real latest `application_status`.
- An approved account (incl. one with a newer in-progress application) lands on `/dashboard` after login.
- A valid persisted session survives a reload / direct navigation to an authenticated route.
- All suites green (lint, tsc, vitest, playwright).

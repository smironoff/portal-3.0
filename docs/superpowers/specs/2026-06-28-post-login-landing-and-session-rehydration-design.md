# Post-login Landing (hasApproved) + Session Rehydration Design

**Date:** 2026-06-28
**Status:** Approved for planning
**Type:** Bug fix (auth/onboarding -> dashboard handoff)

## Overview

Two related, confirmed bugs prevent an approved user from reaching the dashboard:

- **Bug B (primary):** After login an approved user lands on `/onboarding` instead of `/dashboard`. `getLastApplicationsInfo` returns the full `AppInfo[]`, but `loadApplication` keeps only `apps[apps.length - 1]` (`onboardingApi.ts:17`) and `OnboardingScreen` redirects to `/dashboard` only when that single latest app's `status === 'APPROVED'`. An approved account with a newer in-progress application (the confirmed real scenario) therefore routes to onboarding. Legacy's `landUser` instead uses `hasApproved` (any application with status `APPROVED`) and sends such users to the dashboard.
- **Bug A (secondary):** `sessionStore.loggedIn` is an in-memory flag set only during the login/2FA/register flows and never rehydrated from persisted tokens on boot (`sessionStore.ts:10`). Any full page load (typing `/dashboard`, or refreshing any authenticated route) resets it to `false`, so `AuthenticatedRoute` (`authenticated.tsx:9`) redirects to login even with valid tokens in localStorage.

This slice fixes both so an approved user lands on, and stays on, the dashboard.

## Goal

Approved users land on `/dashboard` after login regardless of a newer in-progress application; a valid persisted session survives reloads and direct navigation.

## Non-goals

- Porting the full legacy `landUser` graph (accounts/`userApps`/IB/demo/`landingPage`). portal-3.0 has no accounts model yet.
- Changing behaviour for non-approved users (their current per-status onboarding/verify handling is unchanged).
- A separate landing route/component. `OnboardingScreen` remains the post-login dispatcher.
- `keepSignedIn`-conditioned persistence semantics (token validity alone governs rehydration this slice).

## Bug B — landing logic (hasApproved)

### Data layer
Reuse the existing `getLastApplicationsInfo` call (no new endpoint). Expose the full array and a derived verdict instead of only the last app:

- `loadApplications(): Promise<AppInfo[]>` returns the full array (or `loadApplication` is augmented to surface the array). Empty/invalid response -> `[]`.
- Derived values consumed by the screen:
  - `hasApproved = apps.some((a) => a.status === 'APPROVED')`
  - `current` = the application to resume for non-approved users = the latest application (`apps[apps.length - 1]`), preserving today's behaviour for that path.

The TanStack Query hook returns `{ current, hasApproved, isLoading }` (exact shape finalised in the plan).

### OnboardingScreen decision
1. While loading -> existing loading state.
2. If `hasApproved` -> redirect to `/dashboard` (replaces the narrow single-app `status === 'APPROVED'` check; the existing `ApprovedRedirect` component is reused).
3. Otherwise, decide from `current` exactly as today:
   - `DENIED` / `FAILED` -> not-approved message
   - `LEVEL1_APPROVED` (and not completed) -> resume level two (`Level1Done`)
   - `PENDING_KYC` / `PENDING_REVIEW` -> processing / verify (`OnboardingComplete`)
   - otherwise -> flow selection (`SimplifiedFlow` / `GeneralFlow` / unsupported), driven by `current`'s `applicationId`.

Non-approved/unknown statuses keep today's flow-selection behaviour. We deliberately do **not** adopt legacy's `default -> dashboard` for non-approved users (no accounts context exists yet; an empty dashboard would be wrong).

## Bug A — session rehydration

- Add `tokenStore.hasValidSession(): boolean` — true when a refresh token is present **and** `validUntil` parses to a date in the future. Missing token, empty/unparseable `validUntil`, or a past date -> false.
- `sessionStore`'s initial `loggedIn` is derived from `tokenStore.hasValidSession()` at store creation (app boot), restoring an authenticated session across reloads. `setLoggedIn`, `reset`, logout, and the inactivity timeout are unchanged and continue to own explicit transitions.

## Architecture

Unchanged post-login flow: login -> `resolveLandingRoute(profile)` (still returns `/onboarding`) -> `OnboardingScreen` dispatches. `OnboardingScreen` stays the single landing decision point (it already serves legacy `landUser`'s role); only its decision input changes (whole-list `hasApproved` rather than a single app's status). No new route, no new endpoint.

## Error handling

- Applications fail to load -> `hasApproved` false -> onboarding path (current behaviour; safe — a transient failure shows loading then onboarding rather than wrongly exposing a dashboard).
- Session rehydration: any failure to confirm a valid token -> `loggedIn` false (fail-safe; the user is treated as logged out and the existing refresh-on-API-call path still applies).

## Testing

- **Unit — `tokenStore.hasValidSession()`:** future `validUntil` + refresh token -> true; expired date -> false; missing refresh token -> false; empty/garbage `validUntil` -> false.
- **Unit — `sessionStore` rehydration:** with a valid token seeded in localStorage, a fresh import yields `loggedIn === true`; with none, `false`. (Seed localStorage, `vi.resetModules()`, dynamic import.)
- **Unit — `OnboardingScreen`:** applications `[{ status: 'APPROVED' }, { status: 'INCOMPLETE' }]` (approved + newer incomplete) -> redirects to `/dashboard` (the exact reported bug); a single non-approved app -> stays in the onboarding flow. Update the existing approved-redirect test to the new `{ current, hasApproved }` data shape.
- **e2e:** an approved user (mock `getLastApplicationsInfo` -> `[{ status: 'APPROVED' }, { status: 'INCOMPLETE' }]`) logs in and lands on `/dashboard`. Existing specs (single INCOMPLETE -> onboarding; single APPROVED -> dashboard) remain valid.

## Definition of done

- An approved account with a newer in-progress application lands on `/dashboard` after login.
- `loadApplications`/the application hook exposes `hasApproved` derived from the whole array; `OnboardingScreen` redirects on `hasApproved`.
- Non-approved users' behaviour is unchanged.
- A valid persisted session survives a reload / direct navigation to an authenticated route (no bounce to login).
- All suites green (lint, tsc, vitest, playwright).

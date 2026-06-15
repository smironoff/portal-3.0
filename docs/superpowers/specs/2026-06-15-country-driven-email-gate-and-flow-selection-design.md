# Country-driven email-verification gate and flow selection Design

**Date:** 2026-06-15
**Status:** Approved (user pre-authorised implementation into the registration branch)
**Branch:** `feature-registration-live-email-verification`
**Sub-project:** Correction to the Registration slice + onboarding `selectFlow`: both **email validation** and **simplified-vs-general onboarding** are governed by the applicant's **country**, not the org/domain.

## Context

The Registration slice (live create-account + email verification) is built on this branch
but not merged. Review + user correction established that two behaviours are
**country-flag-driven**, which the current code gets wrong:

1. **Email verification** is required when the country forces it and the user is not yet
   verified — `isemail_verification_required(originCountry) && !isuserverified(email)`. Our
   slice currently shows the "Verify your email" button unconditionally from the onboarding
   completion stub.
2. **Simplified vs general** onboarding is decided by `country.isSimplifyOnboarding` (with
   UAE/SA→`TMLC` and an IB-`simplified`-flow edge case), not by `portalAccountDomain`. Our
   `selectFlow` keys only on `portalAccountDomain ∈ ['TMLC','TMBM']`.

### Verified facts (from code)

- Legacy endpoints (`src/utils/api.ts:820-824`): `emailvalidation/isuserverified
  { userEmail }` → boolean; `emailvalidation/isemail_verification_required
  { originCountry }` → boolean. Both `Authorize.No` in legacy.
- Legacy `checkForSimplifiedOnboarding` (`hooks.tsx:1671-1691`): IB-flow `'simplified'` →
  true; UAE (`code3 === 'ARE'`) or SA (`code3 === 'ZAF'`) → simplified **iff** org is
  `TMLC`; else `country.isSimplifyOnboarding` (false when `platformAccountType ===
  'Money_Manager'`); else false.
- Legacy getCountries `Country` carries `forceEmailValidate: boolean` and
  `isSimplifyOnboarding?: boolean`.
- portal-3.0 today: `AppInfo` has **no** `originCountry` (has `portalAccountDomain`,
  `organizationId`, `accountHolderNationality`). `UserProfile.country` is the slim base
  `Country` (no flags) but **does** carry `country.id` and `email`. The registration
  `Country` (extends base + `organization` + `used`) does **not** yet carry the flags.
  OnboardingScreen calls neither `useCountries` nor `useUserProfile`. The two new
  `emailvalidation` endpoints are **not** implemented.

## Goal

Make the email-verification step appear only when the applicant's country requires it and
the email is not already verified, and make the simplified-vs-general flow selection driven
by the country's `isSimplifyOnboarding` flag (with the UAE/SA→TMLC edge case), resolving the
rich country from the logged-in profile.

## Decisions

| Area | Decision |
| ---- | -------- |
| Email-required signal | `emailvalidation/isemail_verification_required { originCountry }`, called with `profile.country.id`. |
| Email-verified signal | `emailvalidation/isuserverified { userEmail }`, called with `profile.email`. |
| Endpoint auth mode | `Authorize.No` (match legacy; the calls pass explicit params and do not depend on session). Backend-verify if a session is in fact required. |
| Rich country source | `useCountries()` (registration feature) resolved by `profile.country.id` via a new `useApplicantCountry()` hook. |
| `selectFlow` simplified | country-driven: UAE/SA (`code3` `ARE`/`ZAF`) → simplified iff `portalAccountDomain === 'TMLC'`; else `country.isSimplifyOnboarding && platformAccountType !== 'Money_Manager'` → simplified. Falls back to the existing domain logic when the country is not (yet) known. |
| IB-`simplified` flow edge case | Deferred (the IB whitelist/flow system is not ported); noted in `selectFlow`. |
| Gate placement | The onboarding completion component (`OnboardingComplete`) shows the "Verify your email" button **only** when required and not verified; otherwise a plain processing message. `EmailVerificationScreen` also short-circuits to the verified confirmation if already verified. |

## Architecture

### File changes

```
src/features/registration/types.ts                 + forceEmailValidate?, isSimplifyOnboarding? on Country
src/features/emailVerification/api/emailApi.ts      + isUserVerified(email), isEmailVerificationRequired(countryId)
src/features/emailVerification/api/emailQueries.ts  + useIsUserVerified, useIsEmailVerificationRequired (invalidate verified on verify success)
src/features/onboarding/hooks/useApplicantCountry.ts (new) profile.country.id -> rich Country via useCountries
src/features/onboarding/flowSelection.ts            selectFlow(app, country?) country-driven simplified
src/features/onboarding/OnboardingScreen.tsx        resolve applicant country, pass to selectFlow; OnboardingComplete gates the verify button
src/features/emailVerification/EmailVerificationScreen.tsx  short-circuit when already verified
e2e/registration.spec.ts, e2e/email-verification.spec.ts   mock the new endpoints; assert the gate
```

### Email endpoints + queries

```ts
// emailApi.ts
export const isUserVerified = async (email: string): Promise<boolean> => {
  const res = await getHttpClient().tfboCall<boolean>('emailvalidation', 'isuserverified', { userEmail: email }, Authorize.No)
  return res.payload?.[0]?.result === true
}
export const isEmailVerificationRequired = async (countryId: number): Promise<boolean> => {
  const res = await getHttpClient().tfboCall<boolean>('emailvalidation', 'isemail_verification_required', { originCountry: countryId }, Authorize.No)
  return res.payload?.[0]?.result === true
}
```

`useIsUserVerified(email?)` / `useIsEmailVerificationRequired(countryId?)` are `useQuery`
hooks, `enabled` only when the input is present, query keys `['isUserVerified', email]` and
`['emailVerificationRequired', countryId]`. `useVerifyOtp().onSuccess` additionally
invalidates `['isUserVerified']` (so the gate re-evaluates) alongside `['application']`.

### `useApplicantCountry()`

```ts
// returns the rich registration Country for the logged-in user, or undefined while loading
export const useApplicantCountry = (): Country | undefined => {
  const { data: profile } = useUserProfile(true)
  const { data: countries } = useCountries()
  return profile && countries ? countries.find((c) => c.id === profile.country.id) : undefined
}
```

### `selectFlow(app, country?)`

Country-driven simplified check runs first when `country` is known; otherwise the existing
domain logic is unchanged (so existing tests and the no-domain dev default still hold):

```ts
export const selectFlow = (app: Partial<AppInfo>, country?: { code3: string; isSimplifyOnboarding?: boolean }): FlowSelection => {
  const domain = app.portalAccountDomain
  if (country) {
    const isUaeOrSa = country.code3 === 'ARE' || country.code3 === 'ZAF'
    if (isUaeOrSa) {
      if (domain === 'TMLC') return { kind: 'simplified' }
      // else fall through to the domain routing below (legacy returns "not simplified")
    } else if (country.isSimplifyOnboarding && app.platformAccountType !== 'Money_Manager') {
      return { kind: 'simplified' }
    }
  }
  if (domain === 'AU') return { kind: 'general', jurisdiction: 'AU' }
  if (domain === 'TMCY' || domain === 'TMEU') return { kind: 'general', jurisdiction: 'TMCY' }
  if (domain === 'UK') return { kind: 'general', jurisdiction: 'UK' }
  if (domain && SIMPLIFIED_DOMAINS.includes(domain)) return { kind: 'simplified' }
  if (!domain) return { kind: 'simplified' } // dev default
  return { kind: 'unsupported', domain }
}
```

### OnboardingScreen + OnboardingComplete

OnboardingScreen resolves `const country = useApplicantCountry()` and calls
`selectFlow(app ?? {}, country)`. `OnboardingComplete` reads `useUserProfile`,
`useIsEmailVerificationRequired(profile?.country.id)`,
`useIsUserVerified(profile?.email)`: while either query loads → processing message; if
required and not verified → the "Verify your email" button; otherwise → a plain
"application is being processed" message (no button). `EmailVerificationScreen` short-circuits
to the verified confirmation when `useIsUserVerified` returns true (no OTP sent).

## Error handling

- The status queries default to `false` on a non-OK / empty payload (never throw); a failed
  `required` check therefore does not block the user (degrades to "not required"); a failed
  `verified` check degrades to "not verified" (shows the gate) — fail-safe toward prompting.
- `useApplicantCountry` returns `undefined` while loading or if the country is not found;
  `selectFlow` then uses the domain fallback, so onboarding never blocks on the lookup.

## Testing

- Unit: the two new email API functions (exact module/action/params, `Authorize.No`,
  boolean coercion); `useApplicantCountry` resolution; `selectFlow` country-driven cases
  (UAE/SA→TMLC simplified, UAE/SA non-TMLC → not simplified, `isSimplifyOnboarding` →
  simplified, `Money_Manager` exclusion, and that all existing domain cases still pass with
  no country); `OnboardingComplete` gate (required+unverified → button; not-required →
  no button; verified → no button); `EmailVerificationScreen` already-verified short-circuit.
- Update the existing onboarding tests that render `OnboardingScreen`/`OnboardingComplete`
  to mock `useApplicantCountry`, `useUserProfile`, and the two status queries (additive
  mocks; the default of "no country / not required" preserves current behaviour).
- E2E: `registration.spec.ts` (mock `isemail_verification_required`/`isuserverified`);
  `email-verification.spec.ts` mocks the gate so the button appears, and asserts the
  verified confirmation.

## Compliance

Email verification being correctly gated by `country.forceEmailValidate` is a regulatory
control (the platform must confirm the account holder controls the email in jurisdictions
that require it). This change makes the control data-driven rather than optional. The C-2
(T&C/KID links) and C-3/C-4 (entity-specific retail-loss disclosure) items remain separate
pre-production compliance follow-ups.

## Definition of done

- Email verification is shown only when `isemail_verification_required(profile.country.id)`
  is true and `isuserverified(profile.email)` is false; otherwise the user proceeds without
  an email-verification prompt.
- `selectFlow` routes to the simplified flow based on `country.isSimplifyOnboarding`
  (+ UAE/SA→TMLC), with the domain fallback preserved; general-jurisdiction routing by
  domain unchanged.
- New unit tests cover the endpoints, `useApplicantCountry`, the `selectFlow` country cases,
  and the gate; existing onboarding tests updated and green; e2e updated and green.
- Lint, typecheck, full unit suite, and e2e pass under Node 20.

## Risks / notes

- **Endpoint auth mode** (`Authorize.No`) and the exact boolean payload shape are
  backend-verify items (matched to legacy).
- **IB-`simplified` flow** edge case in `checkForSimplifiedOnboarding` is deferred with the
  rest of the IB system; `selectFlow` notes it.
- Adding `useUserProfile`/`useCountries`/status queries to the onboarding completion path
  means existing onboarding component tests must mock these; the mocks default to
  "no country / not required" so current behaviour is preserved.
- The `emailVerified`-style gating still depends on the backend honouring these endpoints
  for a freshly-registered (tfbo-session-only) user; covered by the e2e mock and flagged.

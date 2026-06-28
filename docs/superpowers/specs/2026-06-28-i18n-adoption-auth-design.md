# i18n Adoption — Conventions + Auth Reference Migration (Slice 1) Design

**Date:** 2026-06-28
**Status:** Approved for planning
**Effort:** i18n adoption (slice 1 of N)

## Overview

The i18n infrastructure already exists (i18next + react-i18next + chained localStorage/HTTP backend, `I18nextProvider` in `App.tsx`, loading `/locales/{{lng}}/{{ns}}.json`), but no component consumes it: every user-facing string is hardcoded English, and `common.json` holds a single `hello` key.

This slice establishes the durable i18n conventions and migrates the **auth vertical** as the worked reference, reusing the legacy portal-2.0 translation corpus (17 languages). Later slices migrate the remaining verticals (onboarding, registration, dashboard, emailVerification) following this template.

## Goal

Lock in namespace structure, key-naming, typed keys, the `useTranslation` usage pattern, a translation-harvest mechanism, and scoped lint enforcement; prove them by fully translating auth across all available languages.

## Non-goals (this slice)

- Migrating onboarding, registration, dashboard, emailVerification (later slices).
- Building a notification renderer (see Pre-existing gap below).
- Adding new languages beyond what legacy ships.
- A translation-management-system (Applanga) integration; we harvest static JSON.

## Conventions

### Namespaces (per feature)
- This slice creates two: `common` (cross-feature shared copy: generic buttons such as Continue/Back/Cancel, shared error text) and `auth` (the auth vertical).
- Later slices add `onboarding`, `registration`, `dashboard`, `emailVerification`.
- `src/i18n/i18n.ts` `ns` list grows per slice; it becomes `['common', 'auth']` here. `defaultNS` stays `common`.

### Key naming
- Nested by screen/concept, camelCase leaves. Example `auth.json`:
```json
{
  "login": { "title": "...", "email": "Email", "password": "Password", "signIn": "Sign in", "keepSignedIn": "Keep me signed in" },
  "twoFactor": { "title": "...", "code": "...", "verify": "Verify" },
  "reset": { "request": { "...": "..." }, "sent": { "...": "..." }, "confirm": { "...": "..." }, "done": { "...": "..." } },
  "validation": { "emailRequired": "Email is required", "emailInvalid": "Enter a valid email", "passwordRequired": "Password is required" },
  "errors": { "invalidCredentials": "Invalid email or password", "generic": "...", "tfaExpired": "...", "missingFields": "...", "userNotFound": "...", "alreadyRegistered": "...", "syncFailed": "..." }
}
```
- Usage: `const { t } = useTranslation('auth')` then `t('login.signIn')`. Shared strings via the `common` namespace: `t('common:continue')`.

### Source language
British English in `public/locales/en/<ns>.json` (organisation standard).

### Typed keys
`src/i18n/resources.d.ts` augments react-i18next's `CustomTypeOptions` with `defaultNS: 'common'` and a `resources` type derived from importing the `en` namespace JSON as const. Result: `t()` autocompletes keys and tsc fails on unknown or typo'd keys. As later slices add namespaces, they extend this file.

## Translation reuse (harvest)

- A dev-only Node script `scripts/i18n-harvest.mjs` (not shipped in the app bundle) reads legacy locales from `C:\Work\ThinkMarkets\portal-2.0\public\locales\<lang>\*.json` for all languages legacy ships: **ar, cs, de, el, en, es, id, it, ja, ms-MY, pl, pt-BR, th, tr, vi, zh-Hans, zh-Hant** (17).
- It flattens every legacy namespace into an English-source -> per-language-translation index (keyed by the English string value).
- For each key in the new `en/auth.json` and `en/common.json`, if its English value matches a legacy English value, the script writes the matched translations into `public/locales/<lang>/<ns>.json` for every language.
- Keys with no legacy match are written English-only and listed in the script's stdout under "needs translation".
- The script is re-runnable and idempotent; its output (the per-language JSON files) is committed. RTL (ar) is already handled by `ThemeProvider`'s `RTL_LANGS`.

## Auth migration scope

- **Components:** `LoginForm`, `TwoFactorForm`, `PasswordResetRequestForm`, `PasswordResetConfirmForm`, and the route screens `login`, `twoFactor`, `resetRequest`, `resetSent`, `resetConfirm`, `resetDone`. Migrate all rendered literals (field labels, button text, headings, instructional copy, the keep-signed-in checkbox, inline `setError` messages) to `t()`.
- **Validation:** replace inline zod message literals with a `(t) => schema` factory built inside the component (memoised), so validation messages are translated. This is the reference pattern every later form follows.
- **Error keys:** `aseCodes.ts` already maps ASE codes to message keys; align those keys to live under `auth.errors.*` so they exist and resolve. (They currently flow to the notification store; display is gated by the pre-existing gap below.)

## Pre-existing gap (flagged, out of scope)

There is no notification renderer: `notificationStore` items are pushed by several forms but nothing in the tree renders them, so pushed error keys are not displayed anywhere today. Building a `NotificationHost` that translates `message` via `t()` is a separate gap, recommended as its own slice. This slice ensures the auth error keys exist so a future renderer resolves them; it does not build the renderer.

## Enforcement

Add an eslint rule that flags literal user-facing JSX text, **scoped to `src/features/auth/**` only** via an eslint override. A global rule would immediately fail on the ~50 un-migrated strings in other features. Each later migration slice widens the override scope to its feature. This prevents regressions in migrated areas without blocking unmigrated ones.

## Testing

- **Initialise i18n in `src/test/setup.ts`** (synchronously, with the `en` resources for `common` + `auth` bundled inline or loaded) so `t()` returns real English in unit tests. Existing auth component assertions (`getByText('Sign in')`, `/email is required/i`) keep passing unchanged, which also proves keys resolve to the expected English. This minimises test churn.
- **Locale completeness check:** a test (or the harvest script's verify mode) asserts every key in `en/auth.json` and `en/common.json` exists in all 17 language files, and reports English-only fallbacks. Prevents shipping a language with missing keys (which would silently fall back).
- **e2e:** `auth.spec.ts` is unchanged — English copy is identical, so label/role selectors still match.

## Definition of done

- `common` and `auth` namespaces exist for all 17 languages, harvested from legacy where matched, English-only (flagged) otherwise.
- Typed keys: `t()` is type-checked; tsc fails on unknown auth/common keys.
- All auth components and route screens render via `t()`; no hardcoded user-facing literals remain in `src/features/auth`.
- Validation messages translated via the `(t) => schema` pattern.
- Lint rule active and scoped to `src/features/auth/**`; passes.
- i18n initialised in test setup; all unit tests green; e2e green.
- All suites green (lint, tsc, vitest, playwright).

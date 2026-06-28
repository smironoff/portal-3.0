# Legacy Registration → Onboarding → Submit Flow (Simplified / TMLC Path)

**Date:** 2026-06-28
**Author:** Research fork (read-only analysis)
**Scope:** TMLC entity, Nigeria-style applicant (country where `isSimplifyOnboarding === true` and entity resolves to `PortalAccountDomain.TMLC`). General/AU/UK paths noted only for contrast.

---

## 1. Legacy simplified flow — ordered steps

### Step 0 — Registration: Credentials (email/password)
- **Component/file:** `src/components/Container/Account/Create/index.tsx`
- **Route:** `/account/individual` (alias: `/account/register`, `/account/register/live`)
- **UI:** Single-page Formik with a two-sub-step internal state machine (`step: 'start' | 'residency'`).
  - Sub-step `start` collects **email + password** only.
  - On submit, dispatches `updateUserAppInfo({ accountHolderEmail, accountHolderPassword })` to Redux store only — **no TFBO call**.
  - Advances `step` to `'residency'`.
- **TFBO call(s):** None at this sub-step.
- **Account created?** No. Data is held only in Redux (`uncompletedApplication` slice).
- **References:** `Create/index.tsx:276–286` (step `'start'` handler), `Create/index.tsx:329` (`dispatch(setUserAppInfo(app))`)

### Step 1 — Registration: Residency (country selection + T&C consent)
- **Component/file:** `src/components/Container/Account/Create/index.tsx` (continued, sub-step `'residency'`)
- **Route:** Same `/account/individual` page, visual sub-step.
- **UI:** Country dropdown, marketing consent (via `ConsentBlock`), optional IB ref.
- **On submit:** Calls internal `submitApplication()` which:
  1. Calls `collectData(values, isIB)` — assembles `AppInfo` with `accountHolderEmail`, `accountHolderPassword`, `originCountry`, `agreeToAllTerms`, `brand`, `preferredLanguage`, `accountType`, `accountTradingTypes`, `source`, `isMarketingOptOut`, optionally `preferredOrganization`, `afsAid`, `visitorId`, `referrerId`.
  2. Dispatches `setUserAppInfo(app)` to Redux.
  3. Navigates to `/account/personal-information`.
  - **No TFBO call is made.** The entire "create account" screen (steps 0+1) produces zero backend requests.
- **TFBO call(s):** None.
- **Account created?** No. All data is still local (Redux + sessionStorage).
- **Key fields assembled** (but not yet sent): `accountHolderEmail`, `accountHolderPassword`, `originCountry` (country.id), `agreeToAllTerms`, `brand:'ThinkMarkets'`, `preferredLanguage`, `source`, `isMarketingOptOut`, `accountType:'individual'`, `accountTradingTypes:[1]`.
- **References:** `Create/index.tsx:327–356` (`submitApplication`), `Create/index.tsx:199–253` (`collectData`)

### Step 2 — Personal Information (name, DOB)
- **Component/file:** `src/components/Container/Onboarding/PersonalInformation/index.tsx`
- **Route:** `/account/personal-information` (`appRoutes.account.personalInformation`, `routes.ts:261`)
- **Preconditions:**
  - If `appInfo.accountHolderEmail` is missing, redirects back to `/account/register/live` (`PersonalInformation/index.tsx:108–110`).
  - `emailvalidation/validateemail` is NOT called here. Email validation (OTP) is a separate gate on the email-verification screen, not inline on PersonalInformation.
  - `dispatch(getQuestions())` is called on mount (`PersonalInformation/index.tsx:115`).
- **UI:** First name, last name, date of birth (DOB). Title optional for non-UK.
- **On submit (simplified path — `goSimple`):**
  1. Executes reCAPTCHA → `appRegisterToken`.
  2. If not logged in: calls **`api.registerUser(params)`** → `POST AUTH_URL/auth/register` (auth service, not TFBO). This creates the portal user account in Keycloak/auth-adapter. Payload: `{ email_id, password, first_name, last_name, country (originCountry id), accountHolderDayOfBirth, accountHolderMonthOfBirth, accountHolderYearOfBirth, accountHolderTitle, brand:'ThinkMarkets', utmLink, source, visitorId }`. On success, stores auth tokens via `api.setAuthTokens(response.tokens)`.
  3. Assembles `personalInfo` (merges stored `appInfo` + name/DOB fields from form + `recaptchaResponse`).
  4. Calls **`api.simplified_submit_level_one(personalInfo)`** — TFBO call, module=`application`, action=`simplified_submit_level_one`, **Authorize.Yes** (uses session/token set by the auth registration step or existing session). Key fields in payload: `accountHolderEmail`, `accountHolderPassword` (from stored `appInfo`), `originCountry`, `accountHolderFirstName`, `accountHolderLastName`, `accountHolderDayOfBirth/Month/Year`, `agreeToAllTerms`, `brand`, `source`, `preferredLanguage`, `accountType`, `accountTradingTypes`, `isMarketingOptOut`, `recaptchaResponse`.
  5. Calls `api.checkTFBOResponse(response)`.
  6. Dispatches `launchAppPreload()` which triggers the preload saga — fetches user profile, app info, `check_application_statuses`, user apps, etc., then calls `window.landUser()`.
- **TFBO call(s):** `application / simplified_submit_level_one` (Authorize.Yes)
- **Account / Application CREATED HERE.** This is the first and only TFBO submit at registration time for the simplified path. The backend creates the TMLC application record.
- **References:** `PersonalInformation/index.tsx:317–353` (`goSimple`), `PersonalInformation/index.tsx:279–313` (`registerAndLogin`), `api.ts:787–789`

### Step 3 — App preload → `landUser()` → route to `/create-account`
- **Redux saga / App router:**
  - `launchAppPreload` action triggers `launchAppPreloadSaga` (`sagas.ts:1151`).
  - Saga calls `preloadApp()` which fires a batched TFBO request (`multilpeTFBO`) containing: `profile/get_user`, `application/get_application_info`, IB application, **`application/check_application_statuses`**, `payment/transactions`, `application/apps`, `emailvalidation/isuserverified`.
  - Reads `application_status` from `check_application_statuses` response → `setAppStatus(status)` (`sagas.ts:190–197`).
  - Calls `window.landUser()` (defined in `App/index.tsx:187`).
- **`window.landUser()` routing for `appStatus === 'INCOMPLETE'`:**
  - If `!hasApproved`: navigates to `appRoutes.onboarding` = `/create-account` (`App/index.tsx:219–221`, `routes.ts:225`).
  - If `hasApproved`: navigates to `landingPage` (dashboard).
- **TFBO calls in preload:** `profile/get_user`, `application/get_application_info`, `application/check_application_statuses` (Authorize.Yes for all).
- **References:** `sagas.ts:153–266` (`preloadApp`), `App/index.tsx:187–228` (`window.landUser`), `routes.ts:225`

### Step 4 — Onboarding at `/create-account`: LEVEL_ONE_STEPS (status = INCOMPLETE)
- **Component/file:** `src/components/Container/Onboarding/index.tsx` → `SimplifiedFlow/SimplifiedFlow.tsx`
- **Route:** `/create-account` (`Routes.onboarding`)
- **Gate:** `Onboarding/index.tsx:8` — `checkForSimplifiedOnboarding()` checks `country.isSimplifyOnboarding` → renders `<SimplifiedFlow>`.
- **`checkForSimplifiedOnboarding` logic** (`hooks.tsx:1688–1708`): Returns `true` if `country.isSimplifyOnboarding === true` (the Nigeria/TMLC flag); also `true` for UAE/SA countries when `portalAccountDomain === TMLC`; `false` for Money_Manager.
- **On mount:** Calls `api.getQuestions(orgId)` (`SimplifiedFlow.tsx:98`).
- **`LEVEL_ONE_STEPS`** (from `flowConfigs.tsx:4–12`): personalInfo → phone → platform → termsAndConditions.
- **Per non-last step advance:** Calls `api.simplified_submit_level_one({ ...values, applicationId })` (`SimplifiedFlow.tsx:50`), then navigates to next step.
- **On last step (termsAndConditions, `isLast: true`):** Calls `completeLevelOne(updatedApp)` (`utils.tsx:601–651`):
  1. Sets `completed: true`.
  2. Resolves platform/leverage defaults if not already set.
  3. Calls `api.simplified_submit_level_one(app)` — same action, but with `completed:true`.
  4. On success: dispatches `getUserApps()`, fires analytics.
  5. Calls `fetchApplicationStatus()` which calls `api.checkApplicationStatuses()` and routes based on result:
     - `'PENDING_KYC'` → `/account/verify`
     - `'LEVEL1_APPROVED'` → `/account/s/account-created`
- **TFBO call(s):** `application / simplified_submit_level_one` (Authorize.Yes) — once per step advance including the final `completed:true` call.
- **References:** `SimplifiedFlow.tsx:47–59` (`submitCallback`), `utils.tsx:601–651` (`completeLevelOne`), `SimplifiedFlow.tsx:63–86` (`fetchApplicationStatus`), `flowConfigs.tsx:4–12`

### Step 5 — Account Created (Level 1 done): `/account/s/account-created`
- **Component:** `SimplifiedFlow/AccountCreatedLevelOne/index.tsx`
- **Route:** `/account/s/account-created` (`routes.ts:239`)
- No TFBO calls. Shows congratulations screen, allows user to continue to Level 2.

### Step 6 — Onboarding at `/create-account`: LEVEL_TWO_STEPS (status = LEVEL1_APPROVED)
- **Component/file:** `SimplifiedFlow/SimplifiedFlow.tsx` (same component, different `appStatus`)
- **`LEVEL_TWO_STEPS`** (from `flowConfigs.tsx:14–25`): address → question(forexExperience) → question(securitiesBondsExperience, `isLast: true`).
- **Per non-last step advance:** Calls `api.simplified_submit_level_two({ ...values, applicationId })` (`SimplifiedFlow.tsx:55`).
- **On last step:** Calls `completeLevelTwo(updatedApp)` (`utils.tsx:654–673`):
  1. Sets `completed: true`, `appropriatenessLevel: 'PASS'`.
  2. Calls `api.simplified_submit_level_two(app)`.
  3. Dispatches `getUserApps()`.
  4. Then calls `fetchApplicationStatus()` — routes to `/account/verify` (`PENDING_KYC`) or stays at `accountCreated`.
- **TFBO call(s):** `application / simplified_submit_level_two` (Authorize.Yes) — once per Level 2 step advance including the final `completed:true` call.
- **References:** `SimplifiedFlow.tsx:54–58`, `utils.tsx:654–673` (`completeLevelTwo`), `flowConfigs.tsx:14–25`

---

## 2. Endpoint inventory

| API method | Module | Action | Authorize | Purpose / When |
|---|---|---|---|---|
| `api.registerUser` | auth-adapter | `POST /auth/register` | Bearer (Authorize.No) | Create portal user in Keycloak (PersonalInfo, if not logged in) |
| `api.simplified_submit_level_one` | `application` | `simplified_submit_level_one` | Yes | Create TMLC application (first call, PersonalInfo step); also update per each LEVEL_ONE step advance; final call with `completed:true` |
| `api.simplified_submit_level_two` | `application` | `simplified_submit_level_two` | Yes | Update/complete Level 2 steps (address, experience questions); final call with `completed:true` |
| `api.checkApplicationStatuses` | `application` | `check_application_statuses` | Yes | Read `application_status` for routing (called in preload batch AND after each final submit) |
| `api.getQuestions` | `application` | `getQuestions` | No | Fetch appropriateness questions for org |
| `api.getLastApplicationsInfo` | `application` | `getLastApplicationsInfo` | Yes | Read latest application data (used in portal-3.0 onboarding; legacy uses `get_application_info`) |
| `api.incrementalSubmit` | `application` | `application_submit` (if logged-in session) or `incremental_submit` (no session) | Conditional | General (non-simplified) flow only. Not used in simplified TMLC path. |

The `validateemail` endpoint (`application/validateemail`) is **not** called as part of the simplified registration-to-onboarding flow. It is referenced by the email-verification gate screen (`/account/email`) but is not inline in the simplified flow.

---

## 3. Where the account is first created / status source

**Account first created (auth layer):** `api.registerUser()` in `PersonalInformation/index.tsx:295` — this creates the Keycloak/portal user record via `POST AUTH_URL/auth/register`. It is NOT a TFBO call.

**Application first created (TFBO / backend application record):** The first call to `api.simplified_submit_level_one()` in `PersonalInformation/index.tsx:331`. At this point email, password, country, name, DOB are sent. If this call returns anything other than `OK`, the application does not exist on the backend.

**Status source for onboarding routing:** `application/check_application_statuses` (called inside `preloadApp` as part of the `multilpeTFBO` batch in `sagas.ts:156–166`). The last entry in the result array is used as the canonical `application_status`. The value is stored in Redux as `appStatus` and read by `window.landUser()` in `App/index.tsx:188` to route to `/create-account` (INCOMPLETE) or dashboard (APPROVED).

---

## 4. portal-3.0 divergences

### Divergence 1 — `incremental_submit` fired at registration, legacy fires NOTHING
- **Legacy expectation:** `Create/index.tsx` (registration screen) makes zero TFBO calls. The application is first submitted via `simplified_submit_level_one` at the Personal Information screen.
- **portal-3.0 reality:** `registerApi.ts:15` calls `application/incremental_submit` (action `incremental_submit`, `Authorize.No`) immediately when the user clicks "Create account" on the registration form. This happens before any Personal Information is collected.
- **Impact:** Backend likely returns `SYS_ERR` because `incremental_submit` without a session, and without all required fields (no first/last name, no DOB), is not the correct call for TMLC entity creation. Legacy never calls `incremental_submit` for the simplified path at all.
- **Legacy ref:** `Create/index.tsx:327–356` (no TFBO call in `submitApplication`); `api.ts:777–785` (`incrementalSubmit` is only used in `useSubmitApplication` / `useCompleteApplication` general flow).
- **portal-3.0 ref:** `registerApi.ts:14–22` (`createLiveAccount`), `RegisterForm.tsx:72–89` (called on form submit)

### Divergence 2 — Personal Information is not collected before the first TFBO submit
- **Legacy expectation:** Registration screen collects email + password + country → navigates to PersonalInformation screen which collects name + DOB, then `registerUser` (auth) + `simplified_submit_level_one` (TFBO) are both called with the complete initial payload.
- **portal-3.0 reality:** Registration form (`RegisterForm.tsx`) submits on Step 1 (country selection) immediately calling `incremental_submit`. Name and DOB are not captured until the onboarding `PersonalInfoStep`. There is no `registerUser` call to the auth-adapter; tokens come back from the `incremental_submit` response (via `storeRegistrationAuth` in `registerApi.ts:27–31`).
- **Legacy ref:** `PersonalInformation/index.tsx:279–353` (`registerAndLogin` + `goSimple`).
- **portal-3.0 ref:** `RegisterForm.tsx:67–102`, `registerApi.ts:27–31`

### Divergence 3 — Wrong TFBO action for simplified TMLC registration
- **Legacy expectation:** For TMLC / simplified path, `simplified_submit_level_one` is used (with `Authorize.Yes` — authenticated because `registerUser` is called first). `incremental_submit` / `application_submit` is only used for the general (appropriateness) flow.
- **portal-3.0 reality:** `registerApi.ts:15` calls `incremental_submit` with `Authorize.No`. This action maps to either `application/incremental_submit` or `application/application_submit` in legacy (`api.ts:777–785`). Neither is the correct action for TMLC entity creation at sign-up.
- **Legacy ref:** `api.ts:787–789` (`simplified_submit_level_one` definition); `utils.tsx:506–516` (`useSubmitApplication` uses `incrementalSubmit` only for general flow).
- **portal-3.0 ref:** `registerApi.ts:15`

### Divergence 4 — Onboarding `SimplifiedFlow` calls `incremental_submit` between Level 1 steps
- **Legacy expectation:** Between each LEVEL_ONE step advance, legacy calls `simplified_submit_level_one` (not `incremental_submit`). `incremental_submit` is only used in the General flow.
- **portal-3.0 reality:** `SimplifiedFlow.tsx:51` calls `incremental.mutateAsync(app)` — which maps to `onboardingApi.ts:25–27` calling `application/application_submit` (Authorize.Yes). This is the correct incremental-save call after authentication, but it differs from legacy which uses `simplified_submit_level_one` for every LEVEL_ONE step advance.
- **Legacy ref:** `SimplifiedFlow.tsx:47–59` (legacy `submitCallback` uses `simplified_submit_level_one` for `INCOMPLETE`, `simplified_submit_level_two` for `LEVEL1_APPROVED`).
- **portal-3.0 ref:** `SimplifiedFlow.tsx:51`, `onboardingApi.ts:25–27`

### Divergence 5 — No auth-adapter `registerUser` call in portal-3.0
- **Legacy expectation:** `PersonalInformation/index.tsx:295` calls `api.registerUser()` → `POST AUTH_URL/auth/register` to create the Keycloak user, getting auth tokens back. Only then is `simplified_submit_level_one` called with those tokens.
- **portal-3.0 reality:** There is no equivalent `registerUser` auth-adapter call. `storeRegistrationAuth` (`registerApi.ts:27–31`) expects tokens directly from the `incremental_submit` TFBO envelope (`res.session_id`, `res.token`, `res.payload[0].result.tokens`). If TFBO `incremental_submit` returns `SYS_ERR`, no auth tokens are ever stored, so subsequent authenticated calls will also fail.
- **Legacy ref:** `PersonalInformation/index.tsx:279–313` (`registerAndLogin`), `api.ts:183–198` (`registerUser`).
- **portal-3.0 ref:** `registerApi.ts:27–31` (`storeRegistrationAuth`).

### Divergence 6 — Screen order: country is on registration screen (portal-3.0) vs. residency sub-step + personalInfo separate (legacy)
- **Legacy:** Two-screen sequence: `Create` (email + pw, then country sub-step) → `PersonalInformation` (name + DOB + first TFBO submit).
- **portal-3.0:** Single `RegisterForm` (step 0: email+pw, step 1: country+consent+submit → TFBO) → `OnboardingScreen` → `SimplifiedFlow` (starts with `PersonalInfoStep` collecting name+DOB).
- The net effect is that portal-3.0 submits to the backend before collecting name and DOB, which are required by `simplified_submit_level_one`.

---

## 5. Open questions / unknowns

1. **Does `incremental_submit` (Authorize.No) actually create a TMLC application record on the backend?** Legacy never calls it for TMLC. The `SYS_ERR` in production almost certainly means it does not. This needs confirmation from backend/TFBO team.

2. **What fields does `simplified_submit_level_one` require at minimum?** The legacy call includes `accountHolderEmail`, `accountHolderPassword`, `originCountry`, `accountHolderFirstName`, `accountHolderLastName`, DOB fields, `agreeToAllTerms`, `brand`, `source`, `preferredLanguage`, `accountType`, `accountTradingTypes`, `recaptchaResponse`. It is unclear which subset is strictly required — the backend schema is not in this codebase.

3. **Does portal-3.0 need an auth-adapter `registerUser` call, or can it use a different TFBO action?** The legacy flow calls `POST AUTH_URL/auth/register` before any TFBO call. Portal-3.0 skips this. If the backend requires a Keycloak user to exist before processing `simplified_submit_level_one`, this is a hard blocker.

4. **Is the TFBO `session_id`/`token` pair returned from `simplified_submit_level_one` (first call with Authorize.Yes) the same as what `storeRegistrationAuth` is trying to read from `incremental_submit`?** Legacy obtains session/token via `registerUser` → auth tokens, then uses them for `simplified_submit_level_one` (Authorize.Yes). The envelope structure (top-level `session_id`, `token`) may only be returned on certain TFBO actions. This needs backend clarification.

5. **`portalAccountDomain` / `preferredOrganization` mapping for TMLC**: `checkForSimplifiedOnboarding` in legacy checks `country.isSimplifyOnboarding` flag. Portal-3.0's `RegisterForm.tsx:77` passes `portalAccountDomain: domainForCountry(country)`. Whether `domainForCountry` correctly resolves TMLC for Nigeria-mapped countries (vs. the `isSimplifyOnboarding` flag) is not verified from this code read. Mismatched entity domain could cause backend routing errors independent of the `incremental_submit` issue.

6. **`emailvalidation/validateemail` gate**: Legacy has an email-validation screen (`/account/email`) and an `isEmailVerificationRequired` check. It is not inline in the simplified flow but may be required before the application is accepted. The interaction between portal-3.0's email-verification gate and the TFBO registration step was not traced in detail.

---

## 6. Live verification against the real UAT backend (2026-06-28)

Confirmed by direct calls to `portal-test.thinkmarkets.com` (proxying UAT):

- **Corrected create sequence WORKS.** `POST /auth/register` (body `email_id`, `password`, `first_name`, `last_name`, `country`, `account_holder_title`, `preferred_language_code`, `brand`, `source`) returns `status: OK` + auth `tokens`. Then `application/simplified_submit_level_one` (Authorize.Yes, bearer from register, payload incl. name/DOB) returns `status: OK`, `result: { applicationId }`. This created a real INCOMPLETE TMLC application (Nigeria). Confirms divergences 1/3/5.
- **portal-3.0 `incremental_submit` at registration returns `SYS_ERR`** (even with a non-empty captcha string), confirming it is the wrong call.
- **NEW finding — onboarding strands on a fresh application.** Logging the new INCOMPLETE account into portal-3.0 lands on `/onboarding` stuck at "Loading your application...". Cause: for a brand-new application `getLastApplicationsInfo` returns empty, so `loadApplication` (`onboardingApi.ts`) returns `undefined`. This (a) triggers a TanStack Query hard error ("Query data cannot be undefined", key `['application']`) and (b) trips the `if (!app) return Loading` guard in `OnboardingScreen.tsx`, so the screen never advances. portal-3.0's onboarding hard-depends on `getLastApplicationsInfo` returning a form blob; legacy reads `get_application_info` and builds the form from local/redux state during onboarding. The mocked e2e passed only because it supplied a fake non-empty blob.
  - Fix implication: the onboarding load must tolerate an empty `getLastApplicationsInfo` (no `undefined` from the queryFn; no `!app` strand) and seed the draft from registration data / the status payload, matching legacy.

# Onboarding GeneralFlow Slice 3 (UK individual) Design

**Date:** 2026-06-15
**Status:** Approved (pending written-spec review)
**Sub-project:** Onboarding 2b — the UK individual GeneralFlow jurisdiction (the most complex appropriateness path: multi-path scoring with a forex-experience auto-pass, shares-experience modulation, and a deposit-loss attitude gate)

## Context

The Portal 3.0 onboarding GeneralFlow runner, scoring engine, and two jurisdictions
(AU = binary PASS/FAIL; TMCY = three-band PASS/REFER/FAIL) are built and on `main`. The
engine supports `StepField` (`fields`/`requiredQuestions`/`component`/`category`/
`shouldDisplay`/`beforeSubmit`/`isLast`/`isFailure`), a reusable radio `QuestionStep`, a
confirm/cancel `ReferStep` (with `isReferAcknowledged`), `makeAppFailed(contactLink)`, and
a `TaxInformationStep`. `onNext` accepts an optional payload; the runner uses the
passed/computed level for the failure check (never the stale hydrated draft).

UK is the most complex jurisdiction: its appropriateness outcome has **multiple paths** —
a forex-experience auto-pass, a no-forex scored path that branches on shares/funds
experience, and a deposit-loss attitude gate that can downgrade PASS to REFER. The engine
already supports everything needed; the novel work is the UK scoring logic, isolated as a
pure, exhaustively-tested helper.

## Goal

For an authenticated UK individual applicant, run the UK GeneralFlow at `/onboarding`,
producing the correct PASS / REFER / FAIL outcome via the multi-path logic, with PASS
completing, REFER showing the confirm/cancel screen, and FAIL showing the failure page.

## Scope

**In scope:**

- The UK jurisdiction config (`buildUkSteps`) with the two scoring `beforeSubmit` hooks and
  the conditional assessment steps.
- A pure `ukScoring` helper (`computeUkLevel`, `applyDepositLossGate`).
- UK question/answer label constants, the auto-pass answer set, the shares-experience set,
  the deposit-loss PASS answers, and the REFER thresholds.
- `selectFlow` + `OnboardingScreen` routing UK → GeneralFlow.

**Out of scope (deferred):**

- The `SelectAccountType` multi-platform-ThinkTrader step (reuse the existing `PlatformStep`).
- UK NIN/passport tax validation and multi-country tax residency (reuse the simplified
  `TaxInformationStep`).
- Other jurisdictions, TMEU PEP/FinRole, corporate/CE, retake, registration, KYC docs.
- C-1 (REFER loss-percentage wording) and C-2 (T&C/KID document links) remain the existing
  pre-production compliance follow-ups; UK has its own required loss percentage.

## Decisions (confirmed)

| Area              | Decision                                                                                                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jurisdiction      | UK individual; multi-path PASS/REFER/FAIL                                                                                                                                                                                                                               |
| Scoring           | Pure `ukScoring.ts`: `computeUkLevel(answers)` + `applyDepositLossGate(level, answer)`                                                                                                                                                                                  |
| Auto-pass         | `forexExperience ∈ ['moreThan60Trades','between11and60Trades','between1and10Trades']` → PASS (then gate); else undefined (show assessment)                                                                                                                              |
| No-forex scored   | with shares (`sharesFundsExperience ∈ ['moreThan60Trades','between11and60Trades','lessThan10Trades']`): `personalProfit+useLeverage > 0 → REFER else FAIL`; without shares: `personalProfit+useLeverage+unwantedMarketMovements+appleUseLeverage > 1 → REFER else FAIL` |
| Deposit-loss gate | if PASS and `UKDepositLoss` answer ∉ `['UKDepositLoss1','UKDepositLoss2']` → REFER (worst-of)                                                                                                                                                                           |
| Account-type      | Reuse `PlatformStep`; `SelectAccountType` deferred                                                                                                                                                                                                                      |
| Tax               | Reuse `TaxInformationStep`; UK NIN/passport deferred                                                                                                                                                                                                                    |
| REFER / Failure   | Reuse `ReferStep` + `makeAppFailed(UK_CONTACT_US_LINK)`                                                                                                                                                                                                                 |
| Flow selection    | `selectFlow` jurisdiction union gains `'UK'`; OnboardingScreen builder map gains UK                                                                                                                                                                                     |

## Architecture

### File structure

```
src/features/onboarding/flows/general/
  jurisdictions/uk.ts            (buildUkSteps)
  jurisdictions/uk.test.ts
  jurisdictions/ukScoring.ts     (pure: computeUkLevel, applyDepositLossGate)
  jurisdictions/ukScoring.test.ts
  constants.ts                   (+ UK labels/answers/thresholds, UK_CONTACT_US_LINK)
src/features/onboarding/
  flowSelection.ts / flowSelection.test.ts  (+ UK)
  OnboardingScreen.tsx                        (builder map + UK)
e2e/onboarding-uk.spec.ts
```

No engine change is needed; this slice is config + a pure scoring module + reuse.

### Pure scoring (`jurisdictions/ukScoring.ts`)

Operates on the `Record<label, { answer, score }>` produced by the existing `getUserAnswers`.

- **`applyDepositLossGate(level, depositLossAnswer)`**: returns `'REFER'` when `level === 'PASS'`
  and `depositLossAnswer` is truthy and not in `UK_DEPOSIT_LOSS_PASS_ANSWERS`
  (`['UKDepositLoss1','UKDepositLoss2']`); otherwise returns `level` unchanged (never upgrades).
- **`computeUkLevel(answers)`**: implements the no-forex scored path —
  - `forexExperience` in the auto-pass set → `'PASS'`.
  - `forexExperience === 'never'`: branch on shares experience (with-shares sum of
    `personalProfit+useLeverage` vs threshold 0 → REFER else FAIL; without-shares sum of
    `personalProfit+useLeverage+unwantedMarketMovements+appleUseLeverage` vs threshold 1 →
    REFER else FAIL).
  - otherwise (defensive) → `'FAIL'`.
    Missing answers are treated as score 0 / absent and never throw (a regulated scoring step
    must not crash on state divergence).

Constants in `constants.ts`: `UK` labels, `UK_FOREX_PASS_ANSWERS`, `UK_SHARES_EXPERIENCE_ANSWERS`,
`UK_DEPOSIT_LOSS_PASS_ANSWERS`, `UK_REFER_THRESHOLD_WITH_SHARES = 0`,
`UK_REFER_THRESHOLD_WITHOUT_SHARES = 1`, `UK_CONTACT_US_LINK` (flagged to confirm).

### UK config (`jurisdictions/uk.ts`)

`buildUkSteps(questions)` returns, in order:
personal → phone → address → **TaxInformation** (reused) → **platform** (reused
`PlatformStep`) → employment → employer (conditional) → source of funds → annual income →
savings → **UKDepositLoss** question (`shouldDisplay`: the backend returned it) →
**forexExperience** question (carries the **auto-pass** `beforeSubmit`: PASS-via-gate or
undefined) → **futuresOptionsExperience** / **personalProfit** / **useLeverage** /
**unwantedMarketMovements** / **appleUseLeverage** questions (each
`shouldDisplay: forexExperience === 'never'`; **appleUseLeverage** carries the **scored**
`beforeSubmit` → `applyDepositLossGate(computeUkLevel(answers), depositLossAnswer)`) →
**Refer** (reused, `shouldDisplay: appropriatenessLevel === 'REFER'`) → terms (`isLast`) →
failure (`isFailure`, `makeAppFailed(UK_CONTACT_US_LINK)`).

A `showWhenNoForexExperience(questions)` helper builds the `shouldDisplay` predicate
(reads the `forexExperience` answer via `getUserAnswers`).

### Outcome routing (reuses the runner)

- **Auto-pass:** the forexExperience `beforeSubmit` sets PASS; the assessment steps and Refer
  are skipped (their `shouldDisplay` is false) → terms → complete.
- **No-forex:** assessment steps show; the appleUseLeverage `beforeSubmit` sets REFER or FAIL.
  REFER → Refer step (confirm → terms / cancel → FAIL → failure); FAIL → failure page.
- The runner's failure check uses the freshly-computed level (the prior HIGH-1 protection),
  so a stale hydrated FAIL does not falsely trip (and the M-1 startup guard from the TMCY
  slice applies).

### Flow selection

`selectFlow` general variant becomes `jurisdiction: 'AU' | 'TMCY' | 'UK'`; UK domain →
`{ kind: 'general', jurisdiction: 'UK' }`. `OnboardingScreen`'s builder map gains
`UK: buildUkSteps`. AU/TMCY/simplified unchanged.

## Error handling

- Per-step submit failure → notification, stay on step.
- FAIL (scored or via Refer cancel) → failure page; REFER → Refer step.
- The scoring functions never throw on missing answers (default to score 0 / FAIL),
  avoiding a crash at the regulatory scoring step on state divergence.

## Testing

- **Unit (priority):** `ukScoring` — every path: auto-pass answers; no-forex with-shares
  (REFER at score > 0, FAIL at 0); no-forex without-shares (REFER at score > 1, FAIL at ≤ 1);
  the deposit-loss gate (PASS→REFER on a non-pass answer; unchanged for REFER/FAIL; unchanged
  when the answer is a pass answer); missing-answer guards.
- `buildUkSteps` structure (the forexExperience auto-pass hook, the conditional assessment
  `shouldDisplay`, the appleUseLeverage scored hook, Refer/terms/failure present); `selectFlow` UK.
- **E2E:** UK wiring (UK application → GeneralFlow → personal → phone), modelled on the
  AU/TMCY e2e (application carries `portalAccountDomain: 'UK'` + `organizationId`; questions
  non-empty including `forexExperience`).

## Compliance

The multi-path appropriateness logic is regulatory; `ukScoring` is pure and exhaustively
unit-tested. The reused `ReferStep` carries the existing C-1 placeholder for the
firm-specific retail-loss percentage (UK has its own required figure) and the C-2 T&C/KID
document-link follow-up. These remain pre-production compliance blockers requiring
compliance-supplied content. The security/compliance review gate applies before sign-off.

## Definition of done

- A UK individual applicant runs the UK GeneralFlow: PASS (forex-experienced or scored)
  completes (→ `PENDING_KYC` stub); REFER shows the confirm/cancel screen (confirm → terms,
  cancel → failure); FAIL → failure page.
- `computeUkLevel` + `applyDepositLossGate` produce the correct outcome for every documented
  path, with exhaustive unit tests.
- `selectFlow` routes UK → the UK GeneralFlow; AU/TMCY/simplified unchanged.
- `buildUkSteps` structure unit-tested; a Playwright e2e covers UK wiring.
- Lint, unit/component/integration tests, and the e2e pass under Node 20.
- Security/compliance review completed (the C-1/C-2 compliance follow-ups remain tracked).

## Risks and notes

- **Exact UK question/answer labels and thresholds** verified from the legacy `UK.tsx` /
  `questions.ts`: labels (`forexExperience`, `sharesFundsExperience`, `futuresOptionsExperience`,
  `personalProfit`, `useLeverage`, `unwantedMarketMovements`, `appleUseLeverage`, `UKDepositLoss`)
  all equal their keys; auto-pass answers `moreThan60Trades`/`between11and60Trades`/`between1and10Trades`;
  shares answers `moreThan60Trades`/`between11and60Trades`/`lessThan10Trades`; deposit-loss PASS
  answers `UKDepositLoss1`/`UKDepositLoss2`; thresholds 0 (with shares) / 1 (without).
- **Two scoring hooks** (auto-pass at forexExperience; scored at appleUseLeverage) feed one pure
  module — keeping the regulatory logic testable in isolation.
- **Deferred** (`SelectAccountType`, UK NIN/passport tax, multi-country residency) and the
  **C-1/C-2 compliance** items are explicit, tracked follow-ups.

import { test, expect } from '@playwright/test'

// Session establishment: this test drives the new two-step registration UI
// (register → personal-information) to reach /onboarding with PENDING_KYC,
// which renders the "Verify your email" button via OnboardingComplete.
test('completed onboarding leads to a successful email verification', async ({ page }) => {
  // Mock the REST auth/register endpoint (new registration path).
  await page.route('**/auth/register', (route) =>
    route.fulfill({
      json: {
        status: 'OK',
        tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' },
      },
    })
  )

  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    const ok = (result: unknown) =>
      route.fulfill({
        json: {
          id: 1,
          session_id: 's',
          token: 't',
          payload: [{ module: 'application', action, status: 'OK', result }],
        },
      })

    // Simplified Nigeria so the form routes to /account/personal-information.
    if (action === 'getCountries')
      return ok([
        {
          id: 158,
          name: 'Nigeria',
          code2: 'NG',
          code3: 'NGA',
          phoneCode: 234,
          european: false,
          organization: { id: 14, name: 'TMLC' },
          isSimplifyOnboarding: true,
        },
      ])

    // Personal-information form POSTs to simplified_submit_level_one.
    if (action === 'simplified_submit_level_one') return ok({ applicationId: 9 })

    // PENDING_KYC makes OnboardingScreen render <OnboardingComplete />.
    if (action === 'check_application_statuses') return ok([{ application_status: 'PENDING_KYC' }])

    // Empty array → loadApplication returns null; onboarding state comes from draft.
    if (action === 'getLastApplicationsInfo') return ok([])

    if (action === 'getQuestions') return ok([])

    if (action === 'get_user')
      return ok({
        id: 1,
        email: 'a@b.com',
        country: { id: 158 },
        additionalAttributes: {},
      })

    // Gate on the completion screen: required === true && verified !== true.
    // isuserverified must stay false throughout so the verify screen sends the OTP
    // and renders the form rather than the already-verified confirmation on mount.
    if (action === 'isemail_verification_required') return ok(true)
    if (action === 'isuserverified') return ok(false)
    if (action === 'send_verification_code') return ok(true)
    if (action === 'verify_otp_code') return ok(true)

    return ok({})
  })

  // Step 1a: email + password fields, then "Next" to proceed to country selection.
  await page.goto('/account/register')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByLabel('Password', { exact: true }).fill('Secret12!')
  await page.getByLabel(/confirm password/i).fill('Secret12!')
  await page.getByRole('button', { name: /next/i }).click()

  // Step 1b: select country (MUI TextField select + MenuItem), accept terms, submit.
  await page.getByLabel(/country of residence/i).click()
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: /terms/i }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // Step 2: personal information screen — fill first name, last name, DOB.
  await expect(page.getByRole('heading', { name: /personal information/i })).toBeVisible()
  await page.getByLabel(/first name/i).fill('Ann')
  await page.getByLabel(/last name/i).fill('Lee')
  await page.getByLabel(/day/i).fill('1')
  await page.getByLabel(/month/i).fill('1')
  await page.getByLabel(/year/i).fill('1990')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // Step 3: onboarding lands with PENDING_KYC — "Verify your email" button is shown.
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByRole('button', { name: /verify your email/i }).click()

  // Step 4: verify-email screen sends OTP on mount and shows confirmation text.
  await expect(page).toHaveURL(/\/account\/verify-email/)
  await expect(page.getByText(/we sent a 6-digit code/i)).toBeVisible()

  // Step 5: enter the 6-digit OTP.
  for (let i = 1; i <= 6; i++) {
    await page.getByLabel(`Digit ${i}`).fill(String(i))
  }

  // Step 6: successful verification shows inline confirmation.
  await expect(page.getByText(/email verified/i)).toBeVisible()
})

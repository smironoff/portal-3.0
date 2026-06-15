import { test, expect } from '@playwright/test'

// Session establishment: sessionStore.loggedIn is in-memory only (not persisted to
// localStorage), so seeding tokens at boot has no effect. The only way to flip
// loggedIn=true on a fresh page load is to complete an in-app flow that calls
// useSessionStore.getState().setLoggedIn(true). RegisterForm does this immediately
// after a successful incremental_submit, so we drive the registration UI first, then
// navigate to /onboarding where PENDING_KYC triggers the "Verify your email" button.
test('completed onboarding leads to a successful email verification', async ({ page }) => {
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
    if (action === 'getCountries')
      return ok([
        {
          id: 1,
          name: 'Australia',
          code2: 'AU',
          code3: 'AUS',
          phoneCode: 61,
          european: false,
          organization: { id: 7, name: 'AU' },
        },
      ])
    if (action === 'incremental_submit') return ok({ applicationId: 9, applicationStatus: 'INCOMPLETE' })
    if (action === 'getLastApplicationsInfo')
      return ok([{ applicationId: 9, status: 'PENDING_KYC', portalAccountDomain: 'AU' }])
    if (action === 'get_user')
      return ok({
        id: 1,
        email: 'a@b.com',
        firstName: 'Ann',
        lastName: 'Lee',
        country: { id: 1 },
        additionalAttributes: {},
      })
    if (action === 'getQuestions') return ok([])
    if (action === 'send_verification_code') return ok(true)
    if (action === 'verify_otp_code') return ok(true)
    return ok({})
  })

  // Step 1: complete registration so RegisterForm calls setLoggedIn(true)
  await page.goto('/account/register')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByLabel('Password', { exact: true }).fill('Secret12')
  await page.getByLabel(/confirm password/i).fill('Secret12')
  await page.getByRole('button', { name: /next/i }).click()

  await page.getByLabel(/country of residence/i).click()
  await page.getByRole('option', { name: 'Australia' }).click()
  await page.getByLabel(/i agree/i).click()
  await page.getByRole('button', { name: /create account/i }).click()

  // Step 2: onboarding lands with PENDING_KYC -- "Verify your email" button is shown
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByRole('button', { name: /verify your email/i }).click()

  // Step 3: verify-email screen sends OTP on mount and shows confirmation text
  await expect(page).toHaveURL(/\/account\/verify-email/)
  await expect(page.getByText(/we sent a 6-digit code/i)).toBeVisible()

  // Step 4: enter the 6-digit OTP
  for (let i = 1; i <= 6; i++) {
    await page.getByLabel(`Digit ${i}`).fill(String(i))
  }

  // Step 5: successful verification shows inline confirmation
  await expect(page.getByText(/email verified/i)).toBeVisible()
})

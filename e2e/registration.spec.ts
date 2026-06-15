import { test, expect } from '@playwright/test'

test('live registration creates an account and lands in onboarding', async ({ page }) => {
  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    const ok = (result: unknown) =>
      route.fulfill({ json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] } })
    if (action === 'getCountries')
      return ok([{ id: 1, name: 'Australia', code2: 'AU', code3: 'AUS', phoneCode: 61, european: false, organization: { id: 7, name: 'AU' } }])
    if (action === 'incremental_submit') return ok({ applicationId: 9, applicationStatus: 'INCOMPLETE' })
    // Omit portalAccountDomain so the loaded app uses the simplified flow, whose first
    // step is "Personal information" (mirrors the proven auth.spec.ts pattern). This e2e
    // proves the registration -> onboarding handoff, not jurisdiction routing.
    if (action === 'getLastApplicationsInfo') return ok([{ applicationId: 9, status: 'INCOMPLETE' }])
    if (action === 'getQuestions') return ok([])
    if (action === 'get_user') return ok({ id: 1, email: 'a@b.com', firstName: 'Ann', lastName: 'Lee', country: { id: 1 }, additionalAttributes: {} })
    return ok({})
  })

  await page.goto('/account/register')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByLabel('Password', { exact: true }).fill('Secret12')
  await page.getByLabel(/confirm password/i).fill('Secret12')
  await page.getByRole('button', { name: /next/i }).click()

  await page.getByLabel(/country of residence/i).click()
  await page.getByRole('option', { name: 'Australia' }).click()
  await page.getByLabel(/i agree/i).click()
  await page.getByRole('button', { name: /create account/i }).click()

  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByText('Personal information')).toBeVisible()
})

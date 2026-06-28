import { test, expect } from '@playwright/test'

test('email/password registration for a simplified country reaches onboarding', async ({ page }) => {
  await page.route('**/auth/register', (route) =>
    route.fulfill({ json: { status: 'OK', tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } } })
  )
  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    const ok = (result: unknown) =>
      route.fulfill({ json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] } })
    if (action === 'getCountries')
      return ok([{ id: 158, name: 'Nigeria', code2: 'NG', code3: 'NGA', organization: { id: 14, name: 'TMLC' }, isSimplifyOnboarding: true }])
    if (action === 'simplified_submit_level_one') return ok({ applicationId: 999 })
    if (action === 'check_application_statuses') return ok([{ application_status: 'INCOMPLETE' }])
    if (action === 'getLastApplicationsInfo') return ok([]) // empty for a fresh app
    if (action === 'getQuestions') return ok([])
    if (action === 'get_user') return ok({ id: 1, email: 'ng@b.com', country: { id: 158 }, additionalAttributes: {} })
    return ok({})
  })

  await page.goto('/account/register')
  await page.getByLabel(/email/i).fill('ng@b.com')
  await page.getByLabel('Password', { exact: true }).fill('Think123!')
  await page.getByLabel(/confirm password/i).fill('Think123!')
  await page.getByRole('button', { name: /next/i }).click()
  await page.getByLabel(/country of residence/i).click()
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: /terms/i }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // Personal Information screen
  await expect(page.getByRole('heading', { name: /personal information/i })).toBeVisible()
  await page.getByLabel(/first name/i).fill('Test')
  await page.getByLabel(/last name/i).fill('User')
  await page.getByLabel(/day/i).fill('1')
  await page.getByLabel(/month/i).fill('1')
  await page.getByLabel(/year/i).fill('1990')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // Lands in onboarding (Simplified flow), not stranded
  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByText(/loading your application/i)).toHaveCount(0)
})

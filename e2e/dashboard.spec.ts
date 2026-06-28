import { test, expect } from '@playwright/test'

test('approved user lands on the dashboard shell, navigates, and logs out', async ({ page }) => {
  await page.route('**/auth/login', (route) =>
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
      route.fulfill({ json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] } })
    if (action === 'get_user') return ok({ id: 1, email: 'a@b.com', additionalAttributes: {} })
    if (action === 'getLastApplicationsInfo') return ok([{ applicationId: 1, status: 'APPROVED' }])
    if (action === 'getQuestions') return ok([])
    return ok({})
  })

  await page.goto('/account/login')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByLabel('Password', { exact: true }).fill('secret1')
  await page.getByRole('button', { name: /sign in/i }).click()

  // login -> /onboarding -> OnboardingScreen sees APPROVED -> redirect /dashboard
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible()

  await page.getByRole('button', { name: 'Funds' }).click()
  await expect(page.getByRole('heading', { name: 'Funds' })).toBeVisible()

  await page.getByRole('button', { name: /log out/i }).click()
  await expect(page).toHaveURL(/\/account\/login/)
})

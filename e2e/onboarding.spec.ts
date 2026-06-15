import { test, expect } from '@playwright/test'

const tfboOk = (action: string | undefined, result: unknown) => ({
  json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] },
})

test('authenticated user completes Simplified level 1', async ({ page }) => {
  await page.route('**/auth/login', (r) =>
    r.fulfill({ json: { status: 'OK', tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } } })
  )
  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    if (action === 'get_user') return route.fulfill(tfboOk(action, { id: 1, email: 'a@b.com', additionalAttributes: {} }))
    if (action === 'getLastApplicationsInfo') return route.fulfill(tfboOk(action, [{ applicationId: 1, status: 'INCOMPLETE' }]))
    if (action === 'getQuestions') return route.fulfill(tfboOk(action, []))
    if (action === 'application_submit') return route.fulfill(tfboOk(action, { applicationStatus: 'INCOMPLETE', applicationId: 1 }))
    if (action === 'simplified_submit_level_one') return route.fulfill(tfboOk(action, { applicationId: 1 }))
    return route.fulfill(tfboOk(action, {}))
  })

  await page.goto('/account/login')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByLabel('Password', { exact: true }).fill('secret1')
  await page.getByRole('button', { name: /sign in/i }).click()

  // lands on onboarding -> level 1 personal info
  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByText('Personal information')).toBeVisible()
  await page.getByLabel('First name', { exact: true }).fill('Jo')
  await page.getByLabel('Last name', { exact: true }).fill('Lee')
  await page.getByLabel('Day', { exact: true }).fill('1')
  await page.getByLabel('Month', { exact: true }).fill('2')
  await page.getByLabel('Year', { exact: true }).fill('1990')
  await page.getByRole('button', { name: /continue/i }).click()

  // advances to phone step
  await expect(page.getByRole('heading', { name: 'Phone number' })).toBeVisible()
})

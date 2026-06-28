// e2e/registration-social.spec.ts
import { test, expect } from '@playwright/test'

// Minimal JWT with a base64url payload (header/sig are not validated client-side).
const b64url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const appleIdToken = `h.${b64url({ preferred_username: 'relay@privaterelay.appleid.com' })}.s`

const seedPkce = (state: string) => `
  sessionStorage.setItem('pkce', JSON.stringify({ codeVerifier: 'v', state: '${state}', provider: 'apple' }))
`

const mockNsdata = async (page: import('@playwright/test').Page) => {
  await page.route('**/protocol/openid-connect/token', (route) =>
    route.fulfill({ json: { access_token: 'AT', refresh_token: 'RT', id_token: appleIdToken, refresh_expires_in: 3600 } })
  )
  await page.route('**/auth/register', (route) =>
    route.fulfill({ json: { status: 'OK', tokens: { accessToken: 'PA', refreshToken: 'PR', refreshTokenValidUntil: '2030' } } })
  )
  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    const ok = (result: unknown) =>
      route.fulfill({ json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] } })
    if (action === 'getCountries')
      return ok([{ id: 158, name: 'Nigeria', code2: 'NG', code3: 'NGA', used: true, organization: { id: 14, name: 'TMLC' }, isSimplifyOnboarding: true }])
    if (action === 'simplified_submit_level_one') return ok({ applicationId: 999 })
    if (action === 'check_application_statuses') return ok([{ application_status: 'INCOMPLETE' }])
    if (action === 'getLastApplicationsInfo') return ok([])
    if (action === 'getQuestions') return ok([])
    if (action === 'get_user') return ok({ id: 1, email: 'a@b.com', country: { id: 158 }, additionalAttributes: {} })
    return ok({})
  })
}

test('new Apple user: callback collects missing details and reaches onboarding', async ({ page }) => {
  await page.addInitScript(seedPkce('st'))
  await page.route('**/auth/profile/status', (route) => route.fulfill({ json: { needsCompletion: true } }))
  await mockNsdata(page)

  await page.goto('/account/callback?code=c&state=st')
  await expect(page.getByRole('heading', { name: /complete your registration/i })).toBeVisible()

  await page.getByLabel(/first name/i).fill('Ada')
  await page.getByLabel(/last name/i).fill('Lovelace')
  await page.getByLabel(/^day$/i).fill('1')
  await page.getByLabel(/^month$/i).fill('2')
  await page.getByLabel(/^year$/i).fill('1990')
  await page.getByLabel(/country of residence/i).click()
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByLabel(/i agree to the terms/i).click()
  await page.getByRole('button', { name: /continue/i }).click()

  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByText(/loading your application/i)).toHaveCount(0)
})

test('returning social user: callback lands without the registration screen', async ({ page }) => {
  await page.addInitScript(seedPkce('st'))
  await page.route('**/auth/profile/status', (route) => route.fulfill({ json: { needsCompletion: false } }))
  await mockNsdata(page)

  await page.goto('/account/callback?code=c&state=st')

  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByRole('heading', { name: /complete your registration/i })).toHaveCount(0)
})

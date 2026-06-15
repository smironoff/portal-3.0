import { test, expect } from '@playwright/test'

const tfboOk = (action: string | undefined, result: unknown) => ({
  json: { id: 1, session_id: 's', token: 't', payload: [{ module: 'application', action, status: 'OK', result }] },
})

// A non-empty question set so the UK GeneralFlow renders (content irrelevant to the
// early personal/phone steps this test exercises). Must include forexExperience so
// the UK step builder (buildUkSteps) resolves correctly.
const questions = [
  {
    id: 1,
    question: 'Forex experience',
    label: 'forexExperience',
    isMandatory: true,
    answers: [
      { id: 1, answer: 'Never traded before', label: 'never', score: 0 },
      { id: 2, answer: 'Less than 1 year', label: 'lessThanOneYear', score: 5 },
    ],
  },
  {
    id: 2,
    question: 'Source of wealth',
    label: 'sourceWealth',
    isMandatory: true,
    answers: [
      { id: 3, answer: 'Employment', label: 'employment', score: 5 },
      { id: 4, answer: 'Inheritance', label: 'inheritance', score: 3 },
    ],
  },
]

test('authenticated UK user lands on GeneralFlow and progresses', async ({ page }) => {
  await page.route('**/auth/login', (r) =>
    r.fulfill({ json: { status: 'OK', tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } } })
  )
  await page.route('**/nsdata', async (route) => {
    const body = route.request().postDataJSON?.() as { payload?: Array<{ action?: string }> } | undefined
    const action = body?.payload?.[0]?.action
    if (action === 'get_user') return route.fulfill(tfboOk(action, { id: 1, email: 'a@b.com', additionalAttributes: {} }))
    if (action === 'getLastApplicationsInfo') return route.fulfill(tfboOk(action, [{ applicationId: 1, status: 'INCOMPLETE', portalAccountDomain: 'UK', organizationId: 1 }]))
    if (action === 'getQuestions') return route.fulfill(tfboOk(action, questions))
    if (action === 'application_submit') return route.fulfill(tfboOk(action, { applicationStatus: 'INCOMPLETE', applicationId: 1 }))
    return route.fulfill(tfboOk(action, {}))
  })

  await page.goto('/account/login')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByLabel('Password', { exact: true }).fill('secret1')
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByRole('heading', { name: 'Personal information' })).toBeVisible()
  await page.getByLabel(/first name/i).fill('Jo')
  await page.getByLabel(/last name/i).fill('Lee')
  await page.getByLabel(/day/i).fill('1')
  await page.getByLabel(/month/i).fill('2')
  await page.getByLabel(/year/i).fill('1990')
  await page.getByRole('button', { name: /continue/i }).click()

  await expect(page.getByRole('heading', { name: 'Phone number' })).toBeVisible()
})

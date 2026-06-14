import { test, expect } from '@playwright/test'

test('login with 2FA reaches the landing screen', async ({ page }) => {
  await page.route('**/auth/login', (route) =>
    route.fulfill({
      json: {
        status: 'TFA_REQUIRED',
        tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' },
      },
    })
  )
  await page.route('**/auth/tfa', (route) =>
    route.fulfill({
      json: {
        status: 'OK',
        tokens: { accessToken: 'a2', refreshToken: 'r2', refreshTokenValidUntil: '2030' },
      },
    })
  )
  await page.route('**/nsdata', (route) =>
    route.fulfill({
      json: {
        id: 1,
        session_id: 's',
        token: 't',
        payload: [
          { module: 'profile', action: 'get_user', status: 'OK', result: { id: 1, email: 'a@b.com', additionalAttributes: {} } },
        ],
      },
    })
  )

  await page.goto('/account/login')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByLabel('Password', { exact: true }).fill('secret1')
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/\/account\/login\/check/)
  await page.getByLabel(/code/i).fill('123456')
  await page.getByRole('button', { name: /verify/i }).click()

  await expect(page.getByText('Hello, Portal 3.0')).toBeVisible()
})

test('password reset request advances to the sent screen', async ({ page }) => {
  await page.route('**/nsdata', (route) =>
    route.fulfill({
      json: {
        id: 1,
        session_id: 's',
        token: 't',
        payload: [
          { module: 'authentication', action: 'forgot_password_web', status: 'OK', result: { password_reset: 'OK' } },
        ],
      },
    })
  )
  await page.goto('/account/reset')
  await page.getByLabel(/email/i).fill('a@b.com')
  await page.getByRole('button', { name: /send reset link/i }).click()
  await expect(page).toHaveURL(/\/account\/reset\/sent/)
})

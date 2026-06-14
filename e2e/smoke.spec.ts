import { test, expect } from '@playwright/test'

test('guarded route redirects to login, then dev sign-in reaches hello', async ({ page }) => {
  await page.goto('/hello')
  await expect(page).toHaveURL(/\/account\/login/)
  await page.getByRole('button', { name: 'Dev sign in' }).click()
  await expect(page.getByText('Hello, Portal 3.0')).toBeVisible()
})

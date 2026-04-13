import { expect, test } from '@playwright/test'

test('renders the editable surface and overlay', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Playground editor' }).click()

  await expect(page.locator('[data-caret-overlay="true"]')).toBeVisible()
})

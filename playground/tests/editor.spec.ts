import { expect, test } from '@playwright/test'

test('renders the editable surface and overlay', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'Basic Overlay editor' })

  await editor.click()
  await editor.press('ControlOrMeta+A')

  await expect(editor).toBeFocused()
  await expect(page.locator('body')).toContainText('Try selecting this text.')
  await expect(page.locator('body')).toContainText('The default overlay should appear on top of the content.')

  const selectedText = await page.evaluate(() => window.getSelection()?.toString() ?? '')
  expect(selectedText).toContain('Try selecting this text.')

  await expect(editor.locator('[data-caret-overlay="true"]')).toBeVisible()
})

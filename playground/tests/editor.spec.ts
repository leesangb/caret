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

test('keeps selection overlay aligned across wrapped lines', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'Basic Overlay editor' })

  await page.evaluate(() => {
    const editor = document.querySelector('[data-example-editor="basic"]')
    if (!(editor instanceof HTMLElement)) {
      throw new Error('Missing basic editor')
    }

    editor.style.width = '140px'

    const paragraph = editor.querySelector('p')
    const text = paragraph?.firstChild
    if (!(text instanceof Text)) {
      throw new Error('Missing paragraph text')
    }

    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, text.data.length)

    const selection = window.getSelection()
    if (selection === null) {
      throw new Error('Missing selection')
    }

    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })

  await expect(editor.locator('[data-caret-overlay="true"]')).toBeVisible()

  const tops = await editor.locator('[data-caret-overlay-part="selection"]').evaluateAll((nodes) => {
    return nodes.map((node) => Number.parseFloat((node as HTMLElement).style.top))
  })

  expect(new Set(tops).size).toBeGreaterThan(1)
})

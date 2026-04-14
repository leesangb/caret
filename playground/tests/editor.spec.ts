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

test('splits mixed-typography selections when same-line runs use different vertical boxes', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('textbox', { name: 'Mixed Typography editor' })

  await page.evaluate(() => {
    const editor = document.querySelector('[data-example-editor="mixed-typography"]')
    if (!(editor instanceof HTMLElement)) {
      throw new Error('Missing mixed editor')
    }

    const startNode = editor.querySelector('[data-mixed-segment="large"]')?.firstChild
    const endNode = editor.querySelector('[data-mixed-segment="tail"]')?.firstChild
    if (!(startNode instanceof Text) || !(endNode instanceof Text)) {
      throw new Error('Missing mixed typography text nodes')
    }

    const range = document.createRange()
    range.setStart(startNode, 0)
    range.setEnd(endNode, 18)

    const selection = window.getSelection()
    if (selection === null) {
      throw new Error('Missing selection')
    }

    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })

  await expect(editor.locator('[data-caret-overlay="true"]')).toBeVisible()

  const rects = await editor.locator('[data-caret-overlay-part="selection"]').evaluateAll((nodes) => {
    return nodes.map((node) => ({
      left: Number.parseFloat((node as HTMLElement).style.left),
      top: Number.parseFloat((node as HTMLElement).style.top),
      width: Number.parseFloat((node as HTMLElement).style.width),
      height: Number.parseFloat((node as HTMLElement).style.height)
    }))
  })

  expect(rects).toHaveLength(3)
  expect(rects[0]?.height).toBeGreaterThan(rects[1]?.height ?? 0)
  expect(rects[1]?.left).toBeGreaterThan(rects[0]?.left ?? 0)
  expect(rects[1]?.top).toBeGreaterThan(rects[0]?.top ?? 0)
})

test('supports fragment and line selection merge strategies', async ({ page }) => {
  await page.goto('/')

  const selectRange = async (exampleId: string, startSegment: string, endSegment: string, endOffset: number) => {
    await page.evaluate(({ exampleId, startSegment, endSegment, endOffset }) => {
      const editor = document.querySelector(`[data-example-editor="${exampleId}"]`)
      if (!(editor instanceof HTMLElement)) {
        throw new Error(`Missing editor: ${exampleId}`)
      }

      const startNode = editor.querySelector(`[data-mixed-segment="${startSegment}"]`)?.firstChild
      const endNode = editor.querySelector(`[data-mixed-segment="${endSegment}"]`)?.firstChild
      if (!(startNode instanceof Text) || !(endNode instanceof Text)) {
        throw new Error(`Missing mixed typography text nodes for: ${exampleId}`)
      }

      const range = document.createRange()
      range.setStart(startNode, 0)
      range.setEnd(endNode, endOffset)

      const selection = window.getSelection()
      if (selection === null) {
        throw new Error('Missing selection')
      }

      selection.removeAllRanges()
      selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    }, { exampleId, startSegment, endSegment, endOffset })
  }

  await selectRange('selection-fragment', 'fragment-large', 'fragment-tail', 7)
  const fragmentRects = await page.locator('[data-example-editor="selection-fragment"] [data-caret-overlay-part="selection"]').count()

  await selectRange('selection-line', 'line-large', 'line-tail', 7)
  const lineRects = await page.locator('[data-example-editor="selection-line"] [data-caret-overlay-part="selection"]').count()

  expect(fragmentRects).toBeGreaterThan(1)
  expect(lineRects).toBe(1)
})

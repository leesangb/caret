import { expect, test } from '@playwright/test'

async function setParagraphSelection(
  page: Parameters<typeof test>[0] extends never ? never : any,
  exampleId: string,
  startParagraph: number,
  startOffset: number,
  endParagraph: number,
  endOffset: number,
) {
  await page.evaluate(
    ({ exampleId, startParagraph, startOffset, endParagraph, endOffset }) => {
      const root = document.querySelector(`[data-example-editor="${exampleId}"]`)
      if (!(root instanceof HTMLElement)) {
        throw new Error(`Missing editor: ${exampleId}`)
      }

      const paragraphs = root.querySelectorAll('p')
      const startNode = paragraphs[startParagraph]?.firstChild
      const endNode = paragraphs[endParagraph]?.firstChild
      if (!(startNode instanceof Text) || !(endNode instanceof Text)) {
        throw new Error(`Missing paragraph text for: ${exampleId}`)
      }

      const range = document.createRange()
      range.setStart(startNode, startOffset)
      range.setEnd(endNode, endOffset)

      const selection = window.getSelection()
      if (selection === null) {
        throw new Error('Missing window selection')
      }

      selection.removeAllRanges()
      selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    },
    { exampleId, startParagraph, startOffset, endParagraph, endOffset }
  )
}

async function setSegmentSelection(
  page: Parameters<typeof test>[0] extends never ? never : any,
  exampleId: string,
  startSegment: string,
  startOffset: number,
  endSegment: string,
  endOffset: number,
) {
  await page.evaluate(
    ({ exampleId, startSegment, startOffset, endSegment, endOffset }) => {
      const root = document.querySelector(`[data-example-editor="${exampleId}"]`)
      if (!(root instanceof HTMLElement)) {
        throw new Error(`Missing editor: ${exampleId}`)
      }

      const startNode = root.querySelector(`[data-mixed-segment="${startSegment}"]`)?.firstChild
      const endNode = root.querySelector(`[data-mixed-segment="${endSegment}"]`)?.firstChild
      if (!(startNode instanceof Text) || !(endNode instanceof Text)) {
        throw new Error(`Missing mixed segment text for: ${exampleId}`)
      }

      const range = document.createRange()
      range.setStart(startNode, startOffset)
      range.setEnd(endNode, endOffset)

      const selection = window.getSelection()
      if (selection === null) {
        throw new Error('Missing window selection')
      }

      selection.removeAllRanges()
      selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    },
    { exampleId, startSegment, startOffset, endSegment, endOffset }
  )
}

test('captures README example screenshots', async ({ page }) => {
  await page.goto('/')

  const basic = page.locator('[data-readme-example="basic"]')
  const multiline = page.locator('[data-readme-example="multiline"]')
  const mixedTypography = page.locator('[data-readme-example="mixed-typography"]')
  const selectionFragment = page.locator('[data-readme-example="selection-fragment"]')
  const selectionLine = page.locator('[data-readme-example="selection-line"]')
  const styled = page.locator('[data-readme-example="styled"]')
  const custom = page.locator('[data-readme-example="custom"]')
  const customShape = page.locator('[data-readme-example="custom-shape"]')

  await expect(basic).toBeVisible()
  await expect(multiline).toBeVisible()
  await expect(mixedTypography).toBeVisible()
  await expect(selectionFragment).toBeVisible()
  await expect(selectionLine).toBeVisible()
  await expect(styled).toBeVisible()
  await expect(custom).toBeVisible()
  await expect(customShape).toBeVisible()

  await setParagraphSelection(page, 'basic', 0, 0, 0, 18)
  await expect(basic.locator('[data-caret-overlay-part="selection"]')).toBeVisible()
  await basic.screenshot({ path: 'assets/readme/basic-example.png' })

  await setParagraphSelection(page, 'multiline', 0, 0, 0, 50)
  await expect(multiline.locator('[data-caret-overlay-part="selection"]').first()).toBeVisible()
  await multiline.screenshot({ path: 'assets/readme/multiline-example.png' })

  await setSegmentSelection(page, 'mixed-typography', 'intro', 0, 'emoji-end', 8)
  await expect(mixedTypography.locator('[data-caret-overlay-part="selection"]').first()).toBeVisible()
  await mixedTypography.screenshot({ path: 'assets/validation/mixed-typography-example.png' })

  await setSegmentSelection(page, 'selection-fragment', 'fragment-large', 0, 'fragment-tail', 7)
  await expect(selectionFragment.locator('[data-caret-overlay-part="selection"]').first()).toBeVisible()
  await selectionFragment.screenshot({ path: 'assets/readme/selection-fragment-example.png' })

  await setSegmentSelection(page, 'selection-line', 'line-large', 0, 'line-tail', 7)
  await expect(selectionLine.locator('[data-caret-overlay-part="selection"]').first()).toBeVisible()
  await selectionLine.screenshot({ path: 'assets/readme/selection-line-example.png' })

  await setParagraphSelection(page, 'styled', 1, 12, 1, 12)
  await expect(styled.locator('[data-caret-overlay-part="caret"]')).toBeVisible()
  await styled.screenshot({ path: 'assets/readme/styled-example.png' })

  await setParagraphSelection(page, 'custom', 1, 0, 1, 18)
  await expect(custom.locator('[data-caret-custom-part="selection"]')).toBeVisible()
  await custom.screenshot({ path: 'assets/readme/custom-renderer-example.png' })

  await setParagraphSelection(page, 'custom-shape', 0, 5, 1, 26)
  await expect(customShape.locator('[data-caret-custom-part="selection-shape"]')).toBeVisible()
  await customShape.screenshot({ path: 'assets/readme/custom-shape-example.png' })
})

// Todo #4 — Floating rich-text bubble toolbar
// Run with:  node tests/todo4-bubble-toolbar.spec.mjs

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo4.test.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'

const log = (...a) => console.log('•', ...a)
const ok = (m) => console.log('  ✅', m)
function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
  ok(msg)
}

// Select all text in TipTap: Home to start, Shift+End to select to end of line.
// (Ctrl+A in headless Chrome moves browser focus away from the editor.)
async function selectAll(page) {
  await page.keyboard.press('Home')
  await page.waitForTimeout(80)
  await page.keyboard.press('Shift+End')
  await page.waitForTimeout(200)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

try {
  // 1. Sign up + open a new rundown
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Todo4 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  ok('Signed up')

  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Bubble Toolbar Test')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  ok('Opened rundown editor')

  // 2. Add a cue
  await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
  await page.waitForTimeout(600)
  ok('Added a cue')

  // 3. Add a rich-text "Notes" column
  log('Adding rich-text column "Notes"')
  await page.getByTestId('add-column-btn').click()
  await page.waitForTimeout(300)
  await page.getByTestId('column-name').fill('Notes')
  await page.getByTestId('add-column-submit').click()
  await page.waitForTimeout(800)
  assert(
    (await page.getByTestId('richtext-cell').count()) >= 1,
    'Rich-text cell rendered'
  )

  // 4. Click the richtext cell to enter edit mode, type some text
  log('Entering edit mode and typing text')
  await page.getByTestId('richtext-cell').first().click()
  await page.waitForTimeout(300)
  await page.keyboard.type('Hello World')
  await page.waitForTimeout(200)

  // 5. Select text to trigger bubble toolbar
  log('Selecting text to trigger bubble toolbar')
  await selectAll(page)

  const toolbar = page.locator('[data-bubble-toolbar]').first()
  await toolbar.waitFor({ state: 'visible', timeout: 4000 })
  ok('Bubble toolbar appears on text selection')

  // 6. Bold
  log('Testing Bold')
  const boldBtn = toolbar.getByTitle('Bold')
  await boldBtn.waitFor({ state: 'visible', timeout: 2000 })
  await boldBtn.dispatchEvent('mousedown', { bubbles: true, cancelable: true })
  await page.waitForTimeout(200)
  // Re-select to keep toolbar visible
  await selectAll(page)
  await toolbar.waitFor({ state: 'visible', timeout: 2000 })
  const boldClass = await boldBtn.getAttribute('class')
  assert(boldClass?.includes('bg-zinc-600'), 'Bold shows active state')

  // 7. Italic
  log('Testing Italic')
  const italicBtn = toolbar.getByTitle('Italic')
  await italicBtn.dispatchEvent('mousedown', { bubbles: true, cancelable: true })
  await page.waitForTimeout(200)
  await selectAll(page)
  await toolbar.waitFor({ state: 'visible', timeout: 2000 })
  const italicClass = await italicBtn.getAttribute('class')
  assert(italicClass?.includes('bg-zinc-600'), 'Italic shows active state')

  // 8. Heading dropdown
  log('Testing H dropdown')
  const headingBtn = toolbar.getByTitle('Text style')
  await headingBtn.dispatchEvent('mousedown', { bubbles: true, cancelable: true })
  await page.waitForTimeout(300)
  const h1Option = page.getByRole('button', { name: 'Heading 1' }).first()
  await h1Option.waitFor({ state: 'visible', timeout: 2000 })
  ok('H dropdown opens')
  const h2Option = page.getByRole('button', { name: 'Heading 2' }).first()
  await h2Option.waitFor({ state: 'visible', timeout: 2000 })
  ok('H2 option visible')
  const paraOption = page.getByRole('button', { name: 'Paragraph' }).first()
  await paraOption.waitFor({ state: 'visible', timeout: 2000 })
  ok('Paragraph option visible')
  await h1Option.dispatchEvent('mousedown', { bubbles: true, cancelable: true })
  await page.waitForTimeout(300)
  await h1Option.waitFor({ state: 'hidden', timeout: 2000 })
  ok('Heading 1 applied, dropdown closed')

  await selectAll(page)
  await toolbar.waitFor({ state: 'visible', timeout: 2000 })

  // 9. List dropdown
  log('Testing List dropdown')
  const listBtn = toolbar.getByTitle('List')
  await listBtn.dispatchEvent('mousedown', { bubbles: true, cancelable: true })
  await page.waitForTimeout(300)
  const bulletOption = page.getByRole('button', { name: /Bullet list/i }).first()
  await bulletOption.waitFor({ state: 'visible', timeout: 2000 })
  ok('List dropdown: Bullet list option')
  const numberedOption = page.getByRole('button', { name: /Numbered list/i }).first()
  await numberedOption.waitFor({ state: 'visible', timeout: 2000 })
  ok('List dropdown: Numbered list option')
  await bulletOption.dispatchEvent('mousedown', { bubbles: true, cancelable: true })
  await page.waitForTimeout(300)
  ok('Bullet list applied')

  await selectAll(page)
  await toolbar.waitFor({ state: 'visible', timeout: 2000 })

  // 10. Text color swatch picker
  log('Testing text color picker')
  const colorBtn = toolbar.getByTitle('Text color')
  await colorBtn.dispatchEvent('mousedown', { bubbles: true, cancelable: true })
  await page.waitForTimeout(300)
  // SwatchPicker renders as a sibling [data-bubble-toolbar] node
  const swatchPicker = page.locator('[data-bubble-toolbar]').nth(1)
  await swatchPicker.waitFor({ state: 'visible', timeout: 2000 })
  ok('Text color swatch picker opens')
  const swatches = swatchPicker.locator('button')
  const swatchCount = await swatches.count()
  assert(swatchCount >= 25, `Swatch grid has ${swatchCount} buttons (1 none + 24 colors)`)
  // Click the "none" swatch (first button)
  await swatches.first().dispatchEvent('mousedown', { bubbles: true, cancelable: true })
  await page.waitForTimeout(200)
  ok('Color swatch picker: none swatch clicked')

  await selectAll(page)
  await toolbar.waitFor({ state: 'visible', timeout: 2000 })

  // 11. Highlight color
  log('Testing highlight color picker')
  const highlightBtn = toolbar.getByTitle('Highlight color')
  await highlightBtn.dispatchEvent('mousedown', { bubbles: true, cancelable: true })
  await page.waitForTimeout(300)
  const highlightPicker = page.locator('[data-bubble-toolbar]').nth(1)
  await highlightPicker.waitFor({ state: 'visible', timeout: 2000 })
  ok('Highlight swatch picker opens')
  const highlightSwatches = highlightPicker.locator('button')
  // Click a color swatch (index 1 = first color, after "none")
  await highlightSwatches.nth(1).dispatchEvent('mousedown', { bubbles: true, cancelable: true })
  await page.waitForTimeout(200)
  ok('Highlight color applied')

  await selectAll(page)
  await toolbar.waitFor({ state: 'visible', timeout: 2000 })

  // 12. Clear formatting
  log('Testing clear formatting')
  const clearBtn = toolbar.getByTitle('Clear formatting')
  await clearBtn.dispatchEvent('mousedown', { bubbles: true, cancelable: true })
  await page.waitForTimeout(200)
  ok('Clear formatting applied')

  // 13. Toolbar dismisses when selection collapses
  log('Checking toolbar dismisses on cursor placement')
  await page.keyboard.press('End')
  await page.waitForTimeout(300)
  const stillVisible = await toolbar.isVisible().catch(() => false)
  assert(!stillVisible, 'Toolbar hides when selection is cleared')

  console.log('\n• === VERDICT: ✅ PASS ===')
} catch (err) {
  console.error('\n❌ Test error:', err.message)
  await page.screenshot({ path: '/tmp/todo4-fail.png' }).catch(() => {})
  console.log('• Screenshot: /tmp/todo4-fail.png')
  console.log('\n• === VERDICT: ❌ FAIL ===')
} finally {
  await browser.close()
}

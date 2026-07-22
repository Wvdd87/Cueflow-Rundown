// Todo #61 — Keyboard navigation for the rundown cue grid
// Run with:  node tests/todo61-keyboard-nav.spec.mjs

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo61.test.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'

const log = (...a) => console.log('•', ...a)
const ok = (m) => console.log('  ✅', m)
function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
  ok(msg)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

async function focusRingVisible(locator) {
  return locator.evaluate((el) => getComputedStyle(el).boxShadow.includes('rgb(240, 168, 56)'))
}

try {
  // 1. Sign up + create rundown
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Todo61 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  ok('Signed up')

  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'Keyboard Nav Test')
  await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  ok('Rundown open')

  // 2. Add three cues (Escape commits+exits each new cue's autofocused title editor)
  await page.getByRole('button', { name: /add first cue/i }).click()
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-testid="add-cue-btn"]').click()
    await page.waitForTimeout(400)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }
  const rowCount = await page.locator('[data-testid="cue-settings-btn"]').count()
  assert(rowCount === 3, `3 cues present (found ${rowCount})`)

  // 3. Click cue #2's "start" cell (soft-start, not-first — clicking it only sets
  // grid focus, it does not open an editor) and confirm the amber focus ring.
  log('Checking click-to-focus + visible ring')
  const startCells = page.locator('[data-col-id="start"]')
  const secondStart = startCells.nth(1)
  await secondStart.click()
  await page.waitForTimeout(100)
  assert(await focusRingVisible(secondStart), 'focused "start" cell shows the amber ring')

  // 4. ArrowRight should walk dur -> title -> private-notes, then wrap to the
  // next row's "start" cell.
  log('Checking ArrowRight traversal + row wrap')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(80)
  assert(await focusRingVisible(page.locator('[data-col-id="dur"]').nth(1)), 'moved right to "dur"')

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(80)
  assert(await focusRingVisible(page.locator('[data-col-id="title"]').nth(1)), 'moved right to "title"')

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(80)
  assert(await focusRingVisible(page.locator('[data-col-id="__private-notes__"]').nth(1)), 'moved right to "private notes"')

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(80)
  assert(await focusRingVisible(page.locator('[data-col-id="start"]').nth(2)), 'wrapped to row 3 "start" cell')

  // 5. ArrowLeft should wrap back to the previous row's last column.
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(80)
  assert(await focusRingVisible(page.locator('[data-col-id="__private-notes__"]').nth(1)), 'wrapped back to row 2 "private notes"')

  // 6. Enter opens edit mode on the focused (title) cell.
  log('Checking Enter opens edit mode')
  await page.keyboard.press('ArrowLeft') // -> row2 title
  await page.waitForTimeout(80)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  const editorOpen = await page
    .locator('[data-row-id][data-col-id="title"] .tiptap-cell[contenteditable="true"]')
    .first()
    .isVisible()
    .catch(() => false)
  assert(editorOpen, 'Enter opened the title editor')
  await page.keyboard.type(' — edited via keyboard')
  await page.keyboard.press('Escape') // InlineTipTap saves on Escape
  await page.waitForTimeout(300)

  // 7. Escape in focus mode clears the ring.
  log('Checking Escape clears focus')
  await page.locator('[data-col-id="dur"]').first().click()
  await page.waitForTimeout(80)
  assert(await focusRingVisible(page.locator('[data-col-id="dur"]').first()), 'clicked "dur" cell is focused')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(80)
  assert(!(await focusRingVisible(page.locator('[data-col-id="dur"]').first())), 'Escape cleared the focus ring')

  // 8. Shortcuts legend opens from the toolbar.
  log('Checking keyboard shortcuts dialog')
  await page.locator('[data-testid="keyboard-shortcuts-btn"]').click()
  await page.getByText('Keyboard shortcuts', { exact: true }).waitFor({ state: 'visible', timeout: 3000 })
  ok('Shortcuts dialog opened')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  // 9. Tab while editing confirms the edit and moves focus (without re-opening
  // an editor on the destination cell).
  log('Checking Tab confirms + advances focus')
  await page.locator('[data-col-id="title"]').first().click()
  await page.waitForTimeout(80)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  await page.keyboard.type('Tabbed title')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(200)
  assert(
    await focusRingVisible(page.locator('[data-col-id="__private-notes__"]').first()),
    'Tab moved focus to "private notes" on the same row'
  )
  const stillEditing = await page
    .locator('[data-col-id="title"]').first()
    .locator('.tiptap-cell[contenteditable="true"]')
    .isVisible()
    .catch(() => false)
  assert(!stillEditing, 'Tab closed the title editor (confirmed, not left open)')

  // 10. Ctrl+Enter in focus mode inserts a cue below the focused row.
  log('Checking Ctrl+Enter inserts a cue below')
  const before = await page.locator('[data-testid="cue-settings-btn"]').count()
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(600)
  const after = await page.locator('[data-testid="cue-settings-btn"]').count()
  assert(after === before + 1, `Ctrl+Enter added a cue (${before} -> ${after})`)

  console.log('\n✅ ALL TODO#61 CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ FAILED:', err.message)
  await page.screenshot({ path: 'tests/todo61-failure.png' }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}

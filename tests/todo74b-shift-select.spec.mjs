// Shift-selecting cells must NOT also start a native text selection (which
// blue-highlighted the cell text), and must not open the editor — while a plain
// click still edits. Run: node tests/todo74b-shift-select.spec.mjs
import { chromium } from 'playwright'
const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo74b.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'
const log = (...a) => console.log('•', ...a)
let pass = 0, fail = 0
const check = (c, m) => { if (c) { pass++; console.log('  ✅', m) } else { fail++; console.log('  ❌', m) } }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))
const selText = () => page.evaluate(() => (window.getSelection()?.toString() || '').trim())
const editable = () => page.evaluate(() => !!document.activeElement?.isContentEditable)

async function fillCol(rowIdx, text) {
  const cell = page.locator('[data-cue-id]').nth(rowIdx).getByTestId('richtext-cell').first()
  await cell.click()
  await page.waitForFunction(() => !!document.activeElement?.isContentEditable, null, { timeout: 5000 })
  await page.keyboard.type(text)
  await page.mouse.click(700, 8)
  await page.waitForTimeout(400)
}

try {
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Todo74b'); await page.fill('input[name="email"]', EMAIL); await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click(); await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'Todo74b'); await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  await page.getByRole('button', { name: /add first cue/i }).click()
  await page.locator('[data-cue-id]').first().waitFor({ state: 'visible', timeout: 10000 }); await page.waitForTimeout(400)
  for (let i = 0; i < 6 && (await page.locator('[data-cue-id]').count()) < 2; i++) {
    await page.locator('[data-testid="add-cue-btn"]').click().catch(() => {})
    await page.waitForTimeout(700)
  }
  await page.waitForFunction(() => document.querySelectorAll('[data-cue-id]').length >= 2, null, { timeout: 10000 })
  await page.waitForTimeout(400)
  await page.getByTestId('edit-columns-btn').click(); await page.waitForTimeout(150)
  await page.getByTestId('add-column-btn').click(); await page.waitForTimeout(250)
  await page.getByTestId('column-name').fill('Notes'); await page.getByTestId('add-column-submit').click(); await page.waitForTimeout(700)
  log('setup: 2 cues + Notes column')

  await fillCol(0, 'BEDANKING')
  await fillCol(1, 'CLOSING')
  log('filled 2 column cells')

  // Focus cell 0's Notes, then Shift+Click cell 1's Notes -> rectangular selection
  const c0 = page.locator('[data-cue-id]').nth(0).getByTestId('richtext-cell').first()
  const c2 = page.locator('[data-cue-id]').nth(1).getByTestId('richtext-cell').first()
  await c0.click(); await page.waitForTimeout(300) // focuses c0 (enters edit)
  await c2.click({ modifiers: ['Shift'] }) // shift-click extends selection from c0
  await page.waitForTimeout(400)

  const st = await selText()
  log('native text selection after shift-click =', JSON.stringify(st))
  check(st === '', 'shift-click does NOT create a native text selection')
  const highlighted = await page.evaluate(() => document.querySelectorAll('.cf-cell-selected').length)
  log('rectangular-selected cells =', highlighted)
  check(highlighted >= 2, 'shift-click builds a rectangular cell selection (highlighted cells)')
  check(!(await editable()), 'shift-click did NOT open the editor')

  // Shift+Arrow extend should also not select text
  await page.keyboard.press('Shift+ArrowUp'); await page.waitForTimeout(200)
  check((await selText()) === '', 'shift+arrow extend does NOT create a native text selection')

  // Regression: a plain click still edits a filled cell
  await page.mouse.click(700, 8); await page.waitForTimeout(200)
  await c0.click(); await page.waitForTimeout(400)
  check(await editable(), 'plain click on a filled cell still enters edit mode')

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
} catch (e) {
  console.log('SCRIPT ERROR:', e.message); fail++
} finally {
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
}

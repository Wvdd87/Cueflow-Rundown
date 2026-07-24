// Todo #77 — two-stage cell interaction: a single click SELECTS (focus mode)
// only; a second click on the focused cell, a double-click, or Enter/Space
// enters edit mode. Verified for a custom text column and the duration column.
// Run: node tests/todo77-two-stage.spec.mjs
import { chromium } from 'playwright'
const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo77.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'
const log = (...a) => console.log('•', ...a)
let pass = 0, fail = 0
const check = (c, m) => { if (c) { pass++; console.log('  ✅', m) } else { fail++; console.log('  ❌', m) } }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))
const editing = () => page.evaluate(() => !!document.activeElement?.isContentEditable || document.activeElement?.tagName === 'INPUT')

try {
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Todo77'); await page.fill('input[name="email"]', EMAIL); await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click(); await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'Todo77'); await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  await page.getByRole('button', { name: /add first cue/i }).click()
  await page.locator('[data-cue-id]').first().waitFor({ state: 'visible', timeout: 10000 }); await page.waitForTimeout(400)
  await page.getByTestId('edit-columns-btn').click(); await page.waitForTimeout(150)
  await page.getByTestId('add-column-btn').click(); await page.waitForTimeout(250)
  await page.getByTestId('column-name').fill('Notes'); await page.getByTestId('add-column-submit').click(); await page.waitForTimeout(700)
  log('setup done')

  const col = () => page.getByTestId('richtext-cell').first()
  const dur = () => page.locator('[data-cue-id]').first().locator('[data-col-id="dur"]')

  // Custom column — single click selects only (no edit)
  await page.mouse.click(700, 8); await page.waitForTimeout(200)
  await col().click(); await page.waitForTimeout(400)
  check(!(await editing()), 'custom column: first click selects (no edit)')
  // second click on the focused cell enters edit
  await col().click(); await page.waitForTimeout(400)
  check(await editing(), 'custom column: second click enters edit mode')
  await page.mouse.click(700, 8); await page.waitForTimeout(300)

  // Enter enters edit on a focused cell
  await col().click(); await page.waitForTimeout(400) // focus
  await page.keyboard.press('Enter'); await page.waitForTimeout(400)
  check(await editing(), 'custom column: Enter on a focused cell enters edit mode')
  await page.keyboard.press('Escape'); await page.mouse.click(700, 8); await page.waitForTimeout(300)

  // Double-click enters edit directly
  await col().dblclick(); await page.waitForTimeout(400)
  check(await editing(), 'custom column: double-click enters edit mode')
  await page.mouse.click(700, 8); await page.waitForTimeout(300)

  // Duration — single click selects only, second click / dblclick edits
  await dur().click(); await page.waitForTimeout(400)
  check(!(await editing()), 'duration: first click selects (no immediate edit)')
  await dur().click(); await page.waitForTimeout(400)
  check(await editing(), 'duration: second click enters edit mode')

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
} catch (e) {
  console.log('SCRIPT ERROR:', e.message); fail++
} finally {
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
}

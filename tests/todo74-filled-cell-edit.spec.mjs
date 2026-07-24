// Todo #74 — clicking a NON-EMPTY cell (custom richtext column or private note)
// must enter edit mode. Regression: a synchronous focusedCell update in the
// row's onClickCapture re-rendered the cell mid-click and swallowed the bubble
// onClick for dangerouslySetInnerHTML content, so filled cells only got the grid
// focus ring (Space still worked, a plain click did not). Fixed by deferring the
// grid-focus update. Run: node tests/todo74-filled-cell-edit.spec.mjs
import { chromium } from 'playwright'
const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo74.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'
const log = (...a) => console.log('•', ...a)
let pass = 0, fail = 0
const check = (c, m) => { if (c) { pass++; console.log('  ✅', m) } else { fail++; console.log('  ❌', m) } }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))
const editable = () => page.evaluate(() => !!document.activeElement?.isContentEditable)

async function fillAndReclick(locator, text, label) {
  // Two-stage (#77): double-click to enter edit mode directly.
  await locator().dblclick()
  await page.waitForFunction(() => !!document.activeElement?.isContentEditable, null, { timeout: 5000 })
  await page.keyboard.type(text)
  await page.waitForTimeout(300)
  await page.mouse.click(700, 8) // blur -> save + render as filled display
  await page.waitForTimeout(600)
  log(`${label} filled with`, JSON.stringify(await locator().innerText()))
  // Re-open the now-filled cell (double-click) — must enter edit mode.
  await locator().dblclick()
  await page.waitForTimeout(500)
  check(await editable(), `${label}: double-clicking a FILLED cell enters edit mode`)
  await page.mouse.click(700, 8)
  await page.waitForTimeout(300)
}

try {
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Todo74'); await page.fill('input[name="email"]', EMAIL); await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]'); await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click(); await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'Todo74'); await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  await page.getByRole('button', { name: /add first cue/i }).click()
  await page.locator('[data-cue-id]').first().waitFor({ state: 'visible', timeout: 10000 }); await page.waitForTimeout(400)
  await page.getByTestId('edit-columns-btn').click(); await page.waitForTimeout(150)
  await page.getByTestId('add-column-btn').click(); await page.waitForTimeout(250)
  await page.getByTestId('column-name').fill('Notes'); await page.getByTestId('add-column-submit').click(); await page.waitForTimeout(700)
  log('setup done')

  await fillAndReclick(() => page.getByTestId('richtext-cell').first(), '5X YOUNG VITO', 'custom column')
  const pn = () => page.getByTestId('private-note-cell').first()
  if (await pn().count()) await fillAndReclick(pn, 'operator note', 'private note')

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
} catch (e) {
  console.log('SCRIPT ERROR:', e.message); fail++
} finally {
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
}

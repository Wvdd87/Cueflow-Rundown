// Phase 4 cells: rich-text (TipTap) + dropdown cells.
// Run with:  node tests/phase4-cells.spec.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `p4.test.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'

const log = (...a) => console.log('•', ...a)
const ok = (m) => console.log('  ✅', m)
function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
  ok(msg)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') console.log('  [browser error]', m.text())
})
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

try {
  // 1. Sign up + open a new rundown -----------------------------------------
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'P4 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  ok('Signed up')

  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Cells Test Show')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  ok('Opened rundown editor')

  // 2. Add a cue -------------------------------------------------------------
  await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
  await page.waitForTimeout(600)
  ok('Added a cue')

  // 3. Add a rich-text column "Notes" ---------------------------------------
  log('Adding rich-text column "Notes"')
  await page.getByTestId('add-column-btn').click()
  await page.waitForTimeout(300)
  await page.getByTestId('column-name').fill('Notes')
  await page.getByTestId('add-column-submit').click()
  await page.waitForTimeout(800)
  assert(
    (await page.getByTestId('richtext-cell').count()) >= 1,
    'Rich-text cell rendered for Notes column'
  )

  // 4. Add a dropdown column "Status" with options --------------------------
  log('Adding dropdown column "Status"')
  await page.getByTestId('add-column-btn').click()
  await page.waitForTimeout(300)
  await page.getByTestId('column-name').fill('Status')
  await page.getByTestId('coltype-dropdown').click()
  await page.waitForTimeout(200)
  await page.getByTestId('column-options').fill('Ready\nStandby\nLive\nDone')
  await page.getByTestId('add-column-submit').click()
  await page.waitForTimeout(800)
  assert(
    (await page.getByTestId('dropdown-cell').count()) >= 1,
    'Dropdown cell rendered for Status column'
  )

  // 5. Rich-text editing: type + bold ---------------------------------------
  log('Editing rich-text cell (type + bold)')
  await page.getByTestId('richtext-cell').first().click()
  await page.waitForSelector('.ProseMirror', { timeout: 5000 })
  await page.waitForTimeout(300)
  await page.keyboard.type('hello world')
  await page.keyboard.press('ControlOrMeta+a')
  await page.waitForTimeout(150)
  await page.locator('button[title="Bold"]').click()
  await page.waitForTimeout(150)
  await page.keyboard.press('Escape') // saves + closes the editor
  await page.waitForTimeout(800)

  const notesCell = page.getByTestId('richtext-cell').first()
  const notesText = await notesCell.textContent()
  const notesHtml = await notesCell.innerHTML()
  log('notes text:', JSON.stringify(notesText), '| has <strong>:', notesHtml.includes('strong'))
  assert(notesText?.includes('hello world'), 'Rich-text content saved ("hello world")')
  assert(/<strong|font-weight:\s*bold|font-weight:\s*600/i.test(notesHtml), 'Bold formatting persisted')

  // 6. Dropdown: pick "Live" -------------------------------------------------
  log('Selecting dropdown value "Live"')
  await page.getByTestId('dropdown-cell').first().click()
  await page.waitForTimeout(300)
  await page.getByRole('menuitem', { name: 'Live' }).click()
  await page.waitForTimeout(700)
  const ddText = await page.getByTestId('dropdown-cell').first().textContent()
  log('dropdown value:', JSON.stringify(ddText))
  assert(ddText?.includes('Live'), 'Dropdown value selected ("Live")')

  // 7. Reload → values persisted in DB --------------------------------------
  log('Reloading to confirm persistence')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const notesAfter = await page.getByTestId('richtext-cell').first().textContent()
  const ddAfter = await page.getByTestId('dropdown-cell').first().textContent()
  assert(notesAfter?.includes('hello world'), 'Rich-text persisted after reload')
  assert(ddAfter?.includes('Live'), 'Dropdown persisted after reload')

  await page.screenshot({ path: 'tests/phase4-cells-result.png', fullPage: false })
  ok('Screenshot saved to tests/phase4-cells-result.png')

  console.log('\n🎉 ALL PHASE 4 CELL CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  await page.screenshot({ path: 'tests/phase4-cells-failure.png', fullPage: false }).catch(() => {})
  console.error('   Screenshot: tests/phase4-cells-failure.png')
  process.exitCode = 1
} finally {
  await browser.close()
}

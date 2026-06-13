// Phase 4d: @-mentions + $-variables (requires schema_phase4.sql applied).
// Run with:  node tests/phase4-mentions-vars.spec.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `p4mv.test.${rand}@gmail.com`
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
  // 1. Sign up + open a rundown with one cue + a Notes column ---------------
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'P4MV Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })

  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Mentions & Vars Show')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })

  await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
  await page.waitForTimeout(500)

  await page.getByTestId('add-column-btn').click()
  await page.waitForTimeout(300)
  await page.getByTestId('column-name').fill('Notes')
  await page.getByTestId('add-column-submit').click()
  await page.waitForTimeout(700)
  ok('Rundown ready (cue + Notes column)')

  // 2. Open Settings → add a variable + a mention ---------------------------
  log('Opening Rundown settings')
  await page.locator('button[title="Rundown settings"]').click()
  await page.waitForTimeout(400)

  // Variable: host = Alice
  await page.getByTestId('tab-variables').click()
  await page.getByTestId('new-variable-key').fill('host')
  await page.getByTestId('new-variable-value').fill('Alice')
  await page.getByTestId('add-variable-btn').click()
  await page.waitForTimeout(700)
  assert(
    (await page.getByTestId('var-value-host').count()) === 1,
    'Variable "host" created (= Alice)'
  )

  // Mention: Camera 1
  await page.getByTestId('tab-mentions').click()
  await page.getByTestId('new-mention-name').fill('Camera 1')
  await page.getByTestId('new-mention-desc').fill('Stage left wide shot')
  await page.getByTestId('add-mention-btn').click()
  await page.waitForTimeout(700)
  assert(
    await page.getByText('Camera 1').first().isVisible(),
    'Mention "Camera 1" created'
  )

  // Close settings
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // 3. Insert $variable + @mention into the Notes cell ----------------------
  log('Inserting $host and @Camera into the cell')
  await page.getByTestId('richtext-cell').first().click()
  await page.waitForSelector('.ProseMirror', { timeout: 5000 })
  await page.waitForTimeout(300)

  await page.keyboard.type('$host')
  await page.getByTestId('suggestion-popup').first().waitFor({ timeout: 4000 })
  ok('Variable suggestion popup appeared')
  await page.keyboard.press('Enter') // insert $host node
  await page.waitForTimeout(200)

  await page.keyboard.type(' with ')
  await page.keyboard.type('@Camera')
  await page.getByTestId('suggestion-popup').first().waitFor({ timeout: 4000 })
  ok('Mention suggestion popup appeared')
  await page.keyboard.press('Enter') // insert @Camera 1 node
  await page.waitForTimeout(200)

  await page.keyboard.press('Escape') // save + close cell
  await page.waitForTimeout(800)

  // 4. Cell display resolves the variable + shows the mention ---------------
  const cell = page.getByTestId('richtext-cell').first()
  const text1 = await cell.textContent()
  log('cell text:', JSON.stringify(text1))
  assert(
    (await page.locator('[data-mention-suggestion-char="$"]').count()) >= 1,
    'Variable chip rendered in cell'
  )
  assert(
    (await page.locator('[data-mention-suggestion-char="@"]').count()) >= 1,
    'Mention chip rendered in cell'
  )
  assert(text1?.includes('Alice'), 'Variable resolved to its value ("Alice")')
  assert(text1?.includes('Camera 1'), 'Mention shows its name ("Camera 1")')

  // 5. Live update: change host → Bob, cell updates without reload -----------
  log('Changing variable value Alice → Bob (live)')
  await page.locator('button[title="Rundown settings"]').click()
  await page.waitForTimeout(300)
  await page.getByTestId('tab-variables').click()
  const valInput = page.getByTestId('var-value-host')
  await valInput.fill('Bob')
  await valInput.press('Enter')
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape') // close settings
  await page.waitForTimeout(500)

  const text2 = await cell.textContent()
  log('cell text after edit:', JSON.stringify(text2))
  assert(text2?.includes('Bob'), 'Cell variable updated live to "Bob"')
  assert(!text2?.includes('Alice'), 'Old value "Alice" no longer shown')

  // 6. Persistence after reload ---------------------------------------------
  log('Reloading to confirm persistence')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const text3 = await page.getByTestId('richtext-cell').first().textContent()
  log('cell text after reload:', JSON.stringify(text3))
  assert(text3?.includes('Bob'), 'Variable value persisted ("Bob") after reload')
  assert(text3?.includes('Camera 1'), 'Mention persisted after reload')

  await page.screenshot({ path: 'tests/phase4-mentions-vars-result.png' })
  ok('Screenshot saved to tests/phase4-mentions-vars-result.png')

  console.log('\n🎉 ALL PHASE 4d (MENTIONS + VARIABLES) CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  await page
    .screenshot({ path: 'tests/phase4-mentions-vars-failure.png' })
    .catch(() => {})
  console.error('   Screenshot: tests/phase4-mentions-vars-failure.png')
  process.exitCode = 1
} finally {
  await browser.close()
}

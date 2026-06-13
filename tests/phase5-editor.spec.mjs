// Phase 5 editor polish: auto-numbering, subtitle, status badge, colored
// dropdown options, private notes, hide-for-me, rundown menu, live extras.
// Requires schema_phase5.sql applied.  Run:  node tests/phase5-editor.spec.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `p5.test.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'

const log = (...a) => console.log('•', ...a)
const ok = (m) => console.log('  ✅', m)
function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
  ok(msg)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 850 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))
let hydrationWarnings = 0
page.on('console', (m) => {
  if (m.type() === 'error' && /hydrat/i.test(m.text())) hydrationWarnings++
})

async function addCue() {
  await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
  await page.waitForTimeout(500)
}

try {
  // Setup --------------------------------------------------------------------
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'P5 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Editor Polish Show')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  ok('Rundown editor open')

  // 1. Auto numbering --------------------------------------------------------
  await addCue()
  await addCue()
  await addCue()
  const numbers = await page.locator('div.w-12 span').allTextContents()
  log('cue numbers:', numbers.slice(0, 3))
  assert(
    numbers.includes('1') && numbers.includes('2') && numbers.includes('3'),
    'Cues auto-numbered 1, 2, 3'
  )

  // 2. Subtitle --------------------------------------------------------------
  log('Adding a subtitle to cue 1')
  await page.getByText('Add a subtitle…').first().click({ force: true })
  await page.waitForTimeout(150)
  await page.keyboard.type('Opening segment')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  assert(
    await page.getByText('Opening segment').first().isVisible(),
    'Subtitle saved + shown'
  )

  // 3. Status badge ----------------------------------------------------------
  log('Changing status Draft → Approved')
  assert(
    (await page.getByTestId('status-badge').textContent())?.includes('Draft'),
    'Status starts as Draft'
  )
  await page.getByTestId('status-badge').click()
  await page.waitForTimeout(200)
  await page.getByRole('menuitem', { name: 'Approved' }).click()
  await page.waitForTimeout(500)
  assert(
    (await page.getByTestId('status-badge').textContent())?.includes('Approved'),
    'Status badge now Approved'
  )

  // 4. Dropdown column with coloured options --------------------------------
  log('Adding dropdown column with coloured options')
  await page.getByTestId('add-column-btn').click()
  await page.waitForTimeout(300)
  await page.getByTestId('column-name').fill('Status')
  await page.getByTestId('coltype-dropdown').click()
  await page.waitForTimeout(200)
  await page.getByTestId('opt-value-0').fill('Ready')
  await page.getByTestId('add-option-row').click()
  await page.getByTestId('opt-value-1').fill('Live')
  // give "Live" option a colour
  await page.getByTestId('opt-color-1').click()
  await page.waitForTimeout(150)
  await page.getByTitle('Red').last().click()
  await page.waitForTimeout(150)
  await page.getByTestId('add-column-submit').click()
  await page.waitForTimeout(800)
  assert(
    (await page.getByTestId('dropdown-cell').count()) >= 1,
    'Dropdown column added'
  )

  log('Selecting coloured option "Live"')
  await page.getByTestId('dropdown-cell').first().click()
  await page.waitForTimeout(300)
  await page.getByRole('menuitem', { name: 'Live' }).click()
  await page.waitForTimeout(500)
  const pill = page.getByTestId('dropdown-cell').first().locator('span').first()
  const bg = await pill.evaluate((el) => getComputedStyle(el).backgroundColor)
  log('pill background:', bg)
  assert(/rgb/.test(bg) && bg !== 'rgba(0, 0, 0, 0)', 'Option pill is coloured')

  // 5. Private notes ---------------------------------------------------------
  log('Writing a private note')
  await page.getByTestId('private-note-cell').first().click()
  await page.waitForTimeout(150)
  await page.keyboard.type('Remember to cue music')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  assert(
    await page.getByText('Remember to cue music').first().isVisible(),
    'Private note saved'
  )

  // 6. Hide column for me + eye restore -------------------------------------
  log('Hiding the Status column for me')
  await page.getByText('Status', { exact: true }).first().hover()
  await page.waitForTimeout(150)
  // open the column "..." menu (the MoreHorizontal button within the header)
  await page
    .locator('.group\\/col')
    .filter({ hasText: 'Status' })
    .getByRole('button')
    .last()
    .click()
  await page.waitForTimeout(200)
  await page.getByRole('menuitem', { name: /hide for me/i }).click()
  await page.waitForTimeout(400)
  assert(
    (await page.getByTestId('dropdown-cell').count()) === 0,
    'Status column hidden (cells gone)'
  )
  await page.getByTitle(/show .* hidden column/i).click()
  await page.waitForTimeout(400)
  assert(
    (await page.getByTestId('dropdown-cell').count()) >= 1,
    'Eye icon restored the hidden column'
  )

  // 7. Rundown menu → Mentions opens settings -------------------------------
  log('Rundown menu → Mentions')
  await page.getByTestId('rundown-menu').click()
  await page.waitForTimeout(200)
  await page.getByRole('menuitem', { name: /mentions/i }).click()
  await page.waitForTimeout(400)
  assert(
    await page.getByText('Rundown settings').isVisible(),
    'Settings dialog opened from Rundown menu'
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // 8. Persistence after reload ---------------------------------------------
  log('Reloading to confirm persistence')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  assert(
    (await page.getByTestId('status-badge').textContent())?.includes('Approved'),
    'Status persisted (Approved) after reload'
  )
  assert(
    await page.getByText('Opening segment').first().isVisible(),
    'Subtitle persisted after reload'
  )
  assert(
    await page.getByText('Remember to cue music').first().isVisible(),
    'Private note persisted after reload'
  )

  // 9. Live mode extras ------------------------------------------------------
  log('Entering live mode')
  await page.getByRole('button', { name: /run show/i }).click()
  await page.waitForTimeout(800)
  assert(
    (await page.getByTestId('transport-elapsed').count()) > 0,
    'Transport shows count-up elapsed timer'
  )
  assert(
    (await page.getByTestId('transport-overunder').count()) > 0,
    'Transport shows Over/Under'
  )
  assert(
    (await page.getByText('Current cue').count()) > 0,
    'CURRENT CUE label shown'
  )
  assert(
    (await page.locator('button[title="Previous cue"]').count()) > 0,
    'Prev-cue button present'
  )

  // 10. Status badge on the dashboard ---------------------------------------
  log('Checking the status badge on the dashboard')
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  assert(
    (await page.getByText('Approved').count()) >= 1,
    'Rundown shows its "Approved" status badge on the dashboard'
  )

  await page.screenshot({ path: 'tests/phase5-editor-result.png' })
  ok('Screenshot saved to tests/phase5-editor-result.png')

  assert(hydrationWarnings === 0, `No hydration warnings (saw ${hydrationWarnings})`)

  console.log('\n🎉 ALL PHASE 5 EDITOR CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  await page.screenshot({ path: 'tests/phase5-editor-failure.png' }).catch(() => {})
  console.error('   Screenshot: tests/phase5-editor-failure.png')
  process.exitCode = 1
} finally {
  await browser.close()
}

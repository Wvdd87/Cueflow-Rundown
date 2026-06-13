// Phase 7: soft-start auto-advance (auto-start chains).
// Requires schema_phase7.sql (cues.auto_start). Run:
//   node tests/phase7-autostart.spec.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `p7.test.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'

const log = (...a) => console.log('•', ...a)
const ok = (m) => console.log('  ✅', m)
function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
  ok(msg)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1300, height: 820 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

async function setDuration(index, text) {
  const durBtns = page
    .locator('button.font-mono.tabular-nums')
    .filter({ hasText: /^\d{1,2}:\d{2}$/ })
  await durBtns.nth(index).click()
  const input = page.locator('input:focus')
  await input.fill(text)
  await input.press('Enter')
  await page.waitForTimeout(250)
}
async function setTitle(index, text) {
  // .text-sm targets the title button only (subtitle button is .text-xs)
  await page.locator('button.text-sm.w-full.truncate').nth(index).click()
  const input = page.locator('input:focus')
  await input.fill(text)
  await input.press('Enter')
  await page.waitForTimeout(200)
}

try {
  // Setup --------------------------------------------------------------------
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'P7 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Auto-start Show')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
    await page.waitForTimeout(450)
  }
  await setTitle(0, 'Alpha')
  await setTitle(1, 'Bravo')
  await setTitle(2, 'Charlie')
  await setDuration(0, '2s') // cue 1 → 2s so auto-advance is quick
  ok('Rundown ready (Alpha/Bravo/Charlie, cue 1 = 2s)')

  // 1. Auto-start toggle present + off by default ---------------------------
  const toggles = page.getByTestId('autostart-toggle')
  const toggleCount = await toggles.count()
  log('auto-start toggles between cues:', toggleCount)
  assert(toggleCount === 2, 'A toggle exists between each consecutive cue (2 for 3 cues)')
  assert(
    (await toggles.first().getAttribute('data-on')) === '0',
    'Auto-start is off by default'
  )

  // 2. Enable auto-start on cue 2 (toggle below cue 1) -----------------------
  log('Enabling auto-start on cue 2')
  await toggles.first().click({ force: true })
  await page.waitForTimeout(500)
  assert(
    (await toggles.first().getAttribute('data-on')) === '1',
    'Toggle now shows auto-start ON (down arrow)'
  )

  // 3. Persistence -----------------------------------------------------------
  log('Reloading to confirm persistence')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  assert(
    (await page.getByTestId('autostart-toggle').first().getAttribute('data-on')) === '1',
    'Auto-start persisted after reload'
  )

  // 4. Live auto-advance -----------------------------------------------------
  log('Running the show — cue 1 should auto-advance to cue 2 after 2s')
  await page.getByRole('button', { name: /run show/i }).click()
  await page.waitForTimeout(600)
  const titleAtStart = await page.getByTestId('transport-cue-title').textContent()
  log('active cue at start:', titleAtStart)
  assert(titleAtStart?.includes('Alpha'), 'Show starts on cue 1 (Alpha)')

  await page.waitForTimeout(3200) // > cue 1 duration (2s)
  const titleAfter = await page.getByTestId('transport-cue-title').textContent()
  log('active cue after 2s:', titleAfter)
  assert(
    titleAfter?.includes('Bravo'),
    'Auto-advanced to cue 2 (Bravo) automatically when cue 1 elapsed'
  )

  await page.screenshot({ path: 'tests/phase7-autostart-result.png' })
  ok('Screenshot saved to tests/phase7-autostart-result.png')

  console.log('\n🎉 ALL PHASE 7 AUTO-START CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  await page.screenshot({ path: 'tests/phase7-autostart-failure.png' }).catch(() => {})
  console.error('   Screenshot: tests/phase7-autostart-failure.png')
  process.exitCode = 1
} finally {
  await browser.close()
}

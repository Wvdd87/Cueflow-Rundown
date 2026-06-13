// Hard-start auto-fire: a hard-start cue fires (the show jumps to it) when the
// wall-clock time reaches its fixed start time. No migration needed. Run:
//   node tests/phase8-hardstart.spec.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `hs.test.${rand}@gmail.com`
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

async function setTitle(index, text) {
  await page.locator('button.text-sm.w-full.truncate').nth(index).click()
  const input = page.locator('input:focus')
  await input.fill(text)
  await input.press('Enter')
  await page.waitForTimeout(200)
}

try {
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'HS Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Hard Start Show')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
    await page.waitForTimeout(450)
  }
  await setTitle(0, 'Alpha')
  await setTitle(1, 'Bravo')
  ok('Rundown ready (Alpha, Bravo)')

  // Make cue 2 a hard-start at now + 4s -------------------------------------
  log('Making cue 2 a hard-start at now + 4s')
  await page.locator('button[title="Cue options"]').nth(1).click()
  await page.waitForTimeout(200)
  await page.getByRole('menuitem', { name: /make hard start/i }).click()
  await page.waitForTimeout(500)

  const target = new Date(Date.now() + 4000)
  const hhmmss = [target.getHours(), target.getMinutes(), target.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
  // cue 2's start is now an editable hard-start button (HH:MM:SS)
  const startBtns = page
    .locator('button.font-mono.tabular-nums')
    .filter({ hasText: /^\d{2}:\d{2}:\d{2}$/ })
  await startBtns.nth(1).click()
  const startInput = page.locator('input:focus')
  await startInput.fill(hhmmss)
  await startInput.press('Enter')
  await page.waitForTimeout(500)
  ok(`Cue 2 hard-start set to ${hhmmss}`)

  // Run the show — should auto-fire cue 2 when the clock reaches its time ----
  log('Running the show')
  await page.getByRole('button', { name: /run show/i }).click()
  await page.waitForTimeout(600)
  const atStart = await page.getByTestId('transport-cue-title').textContent()
  log('active cue at start:', atStart)
  assert(atStart?.includes('Alpha'), 'Show starts on cue 1 (Alpha)')

  await page.waitForTimeout(5500) // wait past the hard-start time (+4s)
  const after = await page.getByTestId('transport-cue-title').textContent()
  log('active cue after hard-start time:', after)
  assert(
    after?.includes('Bravo'),
    'Hard-start cue 2 (Bravo) auto-fired when wall-clock reached its time'
  )

  await page.screenshot({ path: 'tests/phase8-hardstart-result.png' })
  ok('Screenshot saved')
  console.log('\n🎉 ALL HARD-START AUTO-FIRE CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  await page.screenshot({ path: 'tests/phase8-hardstart-failure.png' }).catch(() => {})
  console.error('   Screenshot: tests/phase8-hardstart-failure.png')
  process.exitCode = 1
} finally {
  await browser.close()
}

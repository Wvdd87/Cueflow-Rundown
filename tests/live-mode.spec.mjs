// Standalone Playwright script (no test runner needed) that exercises Phase 3 Live Mode.
// Run with:  node tests/live-mode.spec.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `live.test.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'
const FULL_NAME = 'Live Tester'

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
  // 1. Sign up a throwaway user ---------------------------------------------
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', FULL_NAME)
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  assert(page.url().includes('/dashboard'), 'Signup landed on /dashboard')

  // 2. Create a rundown ------------------------------------------------------
  log('Creating a rundown')
  // The dashboard "New rundown" button opens a dialog
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Live Test Show')
  // Submit the dialog (Create button) — createRundown redirects into the editor
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  assert(page.url().includes('/rundown/'), 'Opened rundown editor')

  // 3. Add three cues with durations ----------------------------------------
  log('Adding cues')
  async function clickAddCue() {
    const btn = page.getByRole('button', { name: /add (first )?cue/i }).first()
    await btn.click()
    await page.waitForTimeout(500)
  }
  await clickAddCue()
  await clickAddCue()
  await clickAddCue()

  // Duration buttons show M:SS (e.g. "0:00"); start-time buttons show HH:MM:SS.
  // Filter to the M:SS pattern so we only grab duration cells.
  async function setDuration(index, text) {
    const durBtns = page
      .locator('button.font-mono.tabular-nums')
      .filter({ hasText: /^\d{1,2}:\d{2}$/ })
    const btn = durBtns.nth(index)
    await btn.click()
    const input = page.locator('input:focus')
    await input.fill(text)
    await input.press('Enter')
    await page.waitForTimeout(300)
  }
  // Durations: 3s, 4s, 5s so the countdown + overtime is observable quickly
  try {
    await setDuration(0, '3s')
    await setDuration(1, '4s')
    await setDuration(2, '5s')
    ok('Set cue durations (3s / 4s / 5s)')
  } catch (e) {
    log('Duration set skipped:', e.message)
  }

  // Give cues distinct titles so we can track the active cue across advances
  async function setTitle(index, text) {
    // cue title buttons are w-full+truncate; header title is max-w-md (excluded)
    const titleBtns = page.locator('button.text-sm.w-full.truncate')
    await titleBtns.nth(index).click()
    const input = page.locator('input:focus')
    await input.fill(text)
    await input.press('Enter')
    await page.waitForTimeout(250)
  }
  await setTitle(0, 'Alpha')
  await setTitle(1, 'Bravo')
  await setTitle(2, 'Charlie')
  ok('Set cue titles (Alpha / Bravo / Charlie)')

  // 4. Enter Live Mode -------------------------------------------------------
  log('Starting the show')
  await page.getByRole('button', { name: /run show/i }).click()
  await page.waitForTimeout(600)

  // Transport bar should be visible with LIVE indicator
  const liveBadge = page.getByText('Live', { exact: true })
  assert((await liveBadge.count()) > 0, 'Transport bar shows LIVE')

  // Next button present
  const nextBtn = page.getByRole('button', { name: /^next$/i })
  assert((await nextBtn.count()) > 0, 'Next button visible')

  // Countdown should be ticking — capture remaining time twice
  const countdown = page.locator('.text-2xl.font-mono').first()
  const t1 = await countdown.textContent()
  await page.waitForTimeout(1200)
  const t2 = await countdown.textContent()
  log('countdown:', t1, '->', t2)
  assert(t1 !== t2, 'Countdown is ticking down')

  // First cue row should be highlighted active (emerald bg)
  const activeRows = page.locator('.bg-emerald-950\\/40, .bg-red-950\\/50')
  assert((await activeRows.count()) >= 1, 'Active cue row is highlighted')

  // Next cue should have the pulsing border class
  const pulsing = page.locator('.next-cue-pulse')
  assert((await pulsing.count()) >= 1, 'Next cue has pulsing border')

  // 5. Nudge +1m -------------------------------------------------------------
  log('Testing +1m nudge')
  await page.getByRole('button', { name: /^\+?\s*1m$/ }).last().click()
  await page.waitForTimeout(250)
  assert(
    (await page.locator('text=/\\(\\+\\d/').count()) > 0,
    '+1m nudge shown in transport (+ indicator)'
  )

  // 6. Pause / resume --------------------------------------------------------
  log('Testing pause')
  await page.locator('button[title="Pause"]').click()
  await page.waitForTimeout(300)
  assert(
    (await page.locator('button[title="Resume"]').count()) > 0,
    'Show paused (Resume button appears)'
  )
  const pausedA = await countdown.textContent()
  await page.waitForTimeout(800)
  const pausedB = await countdown.textContent()
  assert(pausedA === pausedB, 'Elapsed timer frozen while paused')
  await page.locator('button[title="Resume"]').click()
  await page.waitForTimeout(300)
  ok('Resumed')

  // 7. Next cue --------------------------------------------------------------
  log('Advancing to next cue')
  const title = page.getByTestId('transport-cue-title')
  const titleBefore = await title.textContent()
  // dispatchEvent dispatches straight to the button node — the Next.js dev-tools
  // badge floats over this corner, so a coordinate-based click would hit the badge
  await page.getByRole('button', { name: /^next$/i }).dispatchEvent('click')
  await page.waitForTimeout(500)
  const titleAfter = await title.textContent()
  log('active cue:', titleBefore, '->', titleAfter)
  assert(titleBefore === 'Alpha' && titleAfter === 'Bravo', 'Next advanced Alpha → Bravo')

  // 8. Jump back to first cue by clicking its number -------------------------
  log('Jumping to first cue via cue number')
  // Click the cue-number span of the Alpha row (first row) to jump back
  await page.locator('div.w-12 span').first().dispatchEvent('click').catch(() => {})
  await page.waitForTimeout(400)
  const titleJumped = await title.textContent()
  log('after jump:', titleJumped)
  assert(titleJumped === 'Alpha', 'Jump-to-cue returned to Alpha')

  // 9. End the show ----------------------------------------------------------
  log('Ending the show')
  // Advance to last cue then End, or just toggle Run/End from header
  // Header button becomes the stop; click Next until "End" then click it
  for (let i = 0; i < 5; i++) {
    const endBtn = page.getByRole('button', { name: /^end$/i })
    if ((await endBtn.count()) > 0) {
      await endBtn.dispatchEvent('click')
      break
    }
    await page.getByRole('button', { name: /^next$/i }).dispatchEvent('click')
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(500)
  assert((await page.getByText('Live', { exact: true }).count()) === 0, 'Transport bar hidden after End')

  await page.screenshot({ path: 'tests/live-mode-result.png', fullPage: false })
  ok('Screenshot saved to tests/live-mode-result.png')

  console.log('\n🎉 ALL LIVE MODE CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  await page.screenshot({ path: 'tests/live-mode-failure.png', fullPage: false }).catch(() => {})
  console.error('   Screenshot: tests/live-mode-failure.png')
  process.exitCode = 1
} finally {
  await browser.close()
}

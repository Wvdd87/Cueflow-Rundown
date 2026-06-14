// Todo #7 — Rundown settings: Display (time format) and Numbering tabs
// Run with:  node tests/todo7-rundown-settings.spec.mjs
// Requires dev server on localhost:3000 AND the phase12 migration applied.

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo7.test.${rand}@gmail.com`
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

try {
  // 1. Sign up
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Todo7 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  ok('Signed up and on dashboard')

  // 2. Create a rundown
  log('Creating rundown')
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'Settings Test')
  await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  ok('Rundown "Settings Test" created and editor open')

  // 3. Add a cue so time/number labels are visible
  log('Adding a cue')
  const addCueBtn = page.getByRole('button', { name: /add first cue|add cue/i }).first()
  await addCueBtn.waitFor({ state: 'visible', timeout: 5000 })
  await addCueBtn.click()
  await page.waitForTimeout(800)
  ok('Cue added')

  // 4. Open Settings dialog via the "Rundown" menu
  log('Opening settings dialog')
  const menuTrigger = page.locator('[data-testid="rundown-menu"]')
  await menuTrigger.waitFor({ state: 'visible', timeout: 5000 })
  await menuTrigger.click()
  await page.waitForTimeout(300)

  const settingsItem = page.getByRole('menuitem', { name: /settings/i }).first()
  await settingsItem.waitFor({ state: 'visible', timeout: 3000 })
  await settingsItem.click()
  await page.waitForTimeout(400)
  ok('Settings dialog opened')

  // 5. All 4 tabs should be visible
  const tabMentions   = page.locator('[data-testid="tab-mentions"]')
  const tabVariables  = page.locator('[data-testid="tab-variables"]')
  const tabDisplay    = page.locator('[data-testid="tab-display"]')
  const tabNumbering  = page.locator('[data-testid="tab-numbering"]')

  await tabMentions.waitFor({ state: 'visible', timeout: 3000 })
  await tabVariables.waitFor({ state: 'visible', timeout: 3000 })
  await tabDisplay.waitFor({ state: 'visible', timeout: 3000 })
  await tabNumbering.waitFor({ state: 'visible', timeout: 3000 })
  ok('All 4 tabs present: Mentions, Variables, Display, Numbering')

  // 6. Switch to Display tab
  log('Testing Display tab')
  await tabDisplay.click()
  await page.waitForTimeout(300)

  // Radio options should all be present
  const radio24h    = page.locator('[data-testid="time-display-24h"]')
  const radio12h    = page.locator('[data-testid="time-display-12h"]')
  const radioNoAmpm = page.locator('[data-testid="time-display-12h_no_ampm"]')
  const radioAuto   = page.locator('[data-testid="time-display-auto"]')

  await radioAuto.waitFor({ state: 'visible', timeout: 2000 })
  await radio24h.waitFor({ state: 'visible', timeout: 2000 })
  await radio12h.waitFor({ state: 'visible', timeout: 2000 })
  await radioNoAmpm.waitFor({ state: 'visible', timeout: 2000 })
  ok('All 4 time format radio options visible')

  // Select 12h AM/PM format and save
  await radio12h.click()
  const saveDisplayBtn = page.locator('[data-testid="save-display-btn"]')
  await saveDisplayBtn.click()
  await page.waitForTimeout(1000)
  ok('Saved 12h AM/PM time display setting')

  // Close dialog and verify start time label reflects 12h format
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // Default start time is 00:00:00 in 24h = "12:00:00 AM" in 12h
  // Look for "AM" or "PM" anywhere on the page inside a cue row
  const timeWithAmPm = page.locator('text=/\\d+:\\d+:\\d+\\s*(AM|PM)/i').first()
  const hasAmPm = await timeWithAmPm.isVisible({ timeout: 3000 }).catch(() => false)
  assert(hasAmPm, 'Cue start time now shows AM/PM format after changing display setting')

  // 7. Test Numbering tab
  log('Testing Numbering tab')
  // Re-open settings
  await menuTrigger.click()
  await page.waitForTimeout(300)
  await page.getByRole('menuitem', { name: /settings/i }).first().click()
  await page.waitForTimeout(400)
  await tabNumbering.click()
  await page.waitForTimeout(300)

  // Numbering inputs should be visible
  const prefixInput  = page.locator('[data-testid="cue-number-prefix"]')
  const startInput   = page.locator('[data-testid="cue-number-start"]')
  const digitsInput  = page.locator('[data-testid="cue-number-digits"]')
  const preview      = page.locator('[data-testid="numbering-preview"]')

  await prefixInput.waitFor({ state: 'visible', timeout: 2000 })
  await startInput.waitFor({ state: 'visible', timeout: 2000 })
  await digitsInput.waitFor({ state: 'visible', timeout: 2000 })
  await preview.waitFor({ state: 'visible', timeout: 2000 })
  ok('Numbering inputs and live preview visible')

  // Default preview should show "1, 2, 2.1, 3" (no prefix, start=1, digits=1)
  const defaultPreviewText = await preview.textContent()
  assert(defaultPreviewText?.includes('1'), 'Default preview contains "1"')
  ok(`Default preview: "${defaultPreviewText?.trim()}"`)

  // Enter prefix "A-", start 10, digits 2
  await prefixInput.fill('A-')
  await startInput.fill('10')
  await digitsInput.fill('2')
  await page.waitForTimeout(300)

  // Preview should update live
  const updatedPreview = await preview.textContent()
  assert(
    updatedPreview?.includes('A-10') || updatedPreview?.includes('A-'),
    `Live preview reflects new settings: "${updatedPreview?.trim()}"`
  )
  ok(`Live preview updated: "${updatedPreview?.trim()}"`)

  // Save
  const saveNumBtn = page.locator('[data-testid="save-numbering-btn"]')
  await saveNumBtn.click()
  await page.waitForTimeout(1000)
  ok('Saved numbering settings')

  // Close and verify cue number in the editor shows "A-10"
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  const cueWithPrefix = page.locator('text=/A-1[0-9]/').first()
  const hasPrefixedNum = await cueWithPrefix.isVisible({ timeout: 3000 }).catch(() => false)
  assert(hasPrefixedNum, 'Cue number now shows "A-10" prefix after saving numbering settings')

  // 8. Reload and verify settings are persisted from DB
  log('Verifying settings persist after reload')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  const persistedAmPm = page.locator('text=/\\d+:\\d+:\\d+\\s*(AM|PM)/i').first()
  const persistedPrefix = page.locator('text=/A-1[0-9]/').first()

  const amPmAfterReload = await persistedAmPm.isVisible({ timeout: 3000 }).catch(() => false)
  const prefixAfterReload = await persistedPrefix.isVisible({ timeout: 3000 }).catch(() => false)

  assert(amPmAfterReload, 'Time display format (AM/PM) persists after page reload')
  assert(prefixAfterReload, 'Cue number prefix persists after page reload')

  console.log('\n• === VERDICT: ✅ PASS ===')
} catch (err) {
  console.error('\n❌ Test error:', err.message)
  await page.screenshot({ path: '/tmp/todo7-fail.png' }).catch(() => {})
  console.log('• Screenshot: /tmp/todo7-fail.png')
  console.log('\n• === VERDICT: ❌ FAIL ===')
} finally {
  await browser.close()
}

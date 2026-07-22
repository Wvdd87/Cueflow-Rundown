// Todo #63 — Simplify the LIVE/FOLLOW indicator system in the read-only Run
// Show view: no header FOLLOW/FOLLOWING toggle, a static (non-blinking) LIVE
// dot, and the floating "Jump to current cue" button as the sole follow control.
// Run with:  node tests/todo63-live-follow.spec.mjs

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo63.test.${rand}@gmail.com`
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
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Todo63 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  ok('Signed up')

  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'Live Follow Test')
  await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  ok('Rundown open')

  // Add a handful of cues so the guest view has room to scroll away from the
  // active (first) cue.
  await page.getByRole('button', { name: /add first cue/i }).click()
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  for (let i = 0; i < 14; i++) {
    await page.locator('[data-testid="add-cue-btn"]').click()
    await page.waitForTimeout(150)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(80)
  }
  ok('15 cues added')

  log('Creating a share link')
  await page.locator('[data-testid="rundown-menu"]').click()
  await page.locator('[data-testid="share-menu-item"]').click()
  await page.locator('[data-testid="create-share"]').click()
  await page.waitForTimeout(600)
  const shareUrl = (await page.locator('[data-testid="share-url"]').first().textContent())?.trim()
  assert(!!shareUrl, `Share link created (${shareUrl})`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  const guestCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const guest = await guestCtx.newPage()
  await guest.goto(shareUrl, { waitUntil: 'networkidle' })
  await guest.waitForTimeout(500)

  log('Operator starts the show')
  await page.getByRole('button', { name: /run show/i }).click()
  await page.waitForTimeout(2500) // allow broadcast to reach the guest

  // 1. No header FOLLOW/FOLLOWING toggle button.
  const followButtonCount = await guest.getByRole('button', { name: /follow/i }).count()
  assert(followButtonCount === 0, 'No FOLLOW/FOLLOWING button in the guest header')

  // 2. A single, static LIVE indicator — not animated, not a button.
  const liveBadge = guest.getByText('Live', { exact: true }).first()
  await liveBadge.waitFor({ state: 'visible', timeout: 5000 })
  const liveDot = guest.locator('header span.rounded-full').first()
  const animationName = await liveDot.evaluate((el) => getComputedStyle(el).animationName)
  assert(animationName === 'none', `LIVE dot is static, not blinking (animation-name: ${animationName})`)
  const liveBadgeTag = await liveBadge.evaluate((el) => el.closest('span')?.tagName)
  assert(liveBadgeTag !== 'BUTTON', 'LIVE indicator is not a button (not clickable)')

  // 3. Floating "Jump to current cue" is hidden while following.
  assert(
    (await guest.getByText('Jump to current cue').count()) === 0,
    'Floating jump button hidden while following'
  )

  // 4. Manual scroll breaks away from following and reveals the floating button.
  log('Scrolling away from the active cue')
  await guest.locator('[data-cue-scroll]').hover()
  await guest.mouse.wheel(0, 900)
  await guest.waitForTimeout(400)
  const jumpBtn = guest.getByText('Jump to current cue')
  assert(await jumpBtn.isVisible(), 'Floating jump button appears after scrolling away')

  // 5. Clicking it resumes following and hides the button again.
  await jumpBtn.click()
  await guest.waitForTimeout(600)
  assert(
    (await guest.getByText('Jump to current cue').count()) === 0,
    'Floating jump button hides again after clicking (resumed following)'
  )

  await guestCtx.close()
  console.log('\n✅ ALL TODO#63 CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ FAILED:', err.message)
  await page.screenshot({ path: 'tests/todo63-failure.png' }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}

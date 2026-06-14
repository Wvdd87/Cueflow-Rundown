// Todo #5 — Move rundowns into events from dashboard
// Run with:  node tests/todo5-move-rundown.spec.mjs

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo5.test.${rand}@gmail.com`
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
  await page.fill('input[name="full_name"]', 'Todo5 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  ok('Signed up and on dashboard')

  // 2. Create a standalone rundown first (before any events exist)
  log('Creating a standalone rundown (no events yet)')
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'My Rundown')
  // No events exist yet so no event select is shown — just submit
  await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  ok('Standalone rundown "My Rundown" created')

  // 3. Go to dashboard and create an event
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  log('Creating an event')
  await page.getByRole('button', { name: /new event/i }).first().click()
  await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'My Event')
  await page.getByRole('button', { name: /^Create event$/i }).click()
  await page.waitForTimeout(800)
  ok('Event "My Event" created')

  // Reload to see both items
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })

  // 4. Verify rundown appears in standalone section
  const standaloneCard = page.locator('.group').filter({ hasText: 'My Rundown' }).first()
  await standaloneCard.waitFor({ state: 'visible', timeout: 3000 })
  ok('Rundown visible in standalone section')

  // 5. Open rundown "..." menu
  log('Opening rundown menu')
  await standaloneCard.hover()
  await page.waitForTimeout(200)
  const menuBtn = standaloneCard.locator('[data-testid="rundown-menu-btn"]')
  await menuBtn.click()
  await page.waitForTimeout(400)

  // 6. "Move to event" submenu trigger visible
  const moveToTrigger = page.getByText('Move to event').first()
  await moveToTrigger.waitFor({ state: 'visible', timeout: 3000 })
  ok('"Move to event" option visible in dropdown')

  // 7. Hover submenu trigger to open submenu
  await moveToTrigger.hover()
  await page.waitForTimeout(500)

  // 8. "My Event" should appear in the submenu
  const myEventItem = page.getByRole('menuitem', { name: 'My Event' }).first()
  await myEventItem.waitFor({ state: 'visible', timeout: 3000 })
  ok('"My Event" listed in move-to submenu')

  // 9. Click "My Event" to move the rundown into it
  await myEventItem.click()
  await page.waitForTimeout(800)
  ok('Clicked to move rundown into "My Event"')

  // 10. Reload and verify the rundown is now under the event
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })

  // Standalone section should not contain "My Rundown"
  const standaloneSections = page.locator('section').filter({ hasText: /^Rundowns$/i })
  const hasSS = await standaloneSections.count() > 0
  if (hasSS) {
    const leftover = standaloneSections.getByText('My Rundown')
    assert(!(await leftover.isVisible()), 'Rundown no longer in standalone section')
  } else {
    ok('Standalone section gone (all rundowns in events)')
  }

  // Find it under the event
  const eventBlock = page.locator('.rounded-lg').filter({ hasText: 'My Event' }).first()
  await eventBlock.waitFor({ state: 'visible', timeout: 3000 })
  await eventBlock.getByText('My Rundown').waitFor({ state: 'visible', timeout: 3000 })
  ok('"My Rundown" now shown under "My Event"')

  // 11. Test "Remove from event"
  log('Testing remove from event')
  const cardInEvent = page.locator('.group').filter({ hasText: 'My Rundown' }).first()
  await cardInEvent.hover()
  await page.waitForTimeout(200)
  await cardInEvent.locator('[data-testid="rundown-menu-btn"]').click()
  await page.waitForTimeout(400)

  const moveToTrigger2 = page.getByText('Move to event').first()
  await moveToTrigger2.hover()
  await page.waitForTimeout(500)

  const removeItem = page.getByText('Remove from event').first()
  await removeItem.waitFor({ state: 'visible', timeout: 3000 })
  ok('"Remove from event" option visible')
  await removeItem.click()
  await page.waitForTimeout(800)

  // Reload and confirm standalone again
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  const standaloneAgain = page.locator('.group').filter({ hasText: 'My Rundown' }).first()
  await standaloneAgain.waitFor({ state: 'visible', timeout: 3000 })
  // Ensure it's NOT under the event block
  const eventBlock2 = page.locator('.rounded-lg').filter({ hasText: 'My Event' }).first()
  const insideEvent = await eventBlock2.getByText('My Rundown').isVisible().catch(() => false)
  assert(!insideEvent, 'Rundown is no longer inside the event')
  ok('Rundown is back in standalone section')

  console.log('\n• === VERDICT: ✅ PASS ===')
} catch (err) {
  console.error('\n❌ Test error:', err.message)
  await page.screenshot({ path: '/tmp/todo5-fail.png' }).catch(() => {})
  console.log('• Screenshot: /tmp/todo5-fail.png')
  console.log('\n• === VERDICT: ❌ FAIL ===')
} finally {
  await browser.close()
}

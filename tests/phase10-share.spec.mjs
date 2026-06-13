// Read-only sharing: create a link, open it unauthenticated, see the rundown.
// Requires schema_phase10.sql. Run:  node tests/phase10-share.spec.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `share.test.${rand}@gmail.com`
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
  await page.fill('input[name="full_name"]', 'Share Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Shared Show')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
    await page.waitForTimeout(450)
  }
  await setTitle(0, 'Opening number')
  await setTitle(1, 'Closing number')
  ok('Rundown ready')

  // Create the share link ---------------------------------------------------
  log('Creating a read-only share link')
  await page.getByTestId('rundown-menu').click()
  await page.waitForTimeout(200)
  await page.getByTestId('share-menu-item').click()
  await page.waitForTimeout(400)
  await page.getByTestId('create-share').click()
  await page.waitForTimeout(800)
  const shareUrl = (await page.getByTestId('share-url').first().textContent())?.trim()
  log('share url:', shareUrl)
  assert(!!shareUrl && /\/share\/[a-f0-9]+$/.test(shareUrl), 'Share URL generated')

  // Open it in a fresh, unauthenticated context -----------------------------
  log('Opening the link as an anonymous guest')
  const guestCtx = await browser.newContext()
  const guest = await guestCtx.newPage()
  await guest.goto(shareUrl, { waitUntil: 'networkidle' })
  await guest.waitForTimeout(800)
  assert(await guest.getByText('Shared Show').first().isVisible(), 'Guest sees the rundown name')
  assert(await guest.getByText('Read-only').first().isVisible(), 'Read-only badge shown')
  assert(await guest.getByText('Opening number').first().isVisible(), 'Guest sees cue 1')
  assert(await guest.getByText('Closing number').first().isVisible(), 'Guest sees cue 2')
  // No editing affordances (no "Run show" button on the public view)
  assert(
    (await guest.getByRole('button', { name: /run show/i }).count()) === 0,
    'No editing controls on the public view'
  )

  await guest.screenshot({ path: 'tests/phase10-share-result.png' })
  ok('Screenshot saved')
  await guestCtx.close()

  console.log('\n🎉 ALL SHARE CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  await page.screenshot({ path: 'tests/phase10-share-failure.png' }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
